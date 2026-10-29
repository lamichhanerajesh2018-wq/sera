import assert from "node:assert/strict";
import test from "node:test";
import { getResearchConfig } from "../../lib/research/config.ts";
import { parseRawSignalInput, RawSignalValidationError } from "../../lib/research/validation.ts";

function valid(overrides: Record<string, unknown> = {}) {
  return {
    source: "manual_import",
    sourceId: "test-001",
    sourceUrl: "https://example.com/test-001",
    body: "A meaningful real-world problem.",
    geographyEvidence: "us_context",
    ...overrides,
  };
}

test("rejects invalid URLs", () => {
  assert.throws(() => parseRawSignalInput(valid({ sourceUrl: "javascript:alert(1)" })), RawSignalValidationError);
});

test("rejects empty or punctuation-only content", () => {
  assert.throws(() => parseRawSignalInput(valid({ title: "", body: " ... !!! " })), /meaningful text/);
});

test("rejects unsupported sources and non-US targets", () => {
  assert.throws(() => parseRawSignalInput(valid({ source: "unknown" })), RawSignalValidationError);
  assert.throws(() => parseRawSignalInput(valid({ targetCountry: "canada" })), RawSignalValidationError);
});

test("rejects invalid engagement and sensitive metadata", () => {
  assert.throws(() => parseRawSignalInput(valid({ engagement: { likes: -1 } })), RawSignalValidationError);
  assert.throws(
    () => parseRawSignalInput(valid({ metadata: { accessToken: "must-not-store" } })),
    /Sensitive contact, credential, token/,
  );
});

test("truncation records original code-point length in metadata", () => {
  const config = { ...getResearchConfig(), maximumBodyLength: 5 };
  const result = parseRawSignalInput(valid({ body: "a🙂🙂🙂🙂🙂" }), config);
  assert.equal(result.body, "a🙂🙂🙂🙂");
  assert.deepEqual(result.metadata, { originalBodyLength: 6, bodyTruncated: true });
});

test("normalization omits empty optional strings", () => {
  const result = parseRawSignalInput(valid({ title: "   ", authorName: "\0 " }));
  assert.equal("title" in result, false);
  assert.equal("authorName" in result, false);
});
