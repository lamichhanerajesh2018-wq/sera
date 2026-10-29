/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "mongodb";
import { getExtractionConfig } from "../../lib/research/config.ts";
import {
  OpenRouterError,
  type OpenRouterExtractionClient,
  type OpenRouterExtractionResult,
} from "../../lib/research/extraction/client.ts";
import { ExtractionRepository } from "../../lib/research/extraction/repository.ts";
import { runExtractionPipeline } from "../../lib/research/extraction/service.ts";
import type { RawSignalDocument } from "../../lib/research/types.ts";
import { FakeResearchDb } from "./fake-db.ts";
import { noProblem, signal, validProblem } from "./extraction-fixtures.ts";

const fixedNow = new Date("2026-07-13T12:00:00Z");

function config(overrides: Record<string, string> = {}) {
  return getExtractionConfig({
    OPENROUTER_API_KEY: "test-key",
    OPENROUTER_EXTRACTION_MODEL: "provider/test-model",
    OPENROUTER_EXTRACTION_DRY_RUN: "false",
    OPENROUTER_MAX_COST_PER_RUN: "10",
    OPENROUTER_BATCH_SIZE: "10",
    OPENROUTER_CONCURRENCY: "2",
    ...overrides,
  });
}

function result(output: unknown, overrides: Partial<OpenRouterExtractionResult> = {}): OpenRouterExtractionResult {
  return {
    output,
    model: "provider/actual-model",
    usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140, estimatedCost: 0.01 },
    retryCount: 0,
    inputTruncated: false,
    originalInputLength: 100,
    ...overrides,
  };
}

function client(extract: (raw: RawSignalDocument) => Promise<OpenRouterExtractionResult>) {
  return { extract } as OpenRouterExtractionClient;
}

async function seed(fake: FakeResearchDb, overrides: Partial<RawSignalDocument> = {}) {
  const document = signal({
    _id: undefined,
    sourceId: `source-${fake.rawSignals.documents.length + 1}`,
    contentHash: `hash-${fake.rawSignals.documents.length + 1}`,
    ...overrides,
  });
  await fake.rawSignals.insertOne(document as any);
  return document;
}

function dependencies(fake: FakeResearchDb, extractionClient: OpenRouterExtractionClient) {
  return {
    database: fake.asDb(),
    client: extractionClient,
    config: config(),
    now: () => fixedNow,
    ensureIndexes: false,
    workerId: "test-worker",
  };
}

test("atomic claims never return the same pending signal twice", async () => {
  const fake = new FakeResearchDb();
  await seed(fake);
  await seed(fake);
  const repository = new ExtractionRepository(fake.asDb());
  const runId = new ObjectId();
  const [first, second] = await Promise.all([
    repository.claimNextSignal({ runId, workerId: "one", filters: {}, now: fixedNow }),
    repository.claimNextSignal({ runId, workerId: "two", filters: {}, now: fixedNow }),
  ]);
  assert.notEqual(first?._id?.toString(), second?._id?.toString());
  assert.equal(await repository.claimNextSignal({ runId, workerId: "three", filters: {} }), null);
});

test("accepted extraction persists one grounded mention and exact run accounting", async () => {
  const fake = new FakeResearchDb();
  const raw = await seed(fake);
  const report = await runExtractionPipeline({ limit: 1 }, dependencies(fake, client(async () => result(
    validProblem(), { retryCount: 1 },
  ))));

  assert.deepEqual(
    { attempted: report.attempted, accepted: report.accepted, retries: report.retries, totalTokens: report.totalTokens },
    { attempted: 1, accepted: 1, retries: 1, totalTokens: 140 },
  );
  assert.equal(report.estimatedCost, 0.01);
  assert.equal(fake.rawSignals.documents[0].processingStatus, "processed");
  assert.equal(fake.problemMentions.documents.length, 1);
  assert.equal(fake.problemMentions.documents[0].rawSignalId.toString(), raw._id?.toString());
  assert.equal(fake.problemMentions.documents[0].status, "accepted");
  assert.equal(fake.extractionRuns.documents[0].acceptedProblemCount, 1);
  assert.equal(fake.extractionRuns.documents[0].retryCount, 1);
  assert.equal(fake.extractionRuns.documents[0].totalTokens, 140);
  assert.equal(fake.extractionRuns.documents[0].estimatedCost, 0.01);
  assert.equal(fake.extractionRuns.documents[0].status, "completed");
});

test("promotional and vague signals are rejected without problem mentions", async () => {
  const fake = new FakeResearchDb();
  await seed(fake, { title: "Try our app", body: "Buy our amazing scheduling app today." });
  await seed(fake, { title: "Not good", body: "This is bad and annoying." });
  const extractionClient = client(async (raw) => result(noProblem(
    raw.title === "Try our app" ? "promotional content" : "vague complaint without a specific problem",
  )));
  const report = await runExtractionPipeline({ limit: 2 }, dependencies(fake, extractionClient));
  assert.equal(report.noProblem, 2);
  assert.equal(fake.problemMentions.documents.length, 0);
  assert.deepEqual(fake.rawSignals.documents.map((item) => item.processingStatus), ["no_problem", "no_problem"]);
  assert.equal(fake.extractionRuns.documents[0].noProblemCount, 2);
});

test("confidence thresholds route review candidates and reject low-confidence output", async () => {
  const fake = new FakeResearchDb();
  await seed(fake);
  await seed(fake);
  let call = 0;
  const extractionClient = client(async () => result(validProblem({ extractionConfidence: call++ === 0 ? 0.7 : 0.5 })));
  const report = await runExtractionPipeline({ limit: 2 }, dependencies(fake, extractionClient));
  assert.equal(report.needsReview, 1);
  assert.equal(report.noProblem, 1);
  assert.equal(fake.problemMentions.documents[0].status, "needs_review");
  assert.equal(fake.extractionRuns.documents[0].needsReviewCount, 1);
});

test("repeat processing is idempotent and records the duplicate outcome", async () => {
  const fake = new FakeResearchDb();
  await seed(fake);
  const extractionClient = client(async () => result(validProblem()));
  await runExtractionPipeline({ limit: 1 }, dependencies(fake, extractionClient));
  fake.rawSignals.documents[0].processingStatus = "pending";
  let unexpectedCalls = 0;
  const report = await runExtractionPipeline({ limit: 1 }, dependencies(fake, client(async () => {
    unexpectedCalls += 1;
    return result(validProblem());
  })));
  assert.equal(unexpectedCalls, 0);
  assert.equal(report.duplicates, 1);
  assert.equal(report.accepted, 1);
  assert.equal(fake.problemMentions.documents.length, 1);
  assert.equal(fake.extractionRuns.documents[1].acceptedProblemCount, 1);
});

test("stale work is recovered while permanent failures obey retry limits", async () => {
  const fake = new FakeResearchDb();
  await seed(fake, {
    processingStatus: "processing",
    processingStartedAt: new Date("2026-07-13T10:00:00Z"),
  });
  const recovered = await runExtractionPipeline({ limit: 1 }, dependencies(fake, client(async () => result(validProblem()))));
  assert.equal(recovered.staleRecovered, 1);
  assert.equal(fake.rawSignals.documents[0].retryCount, 1);

  const failedRaw = await seed(fake);
  const failure = new OpenRouterError("invalid key", "authentication", 401, undefined, 0);
  const failed = await runExtractionPipeline({ limit: 1 }, dependencies(fake, client(async () => { throw failure; })));
  assert.equal(failed.failed, 1);
  assert.equal(failed.status, "partially_completed");
  assert.equal(failedRaw.processingStatus, "failed");
  assert.equal(failedRaw.retryCount, 1);
  const repository = new ExtractionRepository(fake.asDb());
  assert.equal(await repository.requeueFailedSignals(2, {}), 1);
  failedRaw.processingStatus = "failed";
  failedRaw.retryCount = 2;
  assert.equal(await repository.requeueFailedSignals(2, {}), 0);
});

test("strict output validation failures still account for billed usage and cost", async () => {
  const fake = new FakeResearchDb();
  await seed(fake);
  const report = await runExtractionPipeline({ limit: 1 }, dependencies(fake, client(async () => result(validProblem({
    canonicalProblem: "Night-shift childcare remains unavailable?",
  })))));

  assert.equal(report.failed, 1);
  assert.equal(report.totalTokens, 280);
  assert.equal(report.estimatedCost, 0.02);
  assert.equal(report.retries, 1);
  assert.equal(fake.extractionRuns.documents[0].totalTokens, 280);
  assert.equal(fake.extractionRuns.documents[0].estimatedCost, 0.02);
});

test("one bounded validation repair can produce a strictly grounded result", async () => {
  const fake = new FakeResearchDb();
  await seed(fake);
  let calls = 0;
  const report = await runExtractionPipeline({ limit: 1 }, dependencies(fake, client(async () => {
    calls += 1;
    return result(calls === 1
      ? validProblem({ canonicalProblem: "Night-shift childcare remains unavailable?" })
      : validProblem());
  })));
  assert.equal(calls, 2);
  assert.equal(report.accepted, 1);
  assert.equal(report.failed, 0);
  assert.equal(report.retries, 1);
  assert.equal(report.totalTokens, 280);
  assert.equal(report.estimatedCost, 0.02);
});

test("dry run leaves raw signals and mentions untouched, and zero cost prevents calls", async () => {
  const fake = new FakeResearchDb();
  await seed(fake);
  let calls = 0;
  const extractionClient = client(async () => {
    calls += 1;
    return result(validProblem());
  });
  const dry = await runExtractionPipeline({ limit: 1, dryRun: true }, dependencies(fake, extractionClient));
  assert.equal(dry.accepted, 1);
  assert.equal(fake.rawSignals.documents[0].processingStatus, "pending");
  assert.equal(fake.problemMentions.documents.length, 0);

  const stopped = await runExtractionPipeline({ limit: 1, maximumCost: 0 }, dependencies(fake, extractionClient));
  assert.equal(stopped.costLimitReached, true);
  assert.equal(stopped.attempted, 0);
  assert.equal(calls, 1);
});
