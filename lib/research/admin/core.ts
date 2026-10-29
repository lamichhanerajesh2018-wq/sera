import { ObjectId, type Db, type Filter, type Sort } from "mongodb";
import {
  collectionRunsCollection,
  correctionAuditsCollection,
  deduplicationDecisionsCollection,
  deduplicationRunsCollection,
  evaluationRunsCollection,
  extractionRunsCollection,
  humanReviewsCollection,
  problemMentionsCollection,
  rawSignalsCollection,
  readinessReportsCollection,
  uniqueProblemsCollection,
} from "../models.ts";
import type {
  HumanReviewDocument,
  ProblemMentionDocument,
  RawSignalDocument,
  ResearchStats,
  UniqueProblemDocument,
} from "../types.ts";
import { safeReviewView } from "../quality/service.ts";
import { auditClusters } from "../quality/audit.ts";

export const ADMIN_PAGE_SIZE_MAX = 50;
const DEFAULT_PAGE_SIZE = 20;
const TEXT_LIMIT = 120;
const SAFE_METADATA_KEYS = new Set([
  "product", "subProduct", "issue", "subIssue", "company", "state",
  "submissionMethod", "companyResponse", "companyPublicResponse",
  "redditPermalink", "redditDomain", "isSelfPost", "over18", "locked", "stickied", "spoiler",
]);

export class ResearchAdminAccessError extends Error {
  constructor() {
    super("Research administrator authorization required");
    this.name = "ResearchAdminAccessError";
  }
}

export class ResearchAdminInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchAdminInputError";
  }
}

export async function assertResearchAdmin(check: () => Promise<boolean>) {
  if (!(await check())) throw new ResearchAdminAccessError();
}

export function parseAdminPage(value: unknown, pageSizeValue: unknown) {
  const page = value === undefined || value === "" ? 1 : Number(value);
  const pageSize = pageSizeValue === undefined || pageSizeValue === "" ? DEFAULT_PAGE_SIZE : Number(pageSizeValue);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) throw new ResearchAdminInputError("Invalid page");
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) throw new ResearchAdminInputError("Invalid page size");
  return { page, pageSize: Math.min(pageSize, ADMIN_PAGE_SIZE_MAX), skip: (page - 1) * Math.min(pageSize, ADMIN_PAGE_SIZE_MAX) };
}

export function parseObjectId(value: string, label = "id") {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new ResearchAdminInputError(`Invalid ${label}`);
  return new ObjectId(value);
}

export function sanitizeSearch(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, TEXT_LIMIT);
  return normalized || undefined;
}

function textSearch(value: string) {
  const tokens = value.match(/[\p{L}\p{N}]{2,}/gu)?.slice(0, 12) || [];
  return tokens.length ? tokens.map((token) => `"${token}"`).join(" ") : `"${value.replaceAll('"', '')}"`;
}

function dateFilter(min?: string, max?: string) {
  const result: { $gte?: Date; $lte?: Date } = {};
  if (min) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(min) || Number.isNaN(Date.parse(`${min}T00:00:00.000Z`))) throw new ResearchAdminInputError("Invalid start date");
    result.$gte = new Date(`${min}T00:00:00.000Z`);
  }
  if (max) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(max) || Number.isNaN(Date.parse(`${max}T23:59:59.999Z`))) throw new ResearchAdminInputError("Invalid end date");
    result.$lte = new Date(`${max}T23:59:59.999Z`);
  }
  return Object.keys(result).length ? result : undefined;
}

function safeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return {};
  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) =>
    SAFE_METADATA_KEYS.has(key) && ["string", "number", "boolean"].includes(typeof value)));
}

export function shortText(value: string | undefined | null, limit = 240) {
  if (!value) return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function iso(value: Date | undefined) { return value?.toISOString() || null; }
function id(value: ObjectId | undefined) { return value?.toString() || null; }

export interface RawSignalListInput {
  page?: unknown; pageSize?: unknown; source?: string; status?: string; geography?: string;
  industry?: string; community?: string; collectionRun?: string; dateMin?: string; dateMax?: string;
  search?: string; sort?: string; direction?: string;
}

export interface MentionListInput {
  page?: unknown; pageSize?: unknown; status?: string; industry?: string; affectedUser?: string;
  problemType?: string; geography?: string; source?: string; minConfidence?: string; maxConfidence?: string;
  promptVersion?: string; model?: string; linkage?: string; search?: string; sort?: string; direction?: string;
}

export interface UniqueProblemListInput {
  page?: unknown; pageSize?: unknown; industry?: string; affectedUser?: string; problemType?: string;
  geography?: string; status?: string; minMentions?: string; minSources?: string; dateMin?: string; dateMax?: string;
  embeddingVersion?: string; search?: string; sort?: string; direction?: string;
}

export function overviewCards(stats: ResearchStats) {
  return [
    ["Total RawSignals", stats.totalRawSignals],
    ["Pending signals", stats.byProcessingStatus.pending || 0],
    ["Processing signals", stats.byProcessingStatus.processing || 0],
    ["Accepted mentions", stats.extraction.acceptedProblems],
    ["Needs-review mentions", stats.extraction.needsReviewMentions],
    ["No-problem signals", stats.extraction.noProblemSignals],
    ["Failed extractions", stats.extraction.failedExtractions],
    ["Unique problems", stats.deduplication.uniqueProblemCount],
    ["Merged mentions", stats.deduplication.mergedMentions],
    ["Dedup review", stats.deduplication.reviewCount],
    ["Pending human reviews", stats.quality.pendingReviews],
    ["Completed human reviews", stats.quality.completedReviews],
    ["Total model tokens", stats.extraction.totalTokens + stats.deduplication.totalTokens],
    ["Reported model cost", stats.extraction.estimatedCost + stats.deduplication.estimatedCost],
  ] as const;
}

export function readinessDisplayState(readiness: { status: string; unresolvedIssues: string[] } | null) {
  if (!readiness) return { status: "INSUFFICIENT_REVIEW_DATA", explanation: "No saved readiness report is available." };
  if (readiness.unresolvedIssues.length) return { status: readiness.status, explanation: readiness.unresolvedIssues.join("; ") };
  return { status: readiness.status, explanation: readiness.status === "READY" ? "All saved readiness gates passed." : "One or more saved readiness gates did not pass." };
}

function direction(value?: string): 1 | -1 { return value === "asc" ? 1 : -1; }
function numberFilter(value: string | undefined, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new ResearchAdminInputError(`Invalid ${label}`);
  return parsed;
}

export class ResearchAdminRepository {
  constructor(private readonly database: Db) {}

  async listRawSignals(input: RawSignalListInput) {
    const paging = parseAdminPage(input.page, input.pageSize);
    const filter: Filter<RawSignalDocument> = {};
    if (input.source) filter.source = input.source as RawSignalDocument["source"];
    if (input.status) filter.processingStatus = input.status as RawSignalDocument["processingStatus"];
    if (input.geography) filter.geographyEvidence = input.geography as RawSignalDocument["geographyEvidence"];
    if (input.industry) filter.industrySeed = input.industry;
    if (input.community) filter.sourceCommunity = input.community;
    if (input.collectionRun) filter.collectionRunId = parseObjectId(input.collectionRun, "collection run");
    const dates = dateFilter(input.dateMin, input.dateMax);
    if (dates) filter.publishedAt = dates;
    const search = sanitizeSearch(input.search);
    if (search) filter.$text = { $search: textSearch(search) };
    const allowed = { published: "publishedAt", created: "createdAt", source: "source", status: "processingStatus" } as const;
    const sortField = allowed[input.sort as keyof typeof allowed] || "createdAt";
    const dir = direction(input.direction);
    const collection = rawSignalsCollection(this.database);
    const [total, rows] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter, { projection: { authorName: 0, authorId: 0 } })
        .sort({ [sortField]: dir, _id: dir } as Sort).skip(paging.skip).limit(paging.pageSize).toArray(),
    ]);
    return {
      ...paging, total, pages: Math.max(1, Math.ceil(total / paging.pageSize)),
      rows: rows.map((row) => ({
        id: id(row._id), source: row.source,
        communityOrProduct: row.sourceCommunity || String(row.metadata?.product || "—"),
        title: shortText(row.title, 140) || "Untitled signal", bodyPreview: shortText(row.body),
        publishedAt: iso(row.publishedAt), geographyEvidence: row.geographyEvidence,
        industrySeed: row.industrySeed || null, processingStatus: row.processingStatus,
        collectionRunId: id(row.collectionRunId), createdAt: iso(row.createdAt),
      })),
    };
  }

  async getRawSignalDetail(value: string) {
    const signalId = parseObjectId(value);
    const raw = await rawSignalsCollection(this.database).findOne({ _id: signalId }, { projection: { authorName: 0, authorId: 0 } });
    if (!raw) return null;
    const [mention, collectionRun] = await Promise.all([
      problemMentionsCollection(this.database).findOne({ rawSignalId: signalId }, { projection: { embedding: 0 } }),
      raw.collectionRunId ? collectionRunsCollection(this.database).findOne({ _id: raw.collectionRunId }, { projection: { configurationSnapshot: 0 } }) : null,
    ]);
    return {
      id: id(raw._id), source: raw.source, sourceId: raw.sourceId, sourceUrl: raw.sourceUrl,
      sourceCommunity: raw.sourceCommunity || null, title: raw.title || "Untitled signal", body: raw.body,
      publishedAt: iso(raw.publishedAt), collectedAt: iso(raw.collectedAt), createdAt: iso(raw.createdAt),
      geographyEvidence: raw.geographyEvidence, industrySeed: raw.industrySeed || null,
      processingStatus: raw.processingStatus, retryCount: raw.retryCount,
      errorMessage: shortText(raw.errorMessage, 500) || null, rejectionReason: raw.rejectionReason || null,
      metadata: safeMetadata(raw.metadata), collectionRun: collectionRun ? {
        id: id(collectionRun._id), collectorName: collectionRun.collectorName, status: collectionRun.status,
        dryRun: collectionRun.dryRun, startedAt: iso(collectionRun.startedAt), completedAt: iso(collectionRun.completedAt),
      } : null,
      mention: mention ? { id: id(mention._id), canonicalProblem: mention.canonicalProblem, status: mention.status } : null,
    };
  }

  async listProblemMentions(input: MentionListInput) {
    const paging = parseAdminPage(input.page, input.pageSize);
    const filter: Filter<ProblemMentionDocument> = {};
    if (input.status) filter.status = input.status as ProblemMentionDocument["status"];
    if (input.industry) filter.industry = input.industry;
    if (input.affectedUser) filter.affectedUser = input.affectedUser;
    if (input.problemType) filter.problemType = input.problemType as ProblemMentionDocument["problemType"];
    if (input.geography) filter.geography = input.geography as ProblemMentionDocument["geography"];
    if (input.source) filter.source = input.source as ProblemMentionDocument["source"];
    if (input.promptVersion) filter.promptVersion = input.promptVersion;
    if (input.model) filter.model = input.model;
    if (input.linkage === "linked") filter.uniqueProblemId = { $exists: true };
    if (input.linkage === "unlinked") filter.uniqueProblemId = { $exists: false };
    const min = numberFilter(input.minConfidence, "minimum confidence", 0, 1);
    const max = numberFilter(input.maxConfidence, "maximum confidence", 0, 1);
    if (min !== undefined || max !== undefined) filter.extractionConfidence = { ...(min !== undefined && { $gte: min }), ...(max !== undefined && { $lte: max }) };
    const search = sanitizeSearch(input.search);
    if (search) filter.$text = { $search: textSearch(search) };
    const allowed = { created: "createdAt", confidence: "extractionConfidence", industry: "industry", status: "status" } as const;
    const sortField = allowed[input.sort as keyof typeof allowed] || "createdAt";
    const dir = direction(input.direction);
    const collection = problemMentionsCollection(this.database);
    const [total, rows] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter, { projection: { embedding: 0 } }).sort({ [sortField]: dir, _id: dir } as Sort)
        .skip(paging.skip).limit(paging.pageSize).toArray(),
    ]);
    return { ...paging, total, pages: Math.max(1, Math.ceil(total / paging.pageSize)), rows: rows.map((row) => ({
      id: id(row._id), canonicalProblem: shortText(row.canonicalProblem, 220), shortLabel: row.shortLabel,
      industry: row.industry, affectedUser: row.affectedUser, workflow: shortText(row.workflow, 120) || null,
      problemType: row.problemType, geography: row.geography, confidence: row.extractionConfidence,
      status: row.status, source: row.source, uniqueProblemId: id(row.uniqueProblemId), deduplicationStatus: row.deduplicationStatus || null,
    })) };
  }

  async getProblemMentionDetail(value: string) {
    const mentionId = parseObjectId(value);
    const mention = await problemMentionsCollection(this.database).findOne({ _id: mentionId }, { projection: { embedding: 0 } });
    if (!mention) return null;
    const [raw, unique, reviews] = await Promise.all([
      rawSignalsCollection(this.database).findOne({ _id: mention.rawSignalId }, { projection: { authorName: 0, authorId: 0 } }),
      mention.uniqueProblemId ? uniqueProblemsCollection(this.database).findOne({ _id: mention.uniqueProblemId }, { projection: { embedding: 0 } }) : null,
      humanReviewsCollection(this.database).find({ targetType: "problem_mention", targetId: mentionId }).sort({ reviewRound: 1 }).limit(10).toArray(),
    ]);
    return {
      id: id(mention._id), rawSignal: raw ? { id: id(raw._id), title: raw.title || "Untitled signal", bodyPreview: shortText(raw.body, 800), source: raw.source } : null,
      canonicalProblem: mention.canonicalProblem, shortLabel: mention.shortLabel, industry: mention.industry,
      subIndustry: mention.subIndustry, affectedUser: mention.affectedUser, affectedRole: mention.affectedRole,
      organizationType: mention.organizationType, workflow: mention.workflow, problemType: mention.problemType,
      currentWorkaround: mention.currentWorkaround, triggeringSituation: mention.triggeringSituation,
      desiredOutcome: mention.desiredOutcome, negativeConsequence: mention.negativeConsequence,
      geography: mention.geography, evidenceText: mention.evidenceText, confidence: mention.extractionConfidence,
      status: mention.status, rejectionReason: mention.rejectionReason, model: mention.model, promptVersion: mention.promptVersion,
      uniqueProblem: unique ? { id: id(unique._id), canonicalProblem: unique.canonicalProblem, status: unique.status } : null,
      reviews: reviews.map(reviewSummary),
    };
  }

  async listUniqueProblems(input: UniqueProblemListInput) {
    const paging = parseAdminPage(input.page, input.pageSize);
    const filter: Filter<UniqueProblemDocument> = {};
    if (input.industry) filter.industry = input.industry;
    if (input.affectedUser) filter.affectedUsers = input.affectedUser;
    if (input.problemType) filter.problemTypes = input.problemType as UniqueProblemDocument["problemTypes"][number];
    if (input.geography) filter.geography = input.geography as UniqueProblemDocument["geography"];
    if (input.status) filter.status = input.status as UniqueProblemDocument["status"];
    if (input.embeddingVersion) filter.embeddingVersion = input.embeddingVersion;
    const mentions = numberFilter(input.minMentions, "minimum mentions", 0);
    const sources = numberFilter(input.minSources, "minimum sources", 0);
    if (mentions !== undefined) filter.mentionCount = { $gte: mentions };
    if (sources !== undefined) filter.sourceCount = { $gte: sources };
    const dates = dateFilter(input.dateMin, input.dateMax);
    if (dates) filter.lastSeenAt = dates;
    const search = sanitizeSearch(input.search);
    if (search) filter.$text = { $search: textSearch(search) };
    const allowed = { mentions: "mentionCount", sources: "sourceCount", confidence: "averageConfidence", recent: "lastSeenAt", created: "createdAt" } as const;
    const sortField = allowed[input.sort as keyof typeof allowed] || "mentionCount";
    const dir = direction(input.direction);
    const collection = uniqueProblemsCollection(this.database);
    const [total, rows] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter, { projection: { embedding: 0 } }).sort({ [sortField]: dir, _id: dir } as Sort)
        .skip(paging.skip).limit(paging.pageSize).toArray(),
    ]);
    return { ...paging, total, pages: Math.max(1, Math.ceil(total / paging.pageSize)), rows: rows.map((row) => ({
      id: id(row._id), canonicalProblem: shortText(row.canonicalProblem, 220), shortLabel: row.shortLabel,
      industry: row.industry, affectedUsers: row.affectedUsers.slice(0, 3), workflow: row.workflows[0] || null,
      mentionCount: row.mentionCount, evidenceCount: row.evidenceCount, sourceCount: row.sourceCount,
      geography: row.geography, averageConfidence: row.averageConfidence, firstSeenAt: iso(row.firstSeenAt),
      lastSeenAt: iso(row.lastSeenAt), status: row.status,
    })) };
  }

  async getUniqueProblemDetail(value: string) {
    const problemId = parseObjectId(value);
    const problem = await uniqueProblemsCollection(this.database).findOne({ _id: problemId }, { projection: { embedding: 0 } });
    if (!problem) return null;
    const [mentions, decisions, reviews, corrections] = await Promise.all([
      problemMentionsCollection(this.database).find({ uniqueProblemId: problemId }, { projection: { embedding: 0 } })
        .sort({ extractionConfidence: -1, _id: 1 }).limit(ADMIN_PAGE_SIZE_MAX).toArray(),
      deduplicationDecisionsCollection(this.database).find({ finalUniqueProblemId: problemId }).sort({ processedAt: -1 }).limit(ADMIN_PAGE_SIZE_MAX).toArray(),
      humanReviewsCollection(this.database).find({ targetType: "unique_problem", targetId: problemId }).sort({ reviewRound: 1 }).limit(10).toArray(),
      correctionAuditsCollection(this.database).find({ targetType: "unique_problem", targetId: problemId }).sort({ appliedAt: -1 }).limit(20).toArray(),
    ]);
    const computed = {
      mentionCountMismatch: problem.mentionCount !== mentions.length && problem.mentionCount <= ADMIN_PAGE_SIZE_MAX,
      evidenceCountMismatch: problem.evidenceCount !== mentions.filter((item) => item.evidenceText).length && problem.mentionCount <= ADMIN_PAGE_SIZE_MAX,
      sourceCountMismatch: problem.sourceCount !== new Set(mentions.map((item) => item.source)).size && problem.mentionCount <= ADMIN_PAGE_SIZE_MAX,
      truncatedMentions: problem.mentionCount > ADMIN_PAGE_SIZE_MAX,
    };
    return {
      id: id(problem._id), canonicalProblem: problem.canonicalProblem, shortLabel: problem.shortLabel,
      industry: problem.industry, subIndustries: problem.subIndustries, affectedUsers: problem.affectedUsers,
      affectedRoles: problem.affectedRoles, organizationTypes: problem.organizationTypes, workflows: problem.workflows,
      problemTypes: problem.problemTypes, currentWorkarounds: problem.currentWorkarounds,
      triggeringSituations: problem.triggeringSituations, desiredOutcomes: problem.desiredOutcomes,
      negativeConsequences: problem.negativeConsequences, geography: problem.geography,
      mentionCount: problem.mentionCount, evidenceCount: problem.evidenceCount, sourceCount: problem.sourceCount,
      sources: problem.sources, communities: problem.communities, averageConfidence: problem.averageConfidence,
      highestConfidence: problem.highestConfidence, firstSeenAt: iso(problem.firstSeenAt), lastSeenAt: iso(problem.lastSeenAt),
      status: problem.status, embeddingVersion: problem.embeddingVersion,
      mentions: mentions.map((mention) => ({ id: id(mention._id), canonicalProblem: mention.canonicalProblem,
        evidenceText: shortText(mention.evidenceText, 400), source: mention.source, sourceCommunity: mention.sourceCommunity || null,
        confidence: mention.extractionConfidence })),
      decisions: decisions.map((decision) => ({ id: id(decision._id), decision: decision.decision,
        similarity: decision.similarity ?? null, confidence: decision.decisionConfidence ?? null,
        reason: shortText(decision.reason, 400), previousCanonicalProblem: decision.previousCanonicalProblem || null,
        newCanonicalProblem: decision.newCanonicalProblem || null, processedAt: iso(decision.processedAt) })),
      reviews: reviews.map(reviewSummary),
      wordingHistory: corrections.map((audit) => ({ previous: audit.previousValues.canonicalProblem || null,
        applied: audit.appliedValues.canonicalProblem || null, appliedAt: iso(audit.appliedAt) })),
      audit: computed,
    };
  }

  async listReviews(input: { page?: unknown; pageSize?: unknown; status?: string; targetType?: string }) {
    const paging = parseAdminPage(input.page, input.pageSize);
    const filter: Filter<HumanReviewDocument> = {};
    if (input.status) filter.reviewStatus = input.status as HumanReviewDocument["reviewStatus"];
    if (input.targetType) filter.targetType = input.targetType as HumanReviewDocument["targetType"];
    const collection = humanReviewsCollection(this.database);
    const [total, reviews] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter).sort({ riskScore: -1, createdAt: 1, _id: 1 }).skip(paging.skip).limit(paging.pageSize).toArray(),
    ]);
    const rows = await Promise.all(reviews.map(async (review) => ({
      ...reviewSummary(review), view: await safeReviewView(review, this.database, 280),
    })));
    return { ...paging, total, pages: Math.max(1, Math.ceil(total / paging.pageSize)), rows };
  }

  async getReviewDetail(value: string) {
    const reviewId = parseObjectId(value);
    const review = await humanReviewsCollection(this.database).findOne({ _id: reviewId });
    if (!review) return null;
    const [view, rounds, correction] = await Promise.all([
      safeReviewView(review, this.database, 800),
      humanReviewsCollection(this.database).find({ targetType: review.targetType, targetId: review.targetId })
        .sort({ reviewRound: 1 }).limit(10).toArray(),
      correctionAuditsCollection(this.database).findOne({ reviewId }),
    ]);
    return { ...reviewSummary(review), view, reviewerDecision: review.reviewerDecision || null,
      extractionDecision: review.extractionDecision || null, deduplicationDecision: review.deduplicationDecision || null,
      fieldReviews: review.fieldReviews || {}, correctedValues: review.correctedValues || {}, reasonCodes: review.reasonCodes || [],
      reviewerNotes: review.reviewerNotes || null, rounds: rounds.map(reviewSummary), correctionApplied: Boolean(correction) };
  }

  async listRuns(limit = 30) {
    const bounded = Math.min(Math.max(1, limit), ADMIN_PAGE_SIZE_MAX);
    const perType = Math.min(bounded, 20);
    const [collections, extractions, deduplications, evaluations] = await Promise.all([
      collectionRunsCollection(this.database).find({}, { projection: { configurationSnapshot: 0 } }).sort({ startedAt: -1 }).limit(perType).toArray(),
      extractionRunsCollection(this.database).find({}, { projection: { configurationSnapshot: 0 } }).sort({ startedAt: -1 }).limit(perType).toArray(),
      deduplicationRunsCollection(this.database).find({}, { projection: { configurationSnapshot: 0 } }).sort({ startedAt: -1 }).limit(perType).toArray(),
      evaluationRunsCollection(this.database).find({}).sort({ startedAt: -1 }).limit(perType).toArray(),
    ]);
    return [
      ...collections.map((run) => ({ type: "collection", id: id(run._id), sourceOrModel: run.source, version: run.collectorName,
        startedAt: iso(run.startedAt), completedAt: iso(run.completedAt), status: run.status, attempted: run.fetchedCount,
        inserted: run.insertedCount, accepted: null, rejected: run.skippedCount, merged: null, failed: run.failedCount,
        retries: null, tokens: null, cost: null, dryRun: run.dryRun, error: shortText(run.errorMessage, 300) || null })),
      ...extractions.map((run) => ({ type: "extraction", id: id(run._id), sourceOrModel: run.model, version: run.promptVersion,
        startedAt: iso(run.startedAt), completedAt: iso(run.completedAt), status: run.status, attempted: run.attemptedCount,
        inserted: null, accepted: run.acceptedProblemCount, rejected: run.noProblemCount, merged: null, failed: run.failedCount,
        retries: run.retryCount, tokens: run.totalTokens, cost: run.estimatedCost, dryRun: run.dryRun, error: shortText(run.errorMessage, 300) || null })),
      ...deduplications.map((run) => ({ type: "deduplication", id: id(run._id), sourceOrModel: run.embeddingModel, version: run.embeddingVersion,
        startedAt: iso(run.startedAt), completedAt: iso(run.completedAt), status: run.status, attempted: run.attemptedMentions,
        inserted: run.newUniqueProblems, accepted: null, rejected: run.uncertainReviewDecisions, merged: run.mergedMentions,
        failed: run.failedCount, retries: run.retryCount, tokens: run.totalTokens + run.embeddingTokens, cost: run.estimatedCost,
        dryRun: run.dryRun, error: shortText(run.errorMessage, 300) || null })),
      ...evaluations.map((run) => ({ type: "evaluation", id: id(run._id), sourceOrModel: run.model || "fixture evaluation",
        version: run.promptVersion || run.datasetVersions.join(", "), startedAt: iso(run.startedAt), completedAt: iso(run.completedAt),
        status: "completed", attempted: run.sampleSize, inserted: null, accepted: null, rejected: null, merged: null,
        failed: null, retries: null, tokens: null, cost: null, dryRun: run.dryRun, error: null })),
    ].sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt))).slice(0, bounded);
  }

  async qualitySnapshot(stats: ResearchStats) {
    const [readiness, evaluation, clusterAudit] = await Promise.all([
      readinessReportsCollection(this.database).findOne({}, { sort: { generatedAt: -1 } }),
      evaluationRunsCollection(this.database).findOne({}, { sort: { completedAt: -1 } }),
      auditClusters(this.database, 10),
    ]);
    return {
      metrics: stats.quality, latestEvaluation: evaluation ? { id: id(evaluation._id), type: evaluation.evaluationType,
        sampleSize: evaluation.sampleSize, metrics: evaluation.metrics, completedAt: iso(evaluation.completedAt) } : null,
      readiness: readiness ? { status: readiness.status, reviewedSampleSize: readiness.reviewedSampleSize,
        gates: readiness.gates, unresolvedIssues: readiness.unresolvedIssues.slice(0, 50), generatedAt: iso(readiness.generatedAt) } : null,
      clusterAudit,
    };
  }
}

function reviewSummary(review: HumanReviewDocument) {
  return { id: id(review._id), targetType: review.targetType, targetId: review.targetId.toString(),
    reviewRound: review.reviewRound, reviewStatus: review.reviewStatus, riskScore: review.riskScore,
    strata: review.strata, reviewerId: review.reviewerId || null, reviewedAt: iso(review.reviewedAt), createdAt: iso(review.createdAt) };
}
