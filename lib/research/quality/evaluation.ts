import type { Db } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import { evaluationRunsCollection } from "../models.ts";
import type { EvaluationItemDocument } from "../types.ts";
import { confusionMatrix, deduplicationMetrics, fieldAccuracy, metricsByBucket, numericBucket } from "./metrics.ts";

export interface EvaluationPrediction {
  containsProblem?: boolean;
  fields?: Record<string, string | null>;
  geography?: string;
  deduplicationDecision?: string;
  confidence?: number;
  similarity?: number;
  judgeConfidence?: number;
  model?: string;
  promptVersion?: string;
  embeddingModel?: string;
  embeddingVersion?: string;
  duplicateJudgeModel?: string;
  duplicateJudgePromptVersion?: string;
  malformed?: boolean;
  groundingFailed?: boolean;
  solutionBiased?: boolean;
  promptInjectionFailed?: boolean;
}

export interface EvaluationPair {
  item: EvaluationItemDocument;
  prediction: EvaluationPrediction;
}

export function evaluateExtraction(pairs: EvaluationPair[]) {
  const eligible = pairs.filter(({ item }) => item.expectedContainsProblem !== undefined);
  const matrix = confusionMatrix(eligible.map(({ item, prediction }) => ({
    expected: item.expectedContainsProblem!, predicted: Boolean(prediction.containsProblem),
  })));
  const fields = [
    "canonicalProblem", "affectedUser", "industry", "workflow",
    "currentWorkaround", "negativeConsequence", "geography", "evidenceText",
  ];
  const fieldMetrics = Object.fromEntries(fields.map((field) => {
    const values = eligible.filter(({ item }) => item.expectedFields && field in item.expectedFields).map(({ item, prediction }) =>
      item.expectedFields?.[field] === prediction.fields?.[field] ? "correct" as const : "incorrect" as const);
    return [field, fieldAccuracy(values)];
  }));
  const count = eligible.length;
  return {
    ...matrix,
    acceptanceAccuracy: count ? eligible.filter(({ item, prediction }) => item.expectedContainsProblem && prediction.containsProblem).length /
      Math.max(1, eligible.filter(({ item }) => item.expectedContainsProblem).length) : 0,
    rejectionAccuracy: count ? eligible.filter(({ item, prediction }) => !item.expectedContainsProblem && !prediction.containsProblem).length /
      Math.max(1, eligible.filter(({ item }) => !item.expectedContainsProblem).length) : 0,
    needsReviewRate: eligible.filter(({ prediction }) => prediction.confidence !== undefined && prediction.confidence >= 0.55 && prediction.confidence < 0.75).length / Math.max(1, count),
    malformedOutputRate: eligible.filter(({ prediction }) => prediction.malformed).length / Math.max(1, count),
    groundingFailureRate: eligible.filter(({ prediction }) => prediction.groundingFailed).length / Math.max(1, count),
    evidenceAccuracy: (fieldMetrics.evidenceText as ReturnType<typeof fieldAccuracy>).accuracy,
    solutionBiasRate: eligible.filter(({ prediction }) => prediction.solutionBiased).length / Math.max(1, count),
    unsupportedFieldRate: eligible.filter(({ prediction }) => prediction.groundingFailed).length / Math.max(1, count),
    promptInjectionFailureRate: eligible.filter(({ prediction }) => prediction.promptInjectionFailed).length / Math.max(1, count),
    fieldMetrics,
    bySource: metricsByBucket(eligible, ({ item }) => item.sourceCategory, (items) => confusionMatrix(items.map(({ item, prediction }) => ({ expected: item.expectedContainsProblem!, predicted: Boolean(prediction.containsProblem) })))),
    byCommunity: metricsByBucket(eligible, ({ item }) => item.sourceCommunity || "unknown", (items) => confusionMatrix(items.map(({ item, prediction }) => ({ expected: item.expectedContainsProblem!, predicted: Boolean(prediction.containsProblem) })))),
    byIndustry: metricsByBucket(eligible, ({ item }) => item.industry || "unknown", (items) => confusionMatrix(items.map(({ item, prediction }) => ({ expected: item.expectedContainsProblem!, predicted: Boolean(prediction.containsProblem) })))),
    byConfidenceBucket: metricsByBucket(eligible, ({ prediction }) => numericBucket(prediction.confidence), (items) => confusionMatrix(items.map(({ item, prediction }) => ({ expected: item.expectedContainsProblem!, predicted: Boolean(prediction.containsProblem) })))),
    byModel: metricsByBucket(eligible, ({ prediction }) => prediction.model || "unknown", (items) => confusionMatrix(items.map(({ item, prediction }) => ({ expected: item.expectedContainsProblem!, predicted: Boolean(prediction.containsProblem) })))),
    byPromptVersion: metricsByBucket(eligible, ({ prediction }) => prediction.promptVersion || "unknown", (items) => confusionMatrix(items.map(({ item, prediction }) => ({ expected: item.expectedContainsProblem!, predicted: Boolean(prediction.containsProblem) })))),
    byGeographyClass: metricsByBucket(eligible, ({ item, prediction }) => item.expectedGeography || prediction.geography || "unknown", (items) => confusionMatrix(items.map(({ item, prediction }) => ({ expected: item.expectedContainsProblem!, predicted: Boolean(prediction.containsProblem) })))),
  };
}

export function evaluateGeography(pairs: EvaluationPair[]) {
  const eligible = pairs.filter(({ item }) => item.expectedGeography !== undefined);
  return {
    sampleSize: eligible.length,
    correct: eligible.filter(({ item, prediction }) => item.expectedGeography === prediction.geography).length,
    accuracy: eligible.filter(({ item, prediction }) => item.expectedGeography === prediction.geography).length / Math.max(1, eligible.length),
    byClass: metricsByBucket(eligible, ({ item }) => item.expectedGeography!, (items) => ({
      sampleSize: items.length,
      accuracy: items.filter(({ item, prediction }) => item.expectedGeography === prediction.geography).length / Math.max(1, items.length),
    })),
  };
}

export function evaluateDeduplication(pairs: EvaluationPair[]) {
  const eligible = pairs.filter(({ item }) => item.expectedDeduplicationDecision !== undefined);
  const observations = eligible.map(({ item, prediction }) => ({
    expectedSame: item.expectedDeduplicationDecision === "same_problem",
    predictedSame: prediction.deduplicationDecision === "same_problem",
    uncertain: prediction.deduplicationDecision === "uncertain",
    relatedExpected: item.expectedDeduplicationDecision === "related_but_distinct",
    relatedPredicted: prediction.deduplicationDecision === "related_but_distinct",
    similarity: prediction.similarity,
    judgeConfidence: prediction.judgeConfidence,
  }));
  return {
    ...deduplicationMetrics(observations),
    bySimilarityBucket: metricsByBucket(observations, (item) => numericBucket(item.similarity), deduplicationMetrics),
    byJudgeConfidenceBucket: metricsByBucket(observations, (item) => numericBucket(item.judgeConfidence), deduplicationMetrics),
    byIndustry: metricsByBucket(eligible, ({ item }) => item.industry || "unknown", (items) => deduplicationMetrics(items.map(({ item, prediction }) => ({
      expectedSame: item.expectedDeduplicationDecision === "same_problem",
      predictedSame: prediction.deduplicationDecision === "same_problem",
    })))),
    byAffectedUserCategory: metricsByBucket(eligible, ({ item }) => item.expectedFields?.affectedUser || "unknown", (items) => deduplicationMetrics(items.map(({ item, prediction }) => ({ expectedSame: item.expectedDeduplicationDecision === "same_problem", predictedSame: prediction.deduplicationDecision === "same_problem" })))),
    byEmbeddingModel: metricsByBucket(eligible, ({ prediction }) => prediction.embeddingModel || "unknown", (items) => deduplicationMetrics(items.map(({ item, prediction }) => ({ expectedSame: item.expectedDeduplicationDecision === "same_problem", predictedSame: prediction.deduplicationDecision === "same_problem" })))),
    byEmbeddingVersion: metricsByBucket(eligible, ({ prediction }) => prediction.embeddingVersion || "unknown", (items) => deduplicationMetrics(items.map(({ item, prediction }) => ({ expectedSame: item.expectedDeduplicationDecision === "same_problem", predictedSame: prediction.deduplicationDecision === "same_problem" })))),
    byDuplicateJudgeModel: metricsByBucket(eligible, ({ prediction }) => prediction.duplicateJudgeModel || "unknown", (items) => deduplicationMetrics(items.map(({ item, prediction }) => ({ expectedSame: item.expectedDeduplicationDecision === "same_problem", predictedSame: prediction.deduplicationDecision === "same_problem" })))),
    byDuplicateJudgePromptVersion: metricsByBucket(eligible, ({ prediction }) => prediction.duplicateJudgePromptVersion || "unknown", (items) => deduplicationMetrics(items.map(({ item, prediction }) => ({ expectedSame: item.expectedDeduplicationDecision === "same_problem", predictedSame: prediction.deduplicationDecision === "same_problem" })))),
  };
}

export async function runFixtureEvaluation(
  pairs: EvaluationPair[],
  type: "extraction" | "deduplication" | "geography" | "all",
  database: Db = defaultDb,
  saveRun = false,
) {
  const metrics = {
    ...(type === "extraction" || type === "all" ? { extraction: evaluateExtraction(pairs) } : {}),
    ...(type === "deduplication" || type === "all" ? { deduplication: evaluateDeduplication(pairs) } : {}),
    ...(type === "geography" || type === "all" ? { geography: evaluateGeography(pairs) } : {}),
  };
  if (saveRun) {
    const now = new Date();
    await evaluationRunsCollection(database).insertOne({
      evaluationType: type,
      datasetVersions: [...new Set(pairs.map(({ item }) => item.datasetVersion))],
      sampleSize: pairs.length,
      metrics,
      dryRun: true,
      startedAt: now,
      completedAt: now,
      createdAt: now,
    });
  }
  return metrics;
}

export function compareEvaluations(current: Record<string, unknown>, previous: Record<string, unknown>) {
  return { previous, current, note: "Comparison is descriptive; production thresholds are never changed automatically." };
}
