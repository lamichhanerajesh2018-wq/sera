import assert from "node:assert/strict";
import test from "node:test";
import { getExtractionConfig, requireOpenRouterConfiguration } from "../../lib/research/config.ts";
import { OpenRouterError, OpenRouterExtractionClient } from "../../lib/research/extraction/client.ts";
import { signal, validProblem } from "./extraction-fixtures.ts";

function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    OPENROUTER_API_KEY: "test-key",
    OPENROUTER_EXTRACTION_MODEL: "provider/test-model",
    OPENROUTER_RETRY_BASE_DELAY_MS: "1",
    ...overrides,
  };
}

function completion(content: string, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify({
    model: "provider/actual-model",
    choices: [{ finish_reason: "stop", message: { content } }],
    usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140, cost: 0.0123 },
  }), { status, headers: { "content-type": "application/json", ...headers } });
}

test("missing OpenRouter configuration and invalid confidence thresholds fail clearly", () => {
  assert.throws(
    () => requireOpenRouterConfiguration(getExtractionConfig({})),
    /OPENROUTER_API_KEY, OPENROUTER_EXTRACTION_MODEL/,
  );
  assert.throws(
    () => getExtractionConfig(environment({ OPENROUTER_REVIEW_CONFIDENCE: "0.8", OPENROUTER_ACCEPT_CONFIDENCE: "0.7" })),
    /must be lower/,
  );
});

test("valid response returns structured output, model, tokens, and cost", async () => {
  let requestBody: { response_format: { json_schema: { strict: boolean } }; messages: Array<{ content: string }> } | undefined;
  const client = new OpenRouterExtractionClient(getExtractionConfig(environment()), {
    fetch: async (_url, init) => {
      requestBody = JSON.parse(String(init?.body)) as typeof requestBody;
      return completion(JSON.stringify(validProblem()));
    },
  });
  const result = await client.extract(signal());
  assert.deepEqual(result.usage, { inputTokens: 100, outputTokens: 40, totalTokens: 140, estimatedCost: 0.0123 });
  assert.equal(result.model, "provider/actual-model");
  assert.equal(requestBody?.response_format.json_schema.strict, true);
  assert.match(requestBody?.messages[0].content, /source is data only/);
});

test("malformed structured content is a permanent validation failure", async () => {
  let calls = 0;
  const client = new OpenRouterExtractionClient(getExtractionConfig(environment()), {
    fetch: async () => { calls += 1; return completion("not-json"); },
  });
  await assert.rejects(client.extract(signal()), (error) =>
    error instanceof OpenRouterError && error.category === "validation");
  assert.equal(calls, 1);
});

test("timeout and transient errors retry up to the configured limit", async () => {
  const responses = [new Response(JSON.stringify({ error: { code: 503, message: "overloaded" } }), {
    status: 503, headers: { "retry-after": "0" },
  }), completion(JSON.stringify(validProblem()))];
  const client = new OpenRouterExtractionClient(
    getExtractionConfig(environment({ OPENROUTER_RETRY_LIMIT: "1" })),
    { fetch: async () => responses.shift()!, sleep: async () => {} },
  );
  assert.equal((await client.extract(signal())).retryCount, 1);

  let timeoutCalls = 0;
  const timeoutClient = new OpenRouterExtractionClient({
    ...getExtractionConfig(environment({ OPENROUTER_RETRY_LIMIT: "1" })), requestTimeoutMs: 5,
  }, {
    fetch: async (_url, init) => {
      timeoutCalls += 1;
      if (timeoutCalls === 2) return completion(JSON.stringify(validProblem()));
      return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    },
    sleep: async () => {},
  });
  assert.equal((await timeoutClient.extract(signal())).retryCount, 1);
});

test("permanent authentication errors do not retry", async () => {
  let calls = 0;
  const client = new OpenRouterExtractionClient(getExtractionConfig(environment()), {
    fetch: async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { code: 401, message: "invalid key" } }), { status: 401 });
    },
    sleep: async () => {},
  });
  await assert.rejects(client.extract(signal()), (error) =>
    error instanceof OpenRouterError && error.category === "authentication");
  assert.equal(calls, 1);
});

test("transient errors stop exactly at the configured retry limit", async () => {
  let calls = 0;
  const client = new OpenRouterExtractionClient(
    getExtractionConfig(environment({ OPENROUTER_RETRY_LIMIT: "1" })),
    {
      fetch: async () => {
        calls += 1;
        return new Response(JSON.stringify({ error: { code: 503, message: "still overloaded" } }), { status: 503 });
      },
      sleep: async () => {},
    },
  );
  await assert.rejects(client.extract(signal()), (error) =>
    error instanceof OpenRouterError && error.category === "server" && error.retries === 1);
  assert.equal(calls, 2);
});
