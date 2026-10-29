import assert from "node:assert/strict";
import test from "node:test";
import type { RedditPostData } from "../../lib/research/reddit/client.ts";
import {
  classifyUsGeography,
  isPredominantlyEnglish,
  isSafeRedditCommunityName,
  normalizeRedditPost,
} from "../../lib/research/reddit/normalization.ts";

const NOW = new Date("2026-07-13T00:00:00Z");

function post(overrides: RedditPostData = {}): RedditPostData {
  return {
    id: "abc123",
    subreddit: "Parenting",
    title: "How do you manage childcare schedules?",
    selftext: "I am struggling with childcare because the available centers close before my work shift ends.",
    author: "public_user",
    created_utc: NOW.getTime() / 1_000 - 86_400,
    permalink: "/r/Parenting/comments/abc123/example/",
    domain: "self.Parenting",
    is_self: true,
    over_18: false,
    locked: false,
    stickied: false,
    spoiler: false,
    score: 12,
    num_comments: 4,
    upvote_ratio: 0.9,
    ...overrides,
  };
}

function normalize(overrides: RedditPostData = {}) {
  return normalizeRedditPost(post(overrides), {
    query: "struggling with",
    minimumPostBodyLength: 20,
    maximumPostAgeDays: 365,
    includeSelfTextOnly: true,
    excludeNsfw: true,
    now: NOW,
  });
}

test("community syntax and deterministic English checks are conservative", () => {
  assert.equal(isSafeRedditCommunityName("personalfinance"), true);
  assert.equal(isSafeRedditCommunityName("../private"), false);
  assert.equal(isPredominantlyEnglish("I am trying to find a better way to manage this every week."), true);
  assert.equal(isPredominantlyEnglish("Estoy frustrado porque resulta demasiado complicado cada semana."), false);
});

test("normalizes a Reddit post into a pending-compatible raw signal", () => {
  const result = normalize({ selftext: "I live in Texas and I cannot find childcare after my evening shift. 🙂" });
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.signal.source, "reddit");
  assert.equal(result.signal.sourceId, "abc123");
  assert.equal(result.signal.sourceCommunity, "Parenting");
  assert.equal(result.geographyEvidence, "explicit_us");
  assert.match(String(result.signal.body), /🙂/u);
  assert.deepEqual(result.signal.engagement, { score: 12, comments: 4, upvoteRatio: 0.9 });
});

test("rejects deleted, removed, empty, short, NSFW, and stickied posts", () => {
  assert.deepEqual(normalize({ selftext: "[removed]" }), { accepted: false, reason: "deleted_or_removed" });
  assert.deepEqual(normalize({ title: "", selftext: "" }), { accepted: false, reason: "empty_content" });
  assert.deepEqual(normalize({ selftext: "Too short." }), { accepted: false, reason: "short_body" });
  assert.deepEqual(normalize({ over_18: true }), { accepted: false, reason: "nsfw" });
  assert.deepEqual(normalize({ stickied: true }), { accepted: false, reason: "stickied_or_moderator" });
});

test("rejects unsupported language, promotion, old content, and invalid URLs", () => {
  assert.deepEqual(
    normalize({ selftext: "Estoy frustrado porque resulta demasiado complicado cada semana para nuestra familia." }),
    { accepted: false, reason: "unsupported_language" },
  );
  assert.deepEqual(
    normalize({ selftext: "Use my promo code today because this limited-time offer will save you money." }),
    { accepted: false, reason: "promotional" },
  );
  assert.deepEqual(
    normalize({ created_utc: NOW.getTime() / 1_000 - 400 * 86_400 }),
    { accepted: false, reason: "too_old" },
  );
  assert.deepEqual(normalize({ permalink: "https://evil.example/post" }), { accepted: false, reason: "invalid_url" });
});

test("classifies explicit US, US context, unknown, and non-US conservatively", () => {
  assert.equal(classifyUsGeography("I live in California and work nights."), "explicit_us");
  assert.equal(classifyUsGeography("My employer's 401(k) portal keeps failing."), "us_context");
  assert.equal(classifyUsGeography("The scheduling portal keeps failing every week."), "unknown");
  assert.equal(classifyUsGeography("I live in Canada and our booking process is broken."), "non_us");
});
