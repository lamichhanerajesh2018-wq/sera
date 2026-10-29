import assert from "node:assert/strict";
import test from "node:test";
import {
  getRedditConfig,
  RedditConfigurationError,
  requireRedditCredentials,
} from "../../lib/research/config.ts";
import { RedditApiClient, RedditApiError } from "../../lib/research/reddit/client.ts";

function environment(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    RESEARCH_COLLECTOR_REDDIT_ENABLED: "true",
    REDDIT_CLIENT_ID: "client-id",
    REDDIT_CLIENT_SECRET: "client-secret",
    REDDIT_USER_AGENT: "sera-research/1.0 by test-owner",
    REDDIT_REQUEST_PACING_MS: "0",
    REDDIT_RETRY_BASE_DELAY_MS: "1",
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("Reddit configuration validates enums, booleans, and credentials", () => {
  const config = getRedditConfig(environment());
  assert.equal(config.enabled, true);
  assert.equal(config.defaultSort, "relevance");
  assert.deepEqual(requireRedditCredentials(config), {
    clientId: "client-id",
    clientSecret: "client-secret",
    userAgent: "sera-research/1.0 by test-owner",
  });
  assert.throws(
    () => getRedditConfig(environment({ REDDIT_DEFAULT_SORT: "unsafe" })),
    RedditConfigurationError,
  );
  assert.throws(
    () => requireRedditCredentials(getRedditConfig(environment({ REDDIT_CLIENT_SECRET: "" }))),
    /REDDIT_CLIENT_SECRET/,
  );
});

test("token response is validated and cached until shortly before expiry", async () => {
  let now = 1_000_000;
  let calls = 0;
  const fetchMock: typeof fetch = async () => {
    calls += 1;
    return jsonResponse({ access_token: `token-${calls}`, token_type: "bearer", expires_in: 3600 });
  };
  const client = new RedditApiClient(getRedditConfig(environment()), 10, {
    fetch: fetchMock,
    now: () => now,
    sleep: async () => {},
  });
  assert.equal(await client.getAccessToken(), "token-1");
  assert.equal(await client.getAccessToken(), "token-1");
  assert.equal(calls, 1);
  now += 3_550_000;
  assert.equal(await client.getAccessToken(), "token-2");
  assert.equal(calls, 2);
});

test("concurrent callers share one in-flight token request", async () => {
  let calls = 0;
  const client = new RedditApiClient(getRedditConfig(environment()), 3, {
    fetch: async () => {
      calls += 1;
      await Promise.resolve();
      return jsonResponse({ access_token: "shared", token_type: "bearer", expires_in: 3600 });
    },
    sleep: async () => {},
  });
  assert.deepEqual(await Promise.all([client.getAccessToken(), client.getAccessToken()]), ["shared", "shared"]);
  assert.equal(calls, 1);
});

test("invalid token responses surface authentication errors", async () => {
  const client = new RedditApiClient(getRedditConfig(environment()), 3, {
    fetch: async () => jsonResponse({ token_type: "bearer", expires_in: 3600 }),
    sleep: async () => {},
  });
  await assert.rejects(client.getAccessToken(), (error) =>
    error instanceof RedditApiError && error.category === "authentication");
});

test("request timeout is surfaced as a network error", async () => {
  const config = { ...getRedditConfig(environment()), requestTimeoutMs: 5, retryLimit: 0 };
  const fetchMock: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  const client = new RedditApiClient(config, 2, { fetch: fetchMock, sleep: async () => {} });
  await assert.rejects(client.getAccessToken(), (error) =>
    error instanceof RedditApiError && error.category === "network" && /timed out/.test(error.message));
});

test("transient server failures retry with bounded backoff", async () => {
  const responses = [
    jsonResponse({ access_token: "token", token_type: "bearer", expires_in: 3600 }),
    jsonResponse({ message: "temporary" }, 503),
    jsonResponse({ data: { children: [] } }),
  ];
  const sleeps: number[] = [];
  const client = new RedditApiClient(getRedditConfig(environment({ REDDIT_RETRY_LIMIT: "1" })), 5, {
    fetch: async () => responses.shift()!,
    sleep: async (milliseconds) => { sleeps.push(milliseconds); },
  });
  assert.deepEqual(await client.searchPosts({
    community: "Parenting",
    query: "struggling with",
    sort: "relevance",
    timeFilter: "month",
    limit: 5,
  }), []);
  assert.ok(sleeps.includes(1));
  assert.equal(client.requestCount, 3);
});

test("rate-limit responses honor retry-after before retrying", async () => {
  const responses = [
    jsonResponse({ access_token: "token", token_type: "bearer", expires_in: 3600 }),
    jsonResponse({}, 429, { "retry-after": "2" }),
    jsonResponse({ data: { children: [] } }),
  ];
  const sleeps: number[] = [];
  const client = new RedditApiClient(getRedditConfig(environment({ REDDIT_RETRY_LIMIT: "1" })), 5, {
    fetch: async () => responses.shift()!,
    sleep: async (milliseconds) => { sleeps.push(milliseconds); },
  });
  await client.searchPosts({
    community: "Parenting",
    query: "waiting for",
    sort: "new",
    timeFilter: "week",
    limit: 5,
  });
  assert.ok(sleeps.includes(2_000));
});
