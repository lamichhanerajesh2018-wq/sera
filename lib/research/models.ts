import type { Db, IndexSpecification } from "mongodb";
import type {
  CollectionRunDocument,
  ExtractionRunDocument,
  DeduplicationDecisionDocument,
  DeduplicationRunDocument,
  CorrectionAuditDocument,
  EvaluationItemDocument,
  EvaluationRunDocument,
  HumanReviewDocument,
  ProblemMentionDocument,
  RawSignalDocument,
  UniqueProblemDocument,
  ReadinessReportDocument,
} from "./types.ts";

export const RAW_SIGNALS_COLLECTION = "research_raw_signals";
export const COLLECTION_RUNS_COLLECTION = "research_collection_runs";
export const PROBLEM_MENTIONS_COLLECTION = "research_problem_mentions";
export const EXTRACTION_RUNS_COLLECTION = "research_extraction_runs";
export const UNIQUE_PROBLEMS_COLLECTION = "research_unique_problems";
export const DEDUPLICATION_DECISIONS_COLLECTION = "research_deduplication_decisions";
export const DEDUPLICATION_RUNS_COLLECTION = "research_deduplication_runs";
export const HUMAN_REVIEWS_COLLECTION = "research_human_reviews";
export const CORRECTION_AUDITS_COLLECTION = "research_correction_audits";
export const EVALUATION_ITEMS_COLLECTION = "research_evaluation_items";
export const EVALUATION_RUNS_COLLECTION = "research_evaluation_runs";
export const READINESS_REPORTS_COLLECTION = "research_readiness_reports";

const RAW_SIGNAL_INDEXES: Array<{ key: IndexSpecification; options?: Record<string, unknown> }> = [
  { key: { source: 1, sourceId: 1 }, options: { unique: true, name: "source_sourceId_unique" } },
  { key: { contentHash: 1 }, options: { unique: true, name: "contentHash_unique" } },
  { key: { processingStatus: 1 }, options: { name: "processingStatus" } },
  { key: { source: 1 }, options: { name: "source" } },
  { key: { sourceCommunity: 1 }, options: { sparse: true, name: "sourceCommunity" } },
  { key: { collectedAt: -1 }, options: { name: "collectedAt" } },
  { key: { publishedAt: -1 }, options: { sparse: true, name: "publishedAt" } },
  { key: { geographyEvidence: 1 }, options: { name: "geographyEvidence" } },
  { key: { industrySeed: 1 }, options: { sparse: true, name: "industrySeed" } },
  { key: { collectionRunId: 1 }, options: { sparse: true, name: "collectionRunId" } },
  { key: { source: 1, "metadata.product": 1 }, options: { sparse: true, name: "source_cfpb_product" } },
  { key: { source: 1, "metadata.issue": 1 }, options: { sparse: true, name: "source_cfpb_issue" } },
  { key: { source: 1, "metadata.state": 1 }, options: { sparse: true, name: "source_cfpb_state" } },
  { key: { title: "text", body: "text", sourceId: "text" }, options: { name: "admin_signal_text", default_language: "none", language_override: "researchTextLanguage" } },
  { key: { source: 1, processingStatus: 1, createdAt: -1, _id: -1 }, options: { name: "admin_signal_filters" } },
];

const COLLECTION_RUN_INDEXES: Array<{ key: IndexSpecification; options?: Record<string, unknown> }> = [
  { key: { source: 1 }, options: { name: "source" } },
  { key: { status: 1 }, options: { name: "status" } },
  { key: { startedAt: -1 }, options: { name: "startedAt" } },
  { key: { completedAt: -1 }, options: { sparse: true, name: "completedAt" } },
];

const PROBLEM_MENTION_INDEXES: Array<{ key: IndexSpecification; options?: Record<string, unknown> }> = [
  { key: { rawSignalId: 1 }, options: { unique: true, name: "rawSignalId_unique" } },
  { key: { extractionRunId: 1 }, options: { name: "extractionRunId" } },
  { key: { status: 1 }, options: { name: "status" } },
  { key: { industry: 1 }, options: { sparse: true, name: "industry" } },
  { key: { affectedUser: 1 }, options: { sparse: true, name: "affectedUser" } },
  { key: { problemType: 1 }, options: { name: "problemType" } },
  { key: { geography: 1 }, options: { name: "geography" } },
  { key: { source: 1 }, options: { name: "source" } },
  { key: { createdAt: -1 }, options: { name: "createdAt" } },
  { key: { uniqueProblemId: 1 }, options: { sparse: true, name: "uniqueProblemId" } },
  { key: { deduplicationStatus: 1 }, options: { sparse: true, name: "deduplicationStatus" } },
  { key: { deduplicationRunId: 1 }, options: { sparse: true, name: "deduplicationRunId" } },
  { key: { canonicalProblem: "text", shortLabel: "text" }, options: { name: "admin_mention_text", default_language: "none", language_override: "researchTextLanguage" } },
  { key: { status: 1, source: 1, createdAt: -1, _id: -1 }, options: { name: "admin_mention_filters" } },
];

const EXTRACTION_RUN_INDEXES: Array<{ key: IndexSpecification; options?: Record<string, unknown> }> = [
  { key: { status: 1 }, options: { name: "status" } },
  { key: { model: 1 }, options: { name: "model" } },
  { key: { startedAt: -1 }, options: { name: "startedAt" } },
  { key: { completedAt: -1 }, options: { sparse: true, name: "completedAt" } },
];

const UNIQUE_PROBLEM_INDEXES: Array<{ key: IndexSpecification; options?: Record<string, unknown> }> = [
  { key: { normalizedKey: 1 }, options: { unique: true, name: "normalizedKey_unique" } },
  { key: { industry: 1 }, options: { name: "industry" } },
  { key: { subIndustries: 1 }, options: { name: "subIndustries" } },
  { key: { affectedUsers: 1 }, options: { name: "affectedUsers" } },
  { key: { problemTypes: 1 }, options: { name: "problemTypes" } },
  { key: { geography: 1 }, options: { name: "geography" } },
  { key: { mentionCount: -1 }, options: { name: "mentionCount" } },
  { key: { sourceCount: -1 }, options: { name: "sourceCount" } },
  { key: { firstSeenAt: -1 }, options: { name: "firstSeenAt" } },
  { key: { lastSeenAt: -1 }, options: { name: "lastSeenAt" } },
  { key: { status: 1 }, options: { name: "status" } },
  { key: { embeddingModel: 1, embeddingDimensions: 1, embeddingVersion: 1 }, options: { name: "embedding_compatibility" } },
  { key: { canonicalProblem: "text", shortLabel: "text" }, options: { name: "admin_unique_text", default_language: "none", language_override: "researchTextLanguage" } },
  { key: { status: 1, mentionCount: -1, _id: -1 }, options: { name: "admin_unique_filters" } },
];

const DEDUPLICATION_DECISION_INDEXES: Array<{ key: IndexSpecification; options?: Record<string, unknown> }> = [
  { key: { mentionId: 1 }, options: { name: "mentionId" } },
  { key: { candidateUniqueProblemId: 1 }, options: { sparse: true, name: "candidateUniqueProblemId" } },
  { key: { deduplicationRunId: 1 }, options: { name: "deduplicationRunId" } },
  { key: { decision: 1 }, options: { name: "decision" } },
  { key: { processedAt: -1 }, options: { name: "processedAt" } },
];

const DEDUPLICATION_RUN_INDEXES: Array<{ key: IndexSpecification; options?: Record<string, unknown> }> = [
  { key: { status: 1 }, options: { name: "status" } },
  { key: { embeddingModel: 1, embeddingVersion: 1 }, options: { name: "embedding_model_version" } },
  { key: { startedAt: -1 }, options: { name: "startedAt" } },
  { key: { completedAt: -1 }, options: { sparse: true, name: "completedAt" } },
];

const HUMAN_REVIEW_INDEXES: Array<{ key: IndexSpecification; options?: Record<string, unknown> }> = [
  { key: { targetType: 1, targetId: 1, reviewRound: 1 }, options: { unique: true, name: "target_round_unique" } },
  { key: { reviewStatus: 1 }, options: { name: "reviewStatus" } },
  { key: { reviewerDecision: 1 }, options: { sparse: true, name: "reviewerDecision" } },
  { key: { reviewedAt: -1 }, options: { sparse: true, name: "reviewedAt" } },
  { key: { sourceModel: 1 }, options: { sparse: true, name: "sourceModel" } },
  { key: { sourcePromptVersion: 1 }, options: { sparse: true, name: "sourcePromptVersion" } },
  { key: { sourceEmbeddingVersion: 1 }, options: { sparse: true, name: "sourceEmbeddingVersion" } },
  { key: { sourceJudgePromptVersion: 1 }, options: { sparse: true, name: "sourceJudgePromptVersion" } },
  { key: { riskScore: -1, createdAt: 1 }, options: { name: "review_priority" } },
];

const CORRECTION_AUDIT_INDEXES: Array<{ key: IndexSpecification; options?: Record<string, unknown> }> = [
  { key: { reviewId: 1 }, options: { unique: true, name: "reviewId_unique" } },
  { key: { targetType: 1, targetId: 1 }, options: { name: "target" } },
  { key: { appliedAt: -1 }, options: { name: "appliedAt" } },
];

const EVALUATION_ITEM_INDEXES: Array<{ key: IndexSpecification; options?: Record<string, unknown> }> = [
  { key: { datasetVersion: 1 }, options: { name: "datasetVersion" } },
  { key: { datasetVersion: 1, targetType: 1, safeSourceExcerpt: 1 }, options: { unique: true, name: "dataset_item_unique" } },
  { key: { sourceCategory: 1 }, options: { name: "sourceCategory" } },
  { key: { difficulty: 1 }, options: { name: "difficulty" } },
];

const EVALUATION_RUN_INDEXES: Array<{ key: IndexSpecification; options?: Record<string, unknown> }> = [
  { key: { evaluationType: 1 }, options: { name: "evaluationType" } },
  { key: { completedAt: -1 }, options: { name: "completedAt" } },
];

const READINESS_REPORT_INDEXES: Array<{ key: IndexSpecification; options?: Record<string, unknown> }> = [
  { key: { status: 1 }, options: { name: "status" } },
  { key: { generatedAt: -1 }, options: { name: "generatedAt" } },
];

export function rawSignalsCollection(db: Db) {
  return db.collection<RawSignalDocument>(RAW_SIGNALS_COLLECTION);
}

export function collectionRunsCollection(db: Db) {
  return db.collection<CollectionRunDocument>(COLLECTION_RUNS_COLLECTION);
}

export function problemMentionsCollection(db: Db) {
  return db.collection<ProblemMentionDocument>(PROBLEM_MENTIONS_COLLECTION);
}

export function extractionRunsCollection(db: Db) {
  return db.collection<ExtractionRunDocument>(EXTRACTION_RUNS_COLLECTION);
}

export function uniqueProblemsCollection(db: Db) {
  return db.collection<UniqueProblemDocument>(UNIQUE_PROBLEMS_COLLECTION);
}

export function deduplicationDecisionsCollection(db: Db) {
  return db.collection<DeduplicationDecisionDocument>(DEDUPLICATION_DECISIONS_COLLECTION);
}

export function deduplicationRunsCollection(db: Db) {
  return db.collection<DeduplicationRunDocument>(DEDUPLICATION_RUNS_COLLECTION);
}

export function humanReviewsCollection(db: Db) { return db.collection<HumanReviewDocument>(HUMAN_REVIEWS_COLLECTION); }
export function correctionAuditsCollection(db: Db) { return db.collection<CorrectionAuditDocument>(CORRECTION_AUDITS_COLLECTION); }
export function evaluationItemsCollection(db: Db) { return db.collection<EvaluationItemDocument>(EVALUATION_ITEMS_COLLECTION); }
export function evaluationRunsCollection(db: Db) { return db.collection<EvaluationRunDocument>(EVALUATION_RUNS_COLLECTION); }
export function readinessReportsCollection(db: Db) { return db.collection<ReadinessReportDocument>(READINESS_REPORTS_COLLECTION); }

export async function ensureResearchIndexes(db: Db): Promise<void> {
  await Promise.all([
    ...RAW_SIGNAL_INDEXES.map(({ key, options }) =>
      rawSignalsCollection(db).createIndex(key, options),
    ),
    ...COLLECTION_RUN_INDEXES.map(({ key, options }) =>
      collectionRunsCollection(db).createIndex(key, options),
    ),
    ...PROBLEM_MENTION_INDEXES.map(({ key, options }) =>
      problemMentionsCollection(db).createIndex(key, options),
    ),
    ...EXTRACTION_RUN_INDEXES.map(({ key, options }) =>
      extractionRunsCollection(db).createIndex(key, options),
    ),
    ...UNIQUE_PROBLEM_INDEXES.map(({ key, options }) =>
      uniqueProblemsCollection(db).createIndex(key, options),
    ),
    ...DEDUPLICATION_DECISION_INDEXES.map(({ key, options }) =>
      deduplicationDecisionsCollection(db).createIndex(key, options),
    ),
    ...DEDUPLICATION_RUN_INDEXES.map(({ key, options }) =>
      deduplicationRunsCollection(db).createIndex(key, options),
    ),
    ...HUMAN_REVIEW_INDEXES.map(({ key, options }) => humanReviewsCollection(db).createIndex(key, options)),
    ...CORRECTION_AUDIT_INDEXES.map(({ key, options }) => correctionAuditsCollection(db).createIndex(key, options)),
    ...EVALUATION_ITEM_INDEXES.map(({ key, options }) => evaluationItemsCollection(db).createIndex(key, options)),
    ...EVALUATION_RUN_INDEXES.map(({ key, options }) => evaluationRunsCollection(db).createIndex(key, options)),
    ...READINESS_REPORT_INDEXES.map(({ key, options }) => readinessReportsCollection(db).createIndex(key, options)),
  ]);
}
