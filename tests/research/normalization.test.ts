import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateContentHash,
  normalizeWhitespace,
  safelyTrimBody,
  sourceTimestampToDate,
} from "../../lib/research/normalization.ts";

test("normalizes whitespace, null bytes, line endings, and repeated blank lines", () => {
  assert.equal(
    normalizeWhitespace("  hello\0   world\r\n\r\n \r\n  next  line  "),
    "hello world\n\nnext line",
  );
});

test("content hashing is stable for equivalent normalized text", () => {
  assert.equal(
    calculateContentHash(" A  title ", "First\r\n\r\n\r\nSecond"),
    calculateContentHash("A title", "First\n\nSecond"),
  );
});

test("long body truncation preserves Unicode code points", () => {
  const result = safelyTrimBody("🙂🙂🙂 café", 5);
  assert.equal(result.value, "🙂🙂🙂 c");
  assert.equal(result.truncated, true);
  assert.equal(result.originalLength, 8);
  assert.equal(result.value.includes("�"), false);
});

test("source timestamps convert valid values and reject invalid values", () => {
  assert.equal(sourceTimestampToDate("2026-01-01T12:00:00Z")?.toISOString(), "2026-01-01T12:00:00.000Z");
  assert.equal(sourceTimestampToDate("not-a-date"), undefined);
});
