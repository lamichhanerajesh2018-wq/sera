import assert from "node:assert/strict";
import test from "node:test";
import { getRedditConfig } from "../../lib/research/config.ts";
import { collectRedditPosts, validateRedditCollectorOptions } from "../../lib/research/collectors/redditCollector.ts";
import { RedditApiError, type RedditApiClient, type RedditPostData } from "../../lib/research/reddit/client.ts";
import { ResearchRepository } from "../../lib/research/repository.ts";
import { FakeResearchDb } from "./fake-db.ts";

const NOW = new Date("2026-07-13T00:00:00Z");

function config() {
  return getRedditConfig({
    RESEARCH_COLLECTOR_REDDIT_ENABLED: "true",
    REDDIT_CLIENT_ID: "id",
    REDDIT_CLIENT_SECRET: "secret",
    REDDIT_USER_AGENT: "sera-research/test",
    REDDIT_REQUEST_PACING_MS: "0",
    REDDIT_MIN_POST_BODY_LENGTH: "20",
  });
}

function redditPost(overrides: RedditPostData = {}): RedditPostData {
  return {
    id: "post-1",
    subreddit: "Parenting",
    title: "How do you handle a childcare waitlist?",
    selftext: "I am waiting for childcare and the process takes too much time for working parents.",
    author: "parent_user",
    created_utc: NOW.getTime() / 1_000 - 86_400,
    permalink: "/r/Parenting/comments/post1/example/",
    domain: "self.Parenting",
    is_self: true,
    over_18: false,
    stickied: false,
    ...overrides,
  };
}

function mockClient(handler: (community: string, query: string) => Promise<RedditPostData[]>): RedditApiClient {
  return {
    requestCount: 2,
    searchPosts: ({ community, query }: { community: string; query: string }) => handler(community, query),
  } as unknown as RedditApiClient;
}

test("safe run limits reject unsafe combinations and accept a 5-post preset", () => {
  const safe = validateRedditCollectorOptions({
    communities: ["Parenting"],
    queries: ["struggling with"],
    postsPerQuery: 5,
    maximumRequests: 2,
    dryRun: true,
  }, config());
  assert.equal(safe.postsPerQuery, 5);
  assert.equal(safe.dryRun, true);
  assert.throws(() => validateRedditCollectorOptions({
    communities: ["Parenting", "Teachers"],
    queries: ["one", "two"],
    maximumRequests: 2,
  }, config()), /safe request limit/);
});

test("unavailable subreddit does not crash a partially completed run", async () => {
  const fake = new FakeResearchDb();
  const repository = new ResearchRepository(fake.asDb());
  const client = mockClient(async (community) => {
    if (community === "Unavailable") throw new RedditApiError("not found", "validation", 404);
    return [redditPost()];
  });
  const report = await collectRedditPosts({
    communities: ["Parenting", "Unavailable"],
    queries: ["waiting for"],
    maximumRequests: 3,
    dryRun: false,
  }, {
    database: fake.asDb(), repository, client, redditConfig: config(), now: () => NOW, ensureIndexes: false,
  });
  assert.equal(report.runStatus, "partially_completed");
  assert.deepEqual(report.communitiesUnavailable, ["Unavailable"]);
  assert.equal(report.postsInserted, 1);
  assert.equal(report.failures, 1);
  assert.equal(fake.collectionRuns.documents[0]?.status, "partially_completed");
  assert.equal(fake.collectionRuns.documents[0]?.failedCount, 1);
});

test("dry run produces previews without writing or exposing authors", async () => {
  const fake = new FakeResearchDb();
  const report = await collectRedditPosts({
    communities: ["Parenting"], queries: ["waiting for"], postsPerQuery: 5,
    maximumRequests: 2, dryRun: true, includePreviews: true,
  }, {
    database: fake.asDb(), repository: new ResearchRepository(fake.asDb()),
    client: mockClient(async () => [redditPost()]), redditConfig: config(), now: () => NOW, ensureIndexes: false,
  });
  assert.equal(report.wouldInsert, 1);
  assert.equal(report.postsInserted, 0);
  assert.equal(fake.rawSignals.documents.length, 0);
  assert.equal("authorName" in report.previews[0], false);
  assert.ok(report.previews[0]?.bodyPreview.length <= 120);
});

test("repeated Reddit collection is idempotent for source ID and content hash", async () => {
  const fake = new FakeResearchDb();
  const repository = new ResearchRepository(fake.asDb());
  const dependencies = {
    database: fake.asDb(), repository, redditConfig: config(), now: () => NOW, ensureIndexes: false,
  };
  const options = {
    communities: ["Parenting"], queries: ["waiting for"], maximumRequests: 2, dryRun: false,
  };
  const first = await collectRedditPosts(options, {
    ...dependencies, client: mockClient(async () => [redditPost()]),
  });
  const second = await collectRedditPosts(options, {
    ...dependencies, client: mockClient(async () => [redditPost()]),
  });
  assert.equal(first.postsInserted, 1);
  assert.equal(second.duplicates, 1);
  assert.equal(fake.rawSignals.documents.length, 1);

  const contentDuplicate = await collectRedditPosts(options, {
    ...dependencies,
    client: mockClient(async () => [redditPost({ id: "post-2", permalink: "/r/Parenting/comments/post2/example/" })]),
  });
  assert.equal(contentDuplicate.duplicates, 1);
});
