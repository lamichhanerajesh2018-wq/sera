import type { Db } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import {
  DUPLICATE_JUDGE_PROMPT_VERSION,
  EMBEDDING_TEXT_VERSION,
  EXTRACTION_PROMPT_VERSION,
  getQualityConfig,
} from "../config.ts";
import { deduplicationRunsCollection, extractionRunsCollection, readinessReportsCollection } from "../models.ts";
import { ResearchRepository } from "../repository.ts";
import type { ReadinessReportDocument } from "../types.ts";
import { auditQuality } from "./audit.ts";
import { calculateReviewMetrics } from "./service.ts";

export function evaluateReadinessGates(input: {
  reviewedSampleSize: number;
  extractionPrecision: number;
  extractionRecall: number;
  groundingAccuracy: number;
  unsupportedFieldRate: number;
  mergePrecision: number;
  promptInjectionFailureRate: number;
  criticalAuditFindings: number;
}, config = getQualityConfig()) {
  const gates: ReadinessReportDocument["gates"] = {
    extractionPrecision: { passed: input.extractionPrecision >= config.extractionPrecisionGate, actual: input.extractionPrecision, required: config.extractionPrecisionGate, comparator: "gte" },
    extractionRecall: { passed: input.extractionRecall >= config.extractionRecallGate, actual: input.extractionRecall, required: config.extractionRecallGate, comparator: "gte" },
    evidenceGroundingAccuracy: { passed: input.groundingAccuracy >= config.groundingAccuracyGate, actual: input.groundingAccuracy, required: config.groundingAccuracyGate, comparator: "gte" },
    unsupportedFieldRate: { passed: input.unsupportedFieldRate <= config.unsupportedFieldRateGate, actual: input.unsupportedFieldRate, required: config.unsupportedFieldRateGate, comparator: "lte" },
    duplicateMergePrecision: { passed: input.mergePrecision >= config.mergePrecisionGate, actual: input.mergePrecision, required: config.mergePrecisionGate, comparator: "gte" },
    promptInjectionFailureRate: { passed: input.promptInjectionFailureRate === config.promptInjectionFailureRateGate, actual: input.promptInjectionFailureRate, required: config.promptInjectionFailureRateGate, comparator: "eq" },
    criticalAuditFindings: { passed: input.criticalAuditFindings <= config.criticalAuditFindingsGate, actual: input.criticalAuditFindings, required: config.criticalAuditFindingsGate, comparator: "lte" },
    minimumReviewedSample: { passed: input.reviewedSampleSize >= config.minimumReviewedSample, actual: input.reviewedSampleSize, required: config.minimumReviewedSample, comparator: "gte" },
  };
  const status = input.reviewedSampleSize < config.minimumReviewedSample
    ? "INSUFFICIENT_REVIEW_DATA" as const
    : Object.values(gates).every((gate) => gate.passed) ? "READY" as const : "NOT_READY" as const;
  return { status, gates };
}

export async function generateReadinessReport(database: Db = defaultDb, save = true) {
  const config = getQualityConfig();
  const [stats, metrics, audit, extractionRuns, deduplicationRuns] = await Promise.all([
    new ResearchRepository(database).getResearchStats(),
    calculateReviewMetrics(database),
    auditQuality(database),
    extractionRunsCollection(database).find({}).toArray(),
    deduplicationRunsCollection(database).find({}).toArray(),
  ]);
  const allRuns = [...extractionRuns, ...deduplicationRuns];
  const runCosts = allRuns.map((run) => run.estimatedCost);
  const { status, gates } = evaluateReadinessGates({
    reviewedSampleSize: metrics.reviewedSampleSize,
    extractionPrecision: metrics.extraction.precision,
    extractionRecall: metrics.extraction.recall,
    groundingAccuracy: metrics.groundingAccuracy,
    unsupportedFieldRate: metrics.unsupportedFieldRate,
    mergePrecision: metrics.deduplication.mergePrecision,
    promptInjectionFailureRate: metrics.promptInjectionFailureRate,
    criticalAuditFindings: audit.totals.critical,
  }, config);
  const now = new Date();
  const report: ReadinessReportDocument = {
    status,
    reviewedSampleSize: metrics.reviewedSampleSize,
    gates,
    summary: {
      rawSignals: stats.totalRawSignals,
      extractionCoverage: stats.totalRawSignals ? stats.extraction.totalProblemMentions / stats.totalRawSignals : 0,
      acceptedProblems: stats.extraction.acceptedProblems,
      noProblemSignals: stats.extraction.noProblemSignals,
      needsReviewMentions: stats.extraction.needsReviewMentions,
      uniqueProblems: stats.deduplication.uniqueProblemCount,
      mergeRate: stats.deduplication.duplicateMergeRate,
      completedReviews: stats.quality.completedReviews,
      extractionPrecision: metrics.extraction.precision,
      extractionRecall: metrics.extraction.recall,
      extractionF1: metrics.extraction.f1,
      mergePrecision: metrics.deduplication.mergePrecision,
      duplicateRecall: metrics.deduplication.duplicateRecall,
      groundingAccuracy: metrics.groundingAccuracy,
      geographyAccuracy: metrics.fieldMetrics.geography,
      promptInjectionFailureRate: metrics.promptInjectionFailureRate,
      staleOrFailedRecords: stats.extraction.failedExtractions + stats.deduplication.failedCount
        + audit.findings.filter((item) => item.code === "stale_deduplication_processing" || item.code === "retry_limit_exceeded").length,
      sourceDiversity: Object.keys(stats.bySource).length,
      industryDiversity: Object.keys(stats.deduplication.byIndustry).length,
      vectorSearchStatus: "NOT_ACTIVE_APPLICATION_COSINE_FALLBACK",
      totalModelCost: stats.extraction.estimatedCost + stats.deduplication.estimatedCost,
      averageProcessingCost: runCosts.length ? runCosts.reduce((sum, value) => sum + value, 0) / runCosts.length : 0,
      maximumProcessingCost: runCosts.length ? Math.max(...runCosts) : 0,
      extractionModels: [...new Set(extractionRuns.map((run) => run.model))],
      duplicateJudgeModels: [...new Set(deduplicationRuns.map((run) => run.duplicateJudgeModel))],
      embeddingModels: [...new Set(deduplicationRuns.map((run) => run.embeddingModel))],
    },
    unresolvedIssues: audit.findings.filter((item) => item.severity === "critical").map((item) => `${item.code}: ${item.summary}`),
    configurationVersions: {
      extractionPrompt: EXTRACTION_PROMPT_VERSION,
      embeddingText: EMBEDDING_TEXT_VERSION,
      duplicateJudgePrompt: DUPLICATE_JUDGE_PROMPT_VERSION,
      qualityGates: config.qualityGatesVersion,
      reasonCodes: config.reasonCodesVersion,
    },
    generatedAt: now,
    createdAt: now,
  };
  if (save) await readinessReportsCollection(database).insertOne(report);
  return report;
}
