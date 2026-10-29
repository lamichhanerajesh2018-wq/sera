import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isSafeRedditCommunityName } from "../../lib/research/reddit/normalization.ts";

test("configured Reddit community and pain-query seeds are syntactically safe", async () => {
  const communities = JSON.parse(
    await readFile(new URL("../../data/research/reddit-communities.json", import.meta.url), "utf8"),
  ) as Record<string, unknown>;
  const names = Object.values(communities).flat();
  assert.ok(names.length > 0);
  assert.ok(names.every((name) => typeof name === "string" && isSafeRedditCommunityName(name)));

  const queries = JSON.parse(
    await readFile(new URL("../../data/research/reddit-pain-queries.json", import.meta.url), "utf8"),
  ) as unknown;
  assert.ok(Array.isArray(queries));
  assert.ok(queries.length > 0);
  assert.ok(queries.every((query) => typeof query === "string" && query.trim().length >= 5));
});
