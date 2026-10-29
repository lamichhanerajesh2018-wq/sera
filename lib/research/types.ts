import type { ObjectId } from "mongodb";

export const RESEARCH_SOURCES = [
  "reddit",
  "cfpb",
  "nhtsa",
  "app_store",
  "google_play",
  "trustpilot",
  "forum",
  "youtube",
  "manual_import",
] as const;

export const GEOGRAPHY_EVIDENCE = [
  "explicit_us",
  "us_context",
  "unknown",
  "non_us",
] as const;

export const PROCESSING_STATUSES = [
  "pending",
  "processing",
  "processed",
  "no_problem",
  "failed",
  "ignored",
] as const;

export const COLLECTION_RUN_STATUSES = [
  "running",
  "completed",
  "partially_completed",
  "failed",
] as const;

export const PROBLEM_TYPES = [
  "time_waste", "high_cost", "manual_process", "complexity", "error_risk", "poor_access",
  "availability", "integration", "compliance", "communication", "reliability", "security",
  "quality", "other",
] as const;

export const PROBLEM_MENTION_STATUSES = ["accepted", "needs_review"] as const;
export const PROBLEM_GEOGRAPHIES = [
  "united_states", "likely_united_states", "unknown", "non_us",
] as const;
export const DEDUPLICATION_STATUSES = [
  "pending", "processing", "created_new", "merged_existing", "needs_review", "failed",
] as const;
export const UNIQUE_PROBLEM_STATUSES = ["active", "needs_review", "merged", "rejected"] as const;
export const UNIQUE_PROBLEM_GEOGRAPHIES = [
  "united_states", "likely_united_states", "unknown", "mixed",
] as const;
export const DUPLICATE_DECISIONS = [
  "same_problem", "related_but_distinct", "different_problem", "uncertain",
] as const;

export type ResearchSource = (typeof RESEARCH_SOURCES)[number];
export type GeographyEvidence = (typeof GEOGRAPHY_EVIDENCE)[number];
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];
export type CollectionRunStatus = (typeof COLLECTION_RUN_STATUSES)[number];
export type ProblemType = (typeof PROBLEM_TYPES)[number];
export type ProblemMentionStatus = (typeof PROBLEM_MENTION_STATUSES)[number];
export type ProblemGeography = (typeof PROBLEM_GEOGRAPHIES)[number];
export type DeduplicationStatus = (typeof DEDUPLICATION_STATUSES)[number];
export type UniqueProblemStatus = (typeof UNIQUE_PROBLEM_STATUSES)[number];
export type UniqueProblemGeography = (typeof UNIQUE_PROBLEM_GEOGRAPHIES)[number];
export type DuplicateDecision = (typeof DUPLICATE_DECISIONS)[number];

export interface RawSignalEngagement {
  score?: number;
  likes?: number;
  replies?: number;
  comments?: number;
  views?: number;
  rating?: number;
  upvoteRatio?: number;
}

export interface RawSignalDocument {
  _id?: ObjectId;
  source: ResearchSource;
  sourceId: string;
  sourceUrl: string;
  sourceCommunity?: string;
  title?: string;
  body: string;
  authorName?: string;
  authorId?: string;
  publishedAt?: Date;
  collectedAt: Date;
  language: string;
  targetCountry: "united_states";
  geographyEvidence: GeographyEvidence;
  industrySeed?: string;
  audienceSeed?: string;
  searchQuery?: string;
  engagement?: RawSignalEngagement;
  metadata?: Record<string, unknown>;
  contentHash: string;
  collectionRunId?: ObjectId;
  processingStatus: ProcessingStatus;
  retryCount: number;
  errorMessage?: string;
  rejectionReason?: string;
  processingStartedAt?: Date;
  processingWorkerId?: string;
  extractionRunId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProblemMentionDocument {
  _id?: ObjectId;
  rawSignalId: ObjectId;
  extractionRunId: ObjectId;
  source: ResearchSource;
  sourceCommunity?: string;
  containsProblem: true;
  status: ProblemMentionStatus;
  canonicalProblem: string;
  shortLabel: string;
  industry: string | null;
  subIndustry: string | null;
  affectedUser: string | null;
  affectedRole: string | null;
  organizationType: string | null;
  workflow: string | null;
  problemType: ProblemType;
  currentWorkaround: string | null;
  triggeringSituation: string | null;
  desiredOutcome: string | null;
  negativeConsequence: string | null;
  geography: ProblemGeography;
  evidenceText: string;
  extractionConfidence: number;
  rejectionReason: null;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  uniqueProblemId?: ObjectId;
  deduplicationStatus?: DeduplicationStatus;
  embedding?: number[];
  embeddingModel?: string;
  embeddingDimensions?: number;
  embeddingVersion?: string;
  candidateSimilarity?: number;
  duplicateDecision?: DuplicateDecision;
  duplicateDecisionConfidence?: number;
  deduplicationRunId?: ObjectId;
  deduplicationStartedAt?: Date;
  deduplicationWorkerId?: string;
  deduplicationRetryCount?: number;
  deduplicationError?: string;
  deduplicatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UniqueProblemDocument {
  _id?: ObjectId;
  canonicalProblem: string;
  shortLabel: string;
  industry: string;
  subIndustries: string[];
  affectedUsers: string[];
  affectedRoles: string[];
  organizationTypes: string[];
  workflows: string[];
  problemTypes: ProblemType[];
  currentWorkarounds: string[];
  triggeringSituations: string[];
  desiredOutcomes: string[];
  negativeConsequences: string[];
  geography: UniqueProblemGeography;
  normalizedKey: string;
  embedding: number[];
  embeddingModel: string;
  embeddingDimensions: number;
  embeddingVersion: string;
  mentionCount: number;
  evidenceCount: number;
  sourceCount: number;
  sources: ResearchSource[];
  communities: string[];
  averageConfidence: number;
  highestConfidence: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  status: UniqueProblemStatus;
  mergedIntoProblemId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeduplicationDecisionDocument {
  _id?: ObjectId;
  mentionId: ObjectId;
  candidateUniqueProblemId?: ObjectId;
  finalUniqueProblemId?: ObjectId;
  similarity?: number;
  decision: DuplicateDecision | "created_new";
  decisionConfidence?: number;
  reason: string;
  finalAction: "created_new" | "merged_existing" | "needs_review" | "failed";
  model?: string;
  promptVersion: string;
  previousCanonicalProblem?: string;
  newCanonicalProblem?: string;
  deduplicationRunId: ObjectId;
  processedAt: Date;
  createdAt: Date;
}

export interface DeduplicationRunDocument {
  _id?: ObjectId;
  startedAt: Date;
  completedAt?: Date;
  embeddingModel: string;
  duplicateJudgeModel: string;
  embeddingVersion: string;
  promptVersion: string;
  attemptedMentions: number;
  embeddingsGenerated: number;
  newUniqueProblems: number;
  mergedMentions: number;
  relatedButDistinctDecisions: number;
  differentProblemDecisions: number;
  uncertainReviewDecisions: number;
  failedCount: number;
  retryCount: number;
  embeddingTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  dryRun: boolean;
  status: CollectionRunStatus;
  configurationSnapshot: Record<string, unknown>;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const REVIEW_TARGET_TYPES = [
  "raw_signal", "problem_mention", "unique_problem", "deduplication_decision",
] as const;
export const REVIEW_STATUSES = ["pending", "in_review", "completed", "skipped"] as const;
export const REVIEWER_DECISIONS = ["correct", "incorrect", "partially_correct", "uncertain"] as const;
export const FIELD_REVIEW_VALUES = ["correct", "incorrect", "unsupported"] as const;
export const EXTRACTION_REVIEW_DECISIONS = ["valid_problem", "no_problem", "needs_review"] as const;
export const READINESS_STATUSES = ["READY", "NOT_READY", "INSUFFICIENT_REVIEW_DATA"] as const;

export type ReviewTargetType = (typeof REVIEW_TARGET_TYPES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type ReviewerDecision = (typeof REVIEWER_DECISIONS)[number];
export type FieldReviewValue = (typeof FIELD_REVIEW_VALUES)[number];
export type ExtractionReviewDecision = (typeof EXTRACTION_REVIEW_DECISIONS)[number];
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export interface HumanReviewDocument {
  _id?: ObjectId;
  targetType: ReviewTargetType;
  targetId: ObjectId;
  reviewRound: number;
  reviewStatus: ReviewStatus;
  reviewerDecision?: ReviewerDecision;
  extractionDecision?: ExtractionReviewDecision;
  deduplicationDecision?: DuplicateDecision;
  fieldReviews?: Partial<Record<
    "canonicalProblem" | "affectedUser" | "industry" | "workflow" | "workaround" |
    "consequence" | "geography" | "evidenceText",
    FieldReviewValue
  >>;
  correctedValues?: Partial<{
    canonicalProblem: string;
    affectedUser: string;
    industry: string;
    subIndustry: string;
    workflow: string;
    currentWorkaround: string;
    negativeConsequence: string;
    geography: ProblemGeography;
  }>;
  reasonCodes?: string[];
  reviewerNotes?: string;
  reviewerId?: string;
  reviewedAt?: Date;
  sourceModel?: string;
  sourcePromptVersion?: string;
  sourceEmbeddingVersion?: string;
  sourceJudgePromptVersion?: string;
  riskScore: number;
  strata: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CorrectionAuditDocument {
  _id?: ObjectId;
  reviewId: ObjectId;
  targetType: ReviewTargetType;
  targetId: ObjectId;
  previousValues: Record<string, unknown>;
  appliedValues: Record<string, unknown>;
  meaningChanged: boolean;
  appliedBy?: string;
  appliedAt: Date;
  createdAt: Date;
}

export interface EvaluationItemDocument {
  _id?: ObjectId;
  datasetVersion: string;
  targetType: ReviewTargetType;
  safeSourceExcerpt: string;
  expectedContainsProblem?: boolean;
  expectedFields?: Record<string, string | null>;
  expectedGeography?: ProblemGeography;
  expectedDeduplicationDecision?: DuplicateDecision;
  sourceCategory: string;
  sourceCommunity?: string;
  industry?: string;
  difficulty: "easy" | "medium" | "hard" | "adversarial";
  annotationVersion: string;
  reviewerAgreement: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvaluationRunDocument {
  _id?: ObjectId;
  evaluationType: "extraction" | "deduplication" | "geography" | "all";
  datasetVersions: string[];
  model?: string;
  promptVersion?: string;
  sampleSize: number;
  metrics: Record<string, unknown>;
  dryRun: boolean;
  startedAt: Date;
  completedAt: Date;
  createdAt: Date;
}

export interface ReadinessReportDocument {
  _id?: ObjectId;
  status: ReadinessStatus;
  reviewedSampleSize: number;
  gates: Record<string, { passed: boolean; actual: number; required: number; comparator: "gte" | "lte" | "eq" }>;
  summary: Record<string, unknown>;
  unresolvedIssues: string[];
  configurationVersions: Record<string, string>;
  generatedAt: Date;
  createdAt: Date;
}

export interface ExtractionRunDocument {
  _id?: ObjectId;
  startedAt: Date;
  completedAt?: Date;
  model: string;
  promptVersion: string;
  attemptedCount: number;
  acceptedProblemCount: number;
  noProblemCount: number;
  needsReviewCount: number;
  failedCount: number;
  retryCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  dryRun: boolean;
  status: CollectionRunStatus;
  configurationSnapshot: Record<string, unknown>;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionRunDocument {
  _id?: ObjectId;
  source: ResearchSource;
  collectorName: string;
  query?: string;
  sourceCommunity?: string;
  industrySeed?: string;
  audienceSeed?: string;
  startedAt: Date;
  completedAt?: Date;
  fetchedCount: number;
  insertedCount: number;
  duplicateCount: number;
  skippedCount: number;
  failedCount: number;
  status: CollectionRunStatus;
  dryRun: boolean;
  configurationSnapshot?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchInsertError {
  index: number;
  sourceId?: string;
  message: string;
  kind: "skipped" | "failed";
}

export interface BatchInsertResult {
  inserted: number;
  duplicate: number;
  skipped: number;
  failed: number;
  wouldInsert: number;
  errors: BatchInsertError[];
}

export interface ResearchStats {
  totalRawSignals: number;
  bySource: Record<string, number>;
  byProcessingStatus: Record<string, number>;
  byGeographyEvidence: Record<string, number>;
  byIndustrySeed: Record<string, number>;
  totalCollectionRuns: number;
  latestCollectionRun: Omit<CollectionRunDocument, "_id" | "configurationSnapshot"> | null;
  duplicateCount: number;
  failedRecordCount: number;
  reddit: {
    totalRawSignals: number;
    byCommunity: Record<string, number>;
    byGeographyEvidence: Record<string, number>;
    byProcessingStatus: Record<string, number>;
    latestCollectionRun: Omit<CollectionRunDocument, "_id" | "configurationSnapshot"> | null;
    duplicateCount: number;
    failedCollectionRuns: number;
  };
  cfpb: {
    totalRawSignals: number;
    byProduct: Record<string, number>;
    byIssue: Record<string, number>;
    byState: Record<string, number>;
    byGeographyEvidence: Record<string, number>;
    byProcessingStatus: Record<string, number>;
    latestCollectionRun: Omit<CollectionRunDocument, "_id" | "configurationSnapshot"> | null;
    duplicateCount: number;
    failedCollectionRuns: number;
  };
  extraction: {
    totalProblemMentions: number;
    acceptedProblems: number;
    noProblemSignals: number;
    needsReviewMentions: number;
    failedExtractions: number;
    byIndustry: Record<string, number>;
    byAffectedUser: Record<string, number>;
    byProblemType: Record<string, number>;
    bySource: Record<string, number>;
    geographyDistribution: Record<string, number>;
    averageConfidence: number;
    latestRun: Omit<ExtractionRunDocument, "_id" | "configurationSnapshot"> | null;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
  deduplication: {
    eligibleAcceptedMentions: number;
    waitingMentions: number;
    uniqueProblemCount: number;
    createdNewMentions: number;
    mergedMentions: number;
    averageMentionsPerUniqueProblem: number;
    duplicateMergeRate: number;
    reviewCount: number;
    failedCount: number;
    byIndustry: Record<string, number>;
    byAffectedUser: Record<string, number>;
    byProblemType: Record<string, number>;
    geographyDistribution: Record<string, number>;
    multiSourceProblemCount: number;
    averageJudgeConfidence: number;
    latestRun: Omit<DeduplicationRunDocument, "_id" | "configurationSnapshot"> | null;
    embeddingModelsAndVersions: Record<string, number>;
    embeddingTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
  quality: {
    pendingReviews: number;
    completedReviews: number;
    reviewDecisionDistribution: Record<string, number>;
    reviewerAgreement: number;
    reviewerDisagreementRate: number;
    cohensKappa: number;
    geographyAccuracy: number;
    extractionPrecision: number;
    extractionRecall: number;
    extractionF1: number;
    deduplicationMergePrecision: number;
    duplicateRecall: number;
    groundingAccuracy: number;
    solutionBiasRate: number;
    unsupportedFieldRate: number;
    criticalAuditFindings: number;
    latestEvaluationRun: Omit<EvaluationRunDocument, "_id"> | null;
    latestReadinessStatus: ReadinessStatus | null;
    evaluationDatasetVersions: string[];
  };
}
