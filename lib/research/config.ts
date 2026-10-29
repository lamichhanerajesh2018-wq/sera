import { RESEARCH_SOURCES, type ResearchSource } from "./types.ts";

type Environment = Readonly<Record<string, string | undefined>>;

function integerEnv(name: string, fallback: number, minimum = 1, env: Environment = process.env): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return value;
}

function booleanEnv(name: string, fallback: boolean, env: Environment = process.env): boolean {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  if (["1", "true", "yes", "on"].includes(raw.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(raw.toLowerCase())) return false;
  throw new Error(`${name} must be a boolean value`);
}

export const REDDIT_SORT_MODES = ["relevance", "hot", "top", "new", "comments"] as const;
export const REDDIT_TIME_FILTERS = ["hour", "day", "week", "month", "year", "all"] as const;

export class RedditConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedditConfigurationError";
  }
}

export function getRedditConfig(env: Environment = process.env) {
  const defaultSort = env.REDDIT_DEFAULT_SORT || "relevance";
  const defaultTimeFilter = env.REDDIT_DEFAULT_TIME_FILTER || "month";
  if (!REDDIT_SORT_MODES.includes(defaultSort as (typeof REDDIT_SORT_MODES)[number])) {
    throw new RedditConfigurationError(
      `REDDIT_DEFAULT_SORT must be one of: ${REDDIT_SORT_MODES.join(", ")}`,
    );
  }
  if (!REDDIT_TIME_FILTERS.includes(defaultTimeFilter as (typeof REDDIT_TIME_FILTERS)[number])) {
    throw new RedditConfigurationError(
      `REDDIT_DEFAULT_TIME_FILTER must be one of: ${REDDIT_TIME_FILTERS.join(", ")}`,
    );
  }

  return {
    enabled: booleanEnv("RESEARCH_COLLECTOR_REDDIT_ENABLED", false, env),
    clientId: env.REDDIT_CLIENT_ID?.trim() || undefined,
    clientSecret: env.REDDIT_CLIENT_SECRET?.trim() || undefined,
    userAgent: env.REDDIT_USER_AGENT?.trim() || undefined,
    username: env.REDDIT_USERNAME?.trim() || undefined,
    password: env.REDDIT_PASSWORD || undefined,
    requestTimeoutMs: integerEnv("REDDIT_REQUEST_TIMEOUT_MS", 10_000, 100, env),
    maximumRequestsPerRun: integerEnv("REDDIT_MAX_REQUESTS_PER_RUN", 20, 1, env),
    postsPerQuery: integerEnv("REDDIT_POSTS_PER_QUERY", 25, 1, env),
    collectionConcurrency: integerEnv("REDDIT_COLLECTION_CONCURRENCY", 2, 1, env),
    retryLimit: integerEnv("REDDIT_RETRY_LIMIT", 3, 0, env),
    retryBaseDelayMs: integerEnv("REDDIT_RETRY_BASE_DELAY_MS", 750, 1, env),
    minimumPostBodyLength: integerEnv("REDDIT_MIN_POST_BODY_LENGTH", 40, 1, env),
    maximumPostAgeDays: integerEnv("REDDIT_MAX_POST_AGE_DAYS", 365, 1, env),
    allowedSortModes: REDDIT_SORT_MODES,
    allowedTimeFilters: REDDIT_TIME_FILTERS,
    defaultSort: defaultSort as (typeof REDDIT_SORT_MODES)[number],
    defaultTimeFilter: defaultTimeFilter as (typeof REDDIT_TIME_FILTERS)[number],
    dryRun: booleanEnv("REDDIT_DRY_RUN", true, env),
    maximumCommunitiesPerRun: integerEnv("REDDIT_MAX_COMMUNITIES_PER_RUN", 10, 1, env),
    maximumQueriesPerCommunity: integerEnv("REDDIT_MAX_QUERIES_PER_COMMUNITY", 10, 1, env),
    includeSelfTextOnly: booleanEnv("REDDIT_SELF_TEXT_ONLY", true, env),
    excludeNsfw: booleanEnv("REDDIT_EXCLUDE_NSFW", true, env),
    requestPacingMs: integerEnv("REDDIT_REQUEST_PACING_MS", 1_000, 0, env),
  } as const;
}

export type RedditConfig = ReturnType<typeof getRedditConfig>;

export function getCfpbConfig(env: Environment = process.env) {
  return {
    enabled: booleanEnv("RESEARCH_COLLECTOR_CFPB_ENABLED", false, env),
    apiBaseUrl: "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/",
    userAgent: env.CFPB_USER_AGENT?.trim() || "sera-hush-research/1.0",
    requestTimeoutMs: integerEnv("CFPB_REQUEST_TIMEOUT_MS", 30_000, 100, env),
    retryLimit: integerEnv("CFPB_RETRY_LIMIT", 3, 0, env),
    retryBaseDelayMs: integerEnv("CFPB_RETRY_BASE_DELAY_MS", 750, 1, env),
    pageSize: integerEnv("CFPB_PAGE_SIZE", 50, 1, env),
    maximumRecordsPerRun: integerEnv("CFPB_MAX_RECORDS_PER_RUN", 500, 1, env),
    maximumRequestsPerRun: integerEnv("CFPB_MAX_REQUESTS_PER_RUN", 20, 1, env),
    insertConcurrency: integerEnv("CFPB_INSERT_CONCURRENCY", 2, 1, env),
    dryRun: booleanEnv("CFPB_DRY_RUN", true, env),
  } as const;
}

export type CfpbConfig = ReturnType<typeof getCfpbConfig>;

export function getBulkCollectorConfig(env: Environment = process.env) {
  return {
    cfpbDownloadUrl: "https://files.consumerfinance.gov/ccdb/complaints.csv.zip",
    nhtsaDownloadUrl: env.NHTSA_DOWNLOAD_URL?.trim() ||
      "https://static.nhtsa.gov/odi/ffdd/cmpl/COMPLAINTS_RECEIVED_2025-2026.zip",
    userAgent: env.RESEARCH_BULK_USER_AGENT?.trim() || "sera-hush-research/1.0",
    requestTimeoutMs: integerEnv("RESEARCH_BULK_REQUEST_TIMEOUT_MS", 600_000, 1_000, env),
    retryLimit: integerEnv("RESEARCH_BULK_RETRY_LIMIT", 2, 0, env),
    retryBaseDelayMs: integerEnv("RESEARCH_BULK_RETRY_BASE_DELAY_MS", 1_000, 1, env),
    maximumRecordsPerRun: integerEnv("RESEARCH_BULK_MAX_RECORDS_PER_RUN", 50_000, 1, env),
    maximumRowsScannedPerRun: integerEnv("RESEARCH_BULK_MAX_ROWS_SCANNED_PER_RUN", 500_000, 1, env),
    batchSize: integerEnv("RESEARCH_BULK_BATCH_SIZE", 250, 1, env),
    insertConcurrency: integerEnv("RESEARCH_BULK_INSERT_CONCURRENCY", 4, 1, env),
    cfpbDryRun: booleanEnv("CFPB_BULK_DRY_RUN", true, env),
    nhtsaDryRun: booleanEnv("NHTSA_DRY_RUN", true, env),
  } as const;
}

export type BulkCollectorConfig = ReturnType<typeof getBulkCollectorConfig>;

export const EXTRACTION_PROMPT_VERSION = "problem-extraction-v1";
export const EMBEDDING_TEXT_VERSION = "problem-embedding-v1";
export const DUPLICATE_JUDGE_PROMPT_VERSION = "duplicate-judge-v1";
export const REVIEW_REASON_CODES_VERSION = "review-reasons-v1";
export const QUALITY_GATES_VERSION = "research-quality-gates-v1";

export class OpenRouterConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterConfigurationError";
  }
}

function numberEnv(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
  env: Environment,
): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new OpenRouterConfigurationError(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

export function getExtractionConfig(env: Environment = process.env) {
  const reviewConfidence = numberEnv("OPENROUTER_REVIEW_CONFIDENCE", 0.55, 0, 1, env);
  const acceptConfidence = numberEnv("OPENROUTER_ACCEPT_CONFIDENCE", 0.75, 0, 1, env);
  const validationRepairLimit = integerEnv("OPENROUTER_VALIDATION_REPAIR_LIMIT", 1, 0, env);
  if (reviewConfidence >= acceptConfidence) {
    throw new OpenRouterConfigurationError(
      "OPENROUTER_REVIEW_CONFIDENCE must be lower than OPENROUTER_ACCEPT_CONFIDENCE",
    );
  }
  if (validationRepairLimit > 1) {
    throw new OpenRouterConfigurationError("OPENROUTER_VALIDATION_REPAIR_LIMIT must be 0 or 1");
  }
  return {
    apiKey: env.OPENROUTER_API_KEY?.trim() || undefined,
    model: env.OPENROUTER_EXTRACTION_MODEL?.trim() || undefined,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    requestTimeoutMs: integerEnv("OPENROUTER_REQUEST_TIMEOUT_MS", 30_000, 100, env),
    retryLimit: integerEnv("OPENROUTER_RETRY_LIMIT", 2, 0, env),
    validationRepairLimit,
    retryBaseDelayMs: integerEnv("OPENROUTER_RETRY_BASE_DELAY_MS", 750, 1, env),
    maximumInputLength: integerEnv("OPENROUTER_MAX_INPUT_LENGTH", 12_000, 500, env),
    maximumEvidenceLength: integerEnv("OPENROUTER_MAX_EVIDENCE_LENGTH", 500, 20, env),
    maximumOutputTokens: integerEnv("OPENROUTER_MAX_OUTPUT_TOKENS", 1_200, 100, env),
    batchSize: integerEnv("OPENROUTER_EXTRACTION_BATCH_SIZE", 10, 1, env),
    concurrency: integerEnv("OPENROUTER_EXTRACTION_CONCURRENCY", 2, 1, env),
    maximumRecordsPerRun: integerEnv("OPENROUTER_MAX_RECORDS_PER_RUN", 100, 1, env),
    staleProcessingMinutes: integerEnv("OPENROUTER_STALE_PROCESSING_MINUTES", 30, 1, env),
    acceptConfidence,
    reviewConfidence,
    maximumCostPerRun: numberEnv("OPENROUTER_MAX_COST_PER_RUN", 1, 0, 10_000, env),
    dryRun: booleanEnv("OPENROUTER_EXTRACTION_DRY_RUN", true, env),
    siteUrl: env.OPENROUTER_SITE_URL?.trim() || undefined,
    appName: env.OPENROUTER_APP_NAME?.trim() || "SERA Research",
  } as const;
}

export type ExtractionConfig = ReturnType<typeof getExtractionConfig>;

export function getDeduplicationConfig(env: Environment = process.env) {
  const minimumCandidateSimilarity = numberEnv("OPENROUTER_DEDUP_MIN_SIMILARITY", 0.7, -1, 1, env);
  const ambiguousSimilarity = numberEnv("OPENROUTER_DEDUP_AMBIGUOUS_SIMILARITY", 0.78, -1, 1, env);
  const highSimilarity = numberEnv("OPENROUTER_DEDUP_HIGH_SIMILARITY", 0.92, -1, 1, env);
  if (!(minimumCandidateSimilarity <= ambiguousSimilarity && ambiguousSimilarity <= highSimilarity)) {
    throw new OpenRouterConfigurationError(
      "Deduplication similarity thresholds must satisfy minimum <= ambiguous <= high",
    );
  }
  return {
    apiKey: env.OPENROUTER_API_KEY?.trim() || undefined,
    embeddingModel: env.OPENROUTER_EMBEDDING_MODEL?.trim() || undefined,
    duplicateJudgeModel:
      env.OPENROUTER_DUPLICATE_JUDGE_MODEL?.trim() ||
      env.OPENROUTER_EXTRACTION_MODEL?.trim() ||
      undefined,
    embeddingVersion: env.OPENROUTER_EMBEDDING_VERSION?.trim() || EMBEDDING_TEXT_VERSION,
    promptVersion: DUPLICATE_JUDGE_PROMPT_VERSION,
    embeddingBatchSize: integerEnv("OPENROUTER_EMBEDDING_BATCH_SIZE", 10, 1, env),
    concurrency: integerEnv("OPENROUTER_DEDUP_CONCURRENCY", 2, 1, env),
    requestTimeoutMs: integerEnv("OPENROUTER_DEDUP_REQUEST_TIMEOUT_MS", 30_000, 100, env),
    retryLimit: integerEnv("OPENROUTER_DEDUP_RETRY_LIMIT", 2, 0, env),
    retryBaseDelayMs: integerEnv("OPENROUTER_DEDUP_RETRY_BASE_DELAY_MS", 750, 1, env),
    candidateLimit: integerEnv("OPENROUTER_DEDUP_CANDIDATE_LIMIT", 5, 1, env),
    candidateScanLimit: integerEnv("OPENROUTER_DEDUP_CANDIDATE_SCAN_LIMIT", 5_000, 1, env),
    minimumCandidateSimilarity,
    ambiguousSimilarity,
    highSimilarity,
    judgeConfidence: numberEnv("OPENROUTER_DUPLICATE_JUDGE_CONFIDENCE", 0.85, 0, 1, env),
    minimumMentionConfidence: numberEnv("OPENROUTER_DEDUP_MIN_CONFIDENCE", 0.75, 0, 1, env),
    maximumRecordsPerRun: integerEnv("OPENROUTER_DEDUP_MAX_RECORDS_PER_RUN", 100, 1, env),
    maximumCostPerRun: numberEnv("OPENROUTER_DEDUP_MAX_COST_PER_RUN", 1, 0, 10_000, env),
    staleProcessingMinutes: integerEnv("OPENROUTER_DEDUP_STALE_PROCESSING_MINUTES", 30, 1, env),
    dryRun: booleanEnv("OPENROUTER_DEDUP_DRY_RUN", true, env),
    siteUrl: env.OPENROUTER_SITE_URL?.trim() || undefined,
    appName: env.OPENROUTER_APP_NAME?.trim() || "SERA Research",
  } as const;
}

export type DeduplicationConfig = ReturnType<typeof getDeduplicationConfig>;

export function getQualityConfig(env: Environment = process.env) {
  return {
    reasonCodesVersion: REVIEW_REASON_CODES_VERSION,
    qualityGatesVersion: QUALITY_GATES_VERSION,
    minimumReviewedSample: integerEnv("RESEARCH_QUALITY_MIN_REVIEWED_SAMPLE", 30, 1, env),
    extractionPrecisionGate: numberEnv("RESEARCH_GATE_EXTRACTION_PRECISION", 0.9, 0, 1, env),
    extractionRecallGate: numberEnv("RESEARCH_GATE_EXTRACTION_RECALL", 0.8, 0, 1, env),
    groundingAccuracyGate: numberEnv("RESEARCH_GATE_GROUNDING_ACCURACY", 0.95, 0, 1, env),
    unsupportedFieldRateGate: numberEnv("RESEARCH_GATE_UNSUPPORTED_FIELD_RATE", 0.03, 0, 1, env),
    mergePrecisionGate: numberEnv("RESEARCH_GATE_MERGE_PRECISION", 0.95, 0, 1, env),
    promptInjectionFailureRateGate: numberEnv("RESEARCH_GATE_PROMPT_INJECTION_FAILURE_RATE", 0, 0, 1, env),
    criticalAuditFindingsGate: integerEnv("RESEARCH_GATE_CRITICAL_AUDIT_FINDINGS", 0, 0, env),
    suspiciousClusterSize: integerEnv("RESEARCH_SUSPICIOUS_CLUSTER_SIZE", 25, 2, env),
    reviewSourcePreviewLength: integerEnv("RESEARCH_REVIEW_SOURCE_PREVIEW_LENGTH", 400, 80, env),
  } as const;
}

export type QualityConfig = ReturnType<typeof getQualityConfig>;

export function requireDeduplicationConfiguration(config: DeduplicationConfig) {
  const missing = [
    !config.apiKey && "OPENROUTER_API_KEY",
    !config.embeddingModel && "OPENROUTER_EMBEDDING_MODEL",
    !config.duplicateJudgeModel && "OPENROUTER_DUPLICATE_JUDGE_MODEL (or OPENROUTER_EXTRACTION_MODEL)",
  ].filter(Boolean);
  if (missing.length) {
    throw new OpenRouterConfigurationError(`Missing required deduplication configuration: ${missing.join(", ")}`);
  }
  return {
    apiKey: config.apiKey!,
    embeddingModel: config.embeddingModel!,
    duplicateJudgeModel: config.duplicateJudgeModel!,
  };
}

export function requireEmbeddingConfiguration(config: DeduplicationConfig) {
  const missing = [
    !config.apiKey && "OPENROUTER_API_KEY",
    !config.embeddingModel && "OPENROUTER_EMBEDDING_MODEL",
  ].filter(Boolean);
  if (missing.length) {
    throw new OpenRouterConfigurationError(`Missing required embedding configuration: ${missing.join(", ")}`);
  }
  return { apiKey: config.apiKey!, embeddingModel: config.embeddingModel! };
}

export function requireDuplicateJudgeConfiguration(config: DeduplicationConfig) {
  const missing = [
    !config.apiKey && "OPENROUTER_API_KEY",
    !config.duplicateJudgeModel && "OPENROUTER_DUPLICATE_JUDGE_MODEL (or OPENROUTER_EXTRACTION_MODEL)",
  ].filter(Boolean);
  if (missing.length) {
    throw new OpenRouterConfigurationError(`Missing required duplicate-judge configuration: ${missing.join(", ")}`);
  }
  return { apiKey: config.apiKey!, duplicateJudgeModel: config.duplicateJudgeModel! };
}

export function requireOpenRouterConfiguration(config: ExtractionConfig): {
  apiKey: string;
  model: string;
} {
  const missing = [
    !config.apiKey && "OPENROUTER_API_KEY",
    !config.model && "OPENROUTER_EXTRACTION_MODEL",
  ].filter(Boolean);
  if (missing.length) {
    throw new OpenRouterConfigurationError(`Missing required OpenRouter configuration: ${missing.join(", ")}`);
  }
  return { apiKey: config.apiKey!, model: config.model! };
}

export function requireRedditCredentials(config: RedditConfig): {
  clientId: string;
  clientSecret: string;
  userAgent: string;
} {
  const missing = [
    !config.clientId && "REDDIT_CLIENT_ID",
    !config.clientSecret && "REDDIT_CLIENT_SECRET",
    !config.userAgent && "REDDIT_USER_AGENT",
  ].filter(Boolean);
  if (missing.length) {
    throw new RedditConfigurationError(`Missing required Reddit credentials: ${missing.join(", ")}`);
  }
  return {
    clientId: config.clientId!,
    clientSecret: config.clientSecret!,
    userAgent: config.userAgent!,
  };
}

function collectorFlags(): Record<ResearchSource, boolean> {
  return Object.fromEntries(
    RESEARCH_SOURCES.map((source) => {
      const envName = `RESEARCH_COLLECTOR_${source.toUpperCase()}_ENABLED`;
      return [source, booleanEnv(envName, source === "manual_import")];
    }),
  ) as Record<ResearchSource, boolean>;
}

export function getResearchConfig() {
  const targetCountry = process.env.RESEARCH_TARGET_COUNTRY || "united_states";
  if (targetCountry !== "united_states") {
    throw new Error("RESEARCH_TARGET_COUNTRY must be united_states for the research module");
  }

  return {
    supportedSources: RESEARCH_SOURCES,
    batchSize: integerEnv("RESEARCH_BATCH_SIZE", 100),
    maximumBodyLength: integerEnv("RESEARCH_MAX_BODY_LENGTH", 20_000),
    defaultLanguage: process.env.RESEARCH_DEFAULT_LANGUAGE || "en",
    targetCountry,
    collectors: collectorFlags(),
    retryLimit: integerEnv("RESEARCH_RETRY_LIMIT", 3, 0),
    collectionConcurrency: integerEnv("RESEARCH_COLLECTION_CONCURRENCY", 4),
    dryRun: booleanEnv("RESEARCH_DRY_RUN", false),
  } as const;
}

export type ResearchConfig = ReturnType<typeof getResearchConfig>;
