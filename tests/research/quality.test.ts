/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "mongodb";
import { getQualityConfig } from "../../lib/research/config.ts";
import { buildNormalizedProblemKey } from "../../lib/research/deduplication/text.ts";
import { auditClusters, auditQuality } from "../../lib/research/quality/audit.ts";
import { evaluateDeduplication, evaluateExtraction, evaluateGeography } from "../../lib/research/quality/evaluation.ts";
import {
  confusionMatrix,
  fieldAccuracy,
  reviewerAgreement,
  thresholdCalibration,
} from "../../lib/research/quality/metrics.ts";
import { evaluateReadinessGates } from "../../lib/research/quality/readiness.ts";
import { QualityRepository } from "../../lib/research/quality/repository.ts";
import { evaluationItemSchema, parseReviewSubmission } from "../../lib/research/quality/schema.ts";
import { exportReviews, generateReviewQueue, rowsToCsv } from "../../lib/research/quality/service.ts";
import type {
  DeduplicationDecisionDocument,
  HumanReviewDocument,
  ProblemMentionDocument,
  UniqueProblemDocument,
} from "../../lib/research/types.ts";
import { FakeResearchDb } from "./fake-db.ts";
import { signal } from "./extraction-fixtures.ts";

const now = new Date("2026-07-13T12:00:00Z");

function mention(overrides: Partial<ProblemMentionDocument> = {}): ProblemMentionDocument {
  return {
    _id: new ObjectId(), rawSignalId: new ObjectId(), extractionRunId: new ObjectId(),
    source: "reddit", sourceCommunity: "Parenting", containsProblem: true, status: "accepted",
    canonicalProblem: "Parents working overnight shifts struggle to find childcare because providers close too early.",
    shortLabel: "Overnight childcare", industry: "Childcare", subIndustry: null,
    affectedUser: "Parents", affectedRole: null, organizationType: null,
    workflow: "find overnight childcare", problemType: "availability", currentWorkaround: null,
    triggeringSituation: "overnight shifts", desiredOutcome: null, negativeConsequence: null,
    geography: "unknown", evidenceText: "cannot find childcare that stays open late",
    extractionConfidence: 0.9, rejectionReason: null, model: "extractor", promptVersion: "problem-extraction-v1",
    createdAt: now, updatedAt: now, ...overrides,
  };
}

function uniqueProblem(source: ProblemMentionDocument, overrides: Partial<UniqueProblemDocument> = {}): UniqueProblemDocument {
  return {
    _id: new ObjectId(), canonicalProblem: source.canonicalProblem, shortLabel: source.shortLabel,
    industry: source.industry || "Unclassified", subIndustries: [], affectedUsers: [source.affectedUser!],
    affectedRoles: [], organizationTypes: [], workflows: [source.workflow!], problemTypes: [source.problemType],
    currentWorkarounds: [], triggeringSituations: [], desiredOutcomes: [], negativeConsequences: [],
    geography: "unknown", normalizedKey: buildNormalizedProblemKey(source), embedding: [1, 0],
    embeddingModel: "embed", embeddingDimensions: 2, embeddingVersion: "problem-embedding-v1",
    mentionCount: 1, evidenceCount: 1, sourceCount: 1, sources: [source.source],
    communities: [source.sourceCommunity!], averageConfidence: source.extractionConfidence,
    highestConfidence: source.extractionConfidence, firstSeenAt: now, lastSeenAt: now,
    status: "active", createdAt: now, updatedAt: now, ...overrides,
  };
}

function decision(value: ProblemMentionDocument, candidate: UniqueProblemDocument): DeduplicationDecisionDocument {
  return {
    _id: new ObjectId(), mentionId: value._id!, candidateUniqueProblemId: candidate._id,
    finalUniqueProblemId: candidate._id, similarity: 0.79, decision: "same_problem",
    decisionConfidence: 0.9, reason: "Grounded comparison", finalAction: "merged_existing",
    model: "judge", promptVersion: "duplicate-judge-v1", deduplicationRunId: new ObjectId(),
    processedAt: now, createdAt: now,
  };
}

async function seedMention(fake: FakeResearchDb, value: ProblemMentionDocument) {
  const index = fake.rawSignals.documents.length + 1;
  const raw = signal({
    _id: value.rawSignalId, sourceId: `quality-${index}`, contentHash: `quality-hash-${index}`,
    body: `I work nights and ${value.evidenceText}, so I wait for family help.`,
  });
  await fake.rawSignals.insertOne(raw as any);
  value.rawSignalId = raw._id!;
  await fake.problemMentions.insertOne(value as any);
  return raw;
}

test("review queue prioritizes risky cases and is idempotent", async () => {
  const fake = new FakeResearchDb();
  const risky = mention({ status: "needs_review", extractionConfidence: 0.56, canonicalProblem: "Parents struggle with overnight childcare availability." });
  const easy = mention({ _id: new ObjectId(), rawSignalId: new ObjectId(), extractionConfidence: 0.98 });
  await seedMention(fake, risky);
  await seedMention(fake, easy);
  const options = { sampleSize: 1, seed: "fixed", targetType: "problem_mention" as const };
  const first = await generateReviewQueue(options, fake.asDb());
  assert.equal(first.created, 1);
  assert.equal(first.selected[0].targetId.toString(), risky._id?.toString());
  const second = await generateReviewQueue(options, fake.asDb());
  assert.equal(second.existing, 1);
  assert.equal(fake.humanReviews.documents.length, 1);
});

test("stratified sampling covers sources instead of only easy high-confidence records", async () => {
  const fake = new FakeResearchDb();
  await seedMention(fake, mention({ source: "reddit" }));
  await seedMention(fake, mention({ _id: new ObjectId(), rawSignalId: new ObjectId(), source: "forum", sourceCommunity: undefined }));
  const result = await generateReviewQueue({ sampleSize: 2, seed: "strata", stratified: true }, fake.asDb());
  assert.equal(result.selected.length, 2);
  assert.equal(new Set(result.selected.flatMap((item) => item.strata).filter((item) => item.startsWith("source:"))).size, 2);
});

test("duplicate review rounds are prevented while explicit second review is allowed", async () => {
  const fake = new FakeResearchDb();
  const value = mention();
  await seedMention(fake, value);
  const repository = new QualityRepository(fake.asDb());
  await repository.generateQueue({ sampleSize: 1, seed: "one", targetType: "problem_mention", reviewRound: 1 });
  await repository.generateQueue({ sampleSize: 1, seed: "two", targetType: "problem_mention", reviewRound: 1 });
  await repository.generateQueue({ sampleSize: 1, seed: "three", targetType: "problem_mention", reviewRound: 2 });
  assert.equal(fake.humanReviews.documents.length, 2);
});

test("review submission and corrected fields are strictly validated", () => {
  assert.equal(parseReviewSubmission({ reviewerDecision: "correct" }).reviewerDecision, "correct");
  assert.throws(() => parseReviewSubmission({ reviewerDecision: "wrong" }), /Invalid option/);
  assert.throws(() => parseReviewSubmission({
    reviewerDecision: "incorrect", correctedValues: { canonicalProblem: "Build an AI childcare app immediately." },
  }), /solution-neutral/);
  assert.throws(() => parseReviewSubmission({ reviewerDecision: "incorrect", reasonCodes: ["made_up_reason"] }), /Invalid option/);
});

test("review export is privacy-safe JSON/CSV and omits embeddings and authors", async () => {
  const fake = new FakeResearchDb();
  const value = mention({ embedding: [1, 2], embeddingModel: "embed", embeddingDimensions: 2, embeddingVersion: "v1" });
  await seedMention(fake, value);
  await generateReviewQueue({ sampleSize: 1, seed: "export", targetType: "problem_mention" }, fake.asDb());
  const rows = await exportReviews(fake.asDb());
  const serialized = JSON.stringify(rows);
  assert.doesNotMatch(serialized, /\[1,2\]|authorName|authorId/);
  assert.match(rowsToCsv(rows), /canonicalProblem/);
});

test("review import validates targets, supports dry-run, and reports partial failures", async () => {
  const fake = new FakeResearchDb();
  await seedMention(fake, mention());
  await generateReviewQueue({ sampleSize: 1, seed: "import", targetType: "problem_mention" }, fake.asDb());
  const repository = new QualityRepository(fake.asDb());
  const reviewId = fake.humanReviews.documents[0]!._id!.toString();
  const items = [
    { reviewId, submission: { reviewerDecision: "correct", extractionDecision: "valid_problem" } },
    { reviewId: new ObjectId().toString(), submission: { reviewerDecision: "correct" } },
  ];
  const dry = await repository.importReviews(items, true);
  assert.deepEqual({ valid: dry.valid, imported: dry.imported, failed: dry.failed }, { valid: 1, imported: 0, failed: 1 });
  assert.equal(fake.humanReviews.documents[0].reviewStatus, "pending");
  const applied = await repository.importReviews(items.slice(0, 1), false);
  assert.equal(applied.imported, 1);
  assert.equal(fake.humanReviews.documents[0].reviewStatus, "completed");
});

test("approved corrections preserve audit history and mark meaning-changing clusters for re-evaluation", async () => {
  const fake = new FakeResearchDb();
  const value = mention();
  await seedMention(fake, value);
  const problem = uniqueProblem(value);
  await fake.uniqueProblems.insertOne(problem as any);
  value.uniqueProblemId = problem._id;
  value.deduplicationStatus = "merged_existing";
  const review: HumanReviewDocument = {
    _id: new ObjectId(), targetType: "problem_mention", targetId: value._id!, reviewRound: 1,
    reviewStatus: "completed", reviewerDecision: "incorrect",
    correctedValues: { canonicalProblem: "Parents on overnight shifts cannot find childcare because providers close before work ends." },
    riskScore: 2, strata: [], reviewedAt: now, createdAt: now, updatedAt: now,
  };
  await fake.humanReviews.insertOne(review as any);
  const audit = await new QualityRepository(fake.asDb()).applyCorrections(review._id!, "reviewer-1");
  assert.equal(audit.previousValues.canonicalProblem, "Parents working overnight shifts struggle to find childcare because providers close too early.");
  assert.equal(audit.meaningChanged, true);
  assert.equal(value.deduplicationStatus, "needs_review");
  assert.equal(value.embedding, undefined);
  assert.equal(problem.status, "needs_review");
  await assert.rejects(new QualityRepository(fake.asDb()).applyCorrections(review._id!), /already applied/);
});

test("evaluation dataset versions are strict and model output is not implicit ground truth", () => {
  assert.equal(evaluationItemSchema.parse({
    datasetVersion: "extraction-gold-v1", targetType: "raw_signal", safeSourceExcerpt: "Giveaway",
    expectedContainsProblem: false, sourceCategory: "fixture", difficulty: "easy",
    annotationVersion: "human-v1", reviewerAgreement: 1,
  }).datasetVersion, "extraction-gold-v1");
  assert.throws(() => evaluationItemSchema.parse({
    datasetVersion: "latest", targetType: "raw_signal", safeSourceExcerpt: "x",
    sourceCategory: "fixture", difficulty: "easy", annotationVersion: "human-v1", reviewerAgreement: 1,
  }), /Invalid string/);
});

test("confusion matrix, precision, recall, F1, field accuracy, and zero division are correct", () => {
  const metrics = confusionMatrix([
    { expected: true, predicted: true }, { expected: true, predicted: false },
    { expected: false, predicted: true }, { expected: false, predicted: false },
  ]);
  assert.deepEqual({ tp: metrics.truePositive, fp: metrics.falsePositive, tn: metrics.trueNegative, fn: metrics.falseNegative }, { tp: 1, fp: 1, tn: 1, fn: 1 });
  assert.equal(metrics.precision, 0.5);
  assert.equal(metrics.recall, 0.5);
  assert.equal(metrics.f1, 0.5);
  assert.equal(confusionMatrix([]).f1, 0);
  assert.equal(fieldAccuracy(["correct", "unsupported", "incorrect"]).accuracy, 1 / 3);
});

test("fixture extraction, geography, deduplication, and similarity-bucket metrics calculate correctly", () => {
  const base = {
    _id: new ObjectId(), datasetVersion: "gold-v1", targetType: "raw_signal" as const,
    safeSourceExcerpt: "safe", sourceCategory: "fixture", difficulty: "easy" as const,
    annotationVersion: "human-v1", reviewerAgreement: 1, createdAt: now, updatedAt: now,
  };
  const extraction = evaluateExtraction([
    { item: { ...base, expectedContainsProblem: true }, prediction: { containsProblem: true, confidence: 0.9 } },
    { item: { ...base, expectedContainsProblem: false }, prediction: { containsProblem: false, confidence: 0.9 } },
  ]);
  assert.equal(extraction.f1, 1);
  assert.equal(evaluateGeography([{ item: { ...base, expectedGeography: "unknown" }, prediction: { geography: "unknown" } }]).accuracy, 1);
  const dedup = evaluateDeduplication([{
    item: { ...base, targetType: "deduplication_decision", expectedDeduplicationDecision: "same_problem" },
    prediction: { deduplicationDecision: "same_problem", similarity: 0.91, judgeConfidence: 0.95 },
  }]);
  assert.equal(dedup.mergePrecision, 1);
  assert.ok("0.9-1.0" in dedup.bySimilarityBucket);
});

test("threshold calibration recommends without mutating configuration", () => {
  const result = thresholdCalibration([
    { score: 0.95, expectedPositive: true }, { score: 0.9, expectedPositive: true },
    { score: 0.8, expectedPositive: false }, { score: 0.6, expectedPositive: false },
  ], 0.7);
  assert.deepEqual(result.recommendedThresholdRange, [0.9, 0.9500000000000001]);
  assert.equal(result.recommendationConfidence, "low");
  assert.equal(result.currentThreshold, 0.7);
});

test("reviewer agreement and Cohen's kappa expose disagreement", () => {
  const result = reviewerAgreement([
    { item: "a", reviewer: "one", label: "correct" }, { item: "a", reviewer: "two", label: "correct" },
    { item: "b", reviewer: "one", label: "correct" }, { item: "b", reviewer: "two", label: "incorrect" },
  ]);
  assert.equal(result.agreement, 0.5);
  assert.equal(result.disagreementRate, 0.5);
  assert.ok(result.cohensKappa < 0.5);
  assert.deepEqual(reviewerAgreement([]), {
    comparableItems: 0, agreement: 0, disagreementRate: 0, cohensKappa: 0,
  });
  assert.equal(reviewerAgreement([
    { item: "a", reviewer: "one", label: "correct" },
    { item: "a", reviewer: "two", label: "correct" },
  ]).cohensKappa, 1);
});

test("quality audit detects ungrounded evidence, counter mismatches, orphans, incompatible vectors, and remains report-only", async () => {
  const fake = new FakeResearchDb();
  const value = mention({ embedding: [1, 0], embeddingModel: "old", embeddingDimensions: 2, embeddingVersion: "old" });
  await seedMention(fake, value);
  value.evidenceText = "invented evidence";
  const problem = uniqueProblem(value, { mentionCount: 5, evidenceCount: 4, sourceCount: 2 });
  await fake.uniqueProblems.insertOne(problem as any);
  value.uniqueProblemId = problem._id;
  await fake.deduplicationDecisions.insertOne(decision(value, problem) as any);
  const before = JSON.stringify(fake.problemMentions.documents);
  const audit = await auditQuality(fake.asDb());
  const codes = new Set(audit.findings.map((item) => item.code));
  assert.ok(codes.has("evidence_not_grounded"));
  assert.ok(codes.has("mention_count_mismatch"));
  assert.ok(codes.has("source_count_mismatch"));
  assert.ok(codes.has("decision_missing_run"));
  assert.equal(audit.reportOnly, true);
  assert.equal(JSON.stringify(fake.problemMentions.documents), before);
});

test("cluster audit flags suspicious over-merged and single-source clusters", async () => {
  const fake = new FakeResearchDb();
  const value = mention();
  await seedMention(fake, value);
  const problem = uniqueProblem(value, { mentionCount: 30, sourceCount: 1 });
  await fake.uniqueProblems.insertOne(problem as any);
  value.uniqueProblemId = problem._id;
  const result = await auditClusters(fake.asDb(), 1);
  assert.ok(result.clusters[0].flags.includes("possibly_over_merged"));
  assert.ok(result.clusters[0].flags.includes("single_source_concentration"));
});

test("readiness gates pass, fail, and refuse readiness with insufficient review data", () => {
  const config = getQualityConfig({ RESEARCH_QUALITY_MIN_REVIEWED_SAMPLE: "2" });
  const good = {
    reviewedSampleSize: 2, extractionPrecision: 0.95, extractionRecall: 0.9,
    groundingAccuracy: 0.98, unsupportedFieldRate: 0.01, mergePrecision: 0.98,
    promptInjectionFailureRate: 0, criticalAuditFindings: 0,
  };
  assert.equal(evaluateReadinessGates(good, config).status, "READY");
  assert.equal(evaluateReadinessGates({ ...good, extractionPrecision: 0.5 }, config).status, "NOT_READY");
  assert.equal(evaluateReadinessGates({ ...good, reviewedSampleSize: 1 }, config).status, "INSUFFICIENT_REVIEW_DATA");
});
