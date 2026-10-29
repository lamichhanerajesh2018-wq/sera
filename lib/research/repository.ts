import { ObjectId, type Db } from "mongodb";
import { db as defaultDb } from "../mongodb.ts";
import { getDeduplicationConfig, getResearchConfig, type ResearchConfig } from "./config.ts";
import { logResearchEvent } from "./logger.ts";
import {
  collectionRunsCollection,
  extractionRunsCollection,
  deduplicationDecisionsCollection,
  deduplicationRunsCollection,
  evaluationItemsCollection,
  evaluationRunsCollection,
  humanReviewsCollection,
  problemMentionsCollection,
  rawSignalsCollection,
  uniqueProblemsCollection,
  readinessReportsCollection,
} from "./models.ts";
import type {
  BatchInsertResult,
  CollectionRunDocument,
  CollectionRunStatus,
  ProcessingStatus,
  RawSignalDocument,
  ResearchSource,
  ResearchStats,
} from "./types.ts";
import { formatValidationError, parseRawSignalInput } from "./validation.ts";
import { calculateReviewMetrics } from "./quality/service.ts";

interface CreateCollectionRunInput {
  source: ResearchSource;
  collectorName: string;
  query?: string;
  sourceCommunity?: string;
  industrySeed?: string;
  audienceSeed?: string;
  dryRun?: boolean;
  configurationSnapshot?: Record<string, unknown>;
}

interface BatchOptions {
  collectionRunId?: ObjectId;
  dryRun?: boolean;
  concurrency?: number;
  logIndividual?: boolean;
}

export interface CollectionRunCounterIncrement {
  fetchedCount?: number;
  insertedCount?: number;
  duplicateCount?: number;
  skippedCount?: number;
  failedCount?: number;
}

export type InsertRawSignalResult =
  | { status: "inserted"; id: ObjectId }
  | { status: "would_insert" }
  | { status: "duplicate"; reason: "source_id" | "content_hash" | "unique_index" }
  | { status: "skipped"; error: string }
  | { status: "failed"; error: string };

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

function toObjectId(value: ObjectId | string): ObjectId {
  return value instanceof ObjectId ? value : new ObjectId(value);
}

async function groupedCounts(
  db: Db,
  collectionName: string,
  field: string,
): Promise<Record<string, number>> {
  const rows = await db
    .collection(collectionName)
    .aggregate<{ _id: unknown; count: number }>([
      { $match: { [field]: { $exists: true, $ne: null } } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
}

export class ResearchRepository {
  constructor(
    private readonly database: Db = defaultDb,
    private readonly config: ResearchConfig = getResearchConfig(),
  ) {}

  async createCollectionRun(input: CreateCollectionRunInput): Promise<CollectionRunDocument> {
    const now = new Date();
    const document: CollectionRunDocument = {
      source: input.source,
      collectorName: input.collectorName.trim(),
      ...(cleanOptional(input.query) && { query: cleanOptional(input.query) }),
      ...(cleanOptional(input.sourceCommunity) && {
        sourceCommunity: cleanOptional(input.sourceCommunity),
      }),
      ...(cleanOptional(input.industrySeed) && { industrySeed: cleanOptional(input.industrySeed) }),
      ...(cleanOptional(input.audienceSeed) && { audienceSeed: cleanOptional(input.audienceSeed) }),
      startedAt: now,
      fetchedCount: 0,
      insertedCount: 0,
      duplicateCount: 0,
      skippedCount: 0,
      failedCount: 0,
      status: "running",
      dryRun: input.dryRun ?? this.config.dryRun,
      ...(input.configurationSnapshot && { configurationSnapshot: input.configurationSnapshot }),
      createdAt: now,
      updatedAt: now,
    };
    const result = await collectionRunsCollection(this.database).insertOne(document);
    document._id = result.insertedId;
    return document;
  }

  async completeCollectionRun(
    id: ObjectId | string,
    status: Extract<CollectionRunStatus, "completed" | "partially_completed"> = "completed",
  ): Promise<void> {
    const now = new Date();
    await collectionRunsCollection(this.database).updateOne(
      { _id: toObjectId(id) },
      { $set: { status, completedAt: now, updatedAt: now } },
    );
  }

  async failCollectionRun(id: ObjectId | string, error: unknown): Promise<void> {
    const now = new Date();
    await collectionRunsCollection(this.database).updateOne(
      { _id: toObjectId(id) },
      {
        $set: {
          status: "failed",
          completedAt: now,
          updatedAt: now,
          errorMessage: formatValidationError(error).slice(0, 2_000),
        },
      },
    );
  }

  async incrementCollectionRunCounters(
    id: ObjectId | string,
    counters: CollectionRunCounterIncrement,
  ): Promise<void> {
    const increments = Object.fromEntries(
      Object.entries(counters).filter(([, value]) => value !== undefined && value !== 0),
    );
    if (!Object.keys(increments).length) return;
    await collectionRunsCollection(this.database).updateOne(
      { _id: toObjectId(id) },
      { $inc: increments, $set: { updatedAt: new Date() } },
    );
  }

  async findRawSignalBySourceId(source: ResearchSource, sourceId: string) {
    return rawSignalsCollection(this.database).findOne({ source, sourceId: sourceId.trim() });
  }

  async findRawSignalByContentHash(contentHash: string) {
    return rawSignalsCollection(this.database).findOne({ contentHash });
  }

  async insertRawSignal(
    input: unknown,
    options: BatchOptions = {},
  ): Promise<InsertRawSignalResult> {
    let document: Omit<RawSignalDocument, "_id">;
    try {
      document = {
        ...parseRawSignalInput(input, this.config),
        ...(options.collectionRunId && { collectionRunId: options.collectionRunId }),
      };
    } catch (error) {
      return { status: "skipped", error: formatValidationError(error) };
    }

    try {
      const collection = rawSignalsCollection(this.database);
      const duplicate = await collection.findOne(
        {
          $or: [
            { source: document.source, sourceId: document.sourceId },
            { contentHash: document.contentHash },
          ],
        },
        { projection: { source: 1, sourceId: 1, contentHash: 1 } },
      );
      if (duplicate) {
        return {
          status: "duplicate",
          reason:
            duplicate.source === document.source && duplicate.sourceId === document.sourceId
              ? "source_id"
              : "content_hash",
        };
      }
      if (options.dryRun) return { status: "would_insert" };
      const result = await collection.insertOne(document as RawSignalDocument);
      return { status: "inserted", id: result.insertedId };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return { status: "duplicate", reason: "unique_index" };
      }
      return { status: "failed", error: formatValidationError(error) };
    }
  }

  async insertRawSignalsBatch(inputs: unknown[], options: BatchOptions = {}): Promise<BatchInsertResult> {
    const result: BatchInsertResult = {
      inserted: 0,
      duplicate: 0,
      skipped: 0,
      failed: 0,
      wouldInsert: 0,
      errors: [],
    };
    let cursor = 0;
    const concurrency = Math.max(1, options.concurrency ?? this.config.collectionConcurrency);

    const worker = async () => {
      while (cursor < inputs.length) {
        const index = cursor++;
        const input = inputs[index];
        const sourceId =
          input && typeof input === "object" && "sourceId" in input
            ? String((input as { sourceId?: unknown }).sourceId ?? "") || undefined
            : undefined;
        const item = await this.insertRawSignal(input, options);
        if (item.status === "inserted") {
          result.inserted += 1;
          if (options.logIndividual !== false) logResearchEvent("info", "raw_signal_inserted", { sourceId });
        } else if (item.status === "would_insert") {
          result.wouldInsert += 1;
        } else if (item.status === "duplicate") {
          result.duplicate += 1;
          if (options.logIndividual !== false) {
            logResearchEvent("info", "raw_signal_duplicate", { sourceId, reason: item.reason });
          }
        } else {
          result[item.status] += 1;
          result.errors.push({ index, sourceId, message: item.error, kind: item.status });
          logResearchEvent(item.status === "failed" ? "error" : "warn", `raw_signal_${item.status}`, {
            index,
            sourceId,
            error: item.error,
          });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, worker));

    if (options.collectionRunId) {
      await collectionRunsCollection(this.database).updateOne(
        { _id: options.collectionRunId },
        {
          $inc: {
            fetchedCount: inputs.length,
            insertedCount: result.inserted,
            duplicateCount: result.duplicate,
            skippedCount: result.skipped,
            failedCount: result.failed,
          },
          $set: { updatedAt: new Date() },
        },
      );
    }
    return result;
  }

  async getPendingRawSignals(limit = this.config.batchSize): Promise<RawSignalDocument[]> {
    return rawSignalsCollection(this.database)
      .find({ processingStatus: "pending" })
      .sort({ collectedAt: 1 })
      .limit(limit)
      .toArray();
  }

  async markRawSignalProcessing(id: ObjectId | string): Promise<void> {
    await this.setProcessingStatus(id, "processing");
  }

  async markRawSignalProcessed(
    id: ObjectId | string,
    status: Extract<ProcessingStatus, "processed" | "no_problem" | "ignored"> = "processed",
  ): Promise<void> {
    await this.setProcessingStatus(id, status, { errorMessage: "" });
  }

  async markRawSignalFailed(id: ObjectId | string, error: unknown): Promise<void> {
    await rawSignalsCollection(this.database).updateOne(
      { _id: toObjectId(id) },
      {
        $set: {
          processingStatus: "failed",
          errorMessage: formatValidationError(error).slice(0, 2_000),
          updatedAt: new Date(),
        },
        $inc: { retryCount: 1 },
      },
    );
  }

  private async setProcessingStatus(
    id: ObjectId | string,
    status: ProcessingStatus,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const update: Record<string, unknown> = {
      processingStatus: status,
      updatedAt: new Date(),
      ...extra,
    };
    if (extra.errorMessage === "") {
      delete update.errorMessage;
      await rawSignalsCollection(this.database).updateOne(
        { _id: toObjectId(id) },
        { $set: update, $unset: { errorMessage: "" } },
      );
      return;
    }
    await rawSignalsCollection(this.database).updateOne(
      { _id: toObjectId(id) },
      { $set: update },
    );
  }

  async getResearchStats(options: { qualityReviewLimit?: number } = {}): Promise<ResearchStats> {
    const signals = rawSignalsCollection(this.database);
    const runs = collectionRunsCollection(this.database);
    const mentions = problemMentionsCollection(this.database);
    const extractionRuns = extractionRunsCollection(this.database);
    const uniqueProblems = uniqueProblemsCollection(this.database);
    const deduplicationRuns = deduplicationRunsCollection(this.database);
    const deduplicationDecisions = deduplicationDecisionsCollection(this.database);
    const [
      totalRawSignals,
      bySource,
      byProcessingStatus,
      byGeographyEvidence,
      byIndustrySeed,
      totalCollectionRuns,
      latestCollectionRun,
      duplicateTotals,
      failedRecordCount,
      redditTotalRawSignals,
      redditByCommunity,
      redditByGeographyEvidence,
      redditByProcessingStatus,
      latestRedditCollectionRun,
      redditDuplicateTotals,
      redditFailedCollectionRuns,
      cfpbTotalRawSignals,
      cfpbByProduct,
      cfpbByIssue,
      cfpbByState,
      cfpbByGeographyEvidence,
      cfpbByProcessingStatus,
      latestCfpbCollectionRun,
      cfpbDuplicateTotals,
      cfpbFailedCollectionRuns,
      totalProblemMentions,
      acceptedProblems,
      noProblemSignals,
      needsReviewMentions,
      failedExtractions,
      problemsByIndustry,
      problemsByAffectedUser,
      problemsByProblemType,
      problemsBySource,
      problemGeography,
      confidenceAverage,
      latestExtractionRun,
      extractionUsage,
    ] = await Promise.all([
      signals.countDocuments(),
      groupedCounts(this.database, signals.collectionName, "source"),
      groupedCounts(this.database, signals.collectionName, "processingStatus"),
      groupedCounts(this.database, signals.collectionName, "geographyEvidence"),
      groupedCounts(this.database, signals.collectionName, "industrySeed"),
      runs.countDocuments(),
      runs.findOne({}, { sort: { startedAt: -1 }, projection: { configurationSnapshot: 0 } }),
      runs.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$duplicateCount" } } }]).next(),
      signals.countDocuments({ processingStatus: "failed" }),
      signals.countDocuments({ source: "reddit" }),
      signals.aggregate<{ _id: unknown; count: number }>([
        { $match: { source: "reddit", sourceCommunity: { $exists: true, $ne: null } } },
        { $group: { _id: "$sourceCommunity", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      signals.aggregate<{ _id: unknown; count: number }>([
        { $match: { source: "reddit" } },
        { $group: { _id: "$geographyEvidence", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      signals.aggregate<{ _id: unknown; count: number }>([
        { $match: { source: "reddit" } },
        { $group: { _id: "$processingStatus", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      runs.findOne(
        { source: "reddit" },
        { sort: { startedAt: -1 }, projection: { configurationSnapshot: 0 } },
      ),
      runs.aggregate<{ total: number }>([
        { $match: { source: "reddit" } },
        { $group: { _id: null, total: { $sum: "$duplicateCount" } } },
      ]).next(),
      runs.countDocuments({ source: "reddit", status: "failed" }),
      signals.countDocuments({ source: "cfpb" }),
      signals.aggregate<{ _id: unknown; count: number }>([
        { $match: { source: "cfpb", "metadata.product": { $exists: true, $ne: null } } },
        { $group: { _id: "$metadata.product", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      signals.aggregate<{ _id: unknown; count: number }>([
        { $match: { source: "cfpb", "metadata.issue": { $exists: true, $ne: null } } },
        { $group: { _id: "$metadata.issue", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      signals.aggregate<{ _id: unknown; count: number }>([
        { $match: { source: "cfpb", "metadata.state": { $exists: true, $ne: null } } },
        { $group: { _id: "$metadata.state", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      signals.aggregate<{ _id: unknown; count: number }>([
        { $match: { source: "cfpb" } },
        { $group: { _id: "$geographyEvidence", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      signals.aggregate<{ _id: unknown; count: number }>([
        { $match: { source: "cfpb" } },
        { $group: { _id: "$processingStatus", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      runs.findOne(
        { source: "cfpb" },
        { sort: { startedAt: -1 }, projection: { configurationSnapshot: 0 } },
      ),
      runs.aggregate<{ total: number }>([
        { $match: { source: "cfpb" } },
        { $group: { _id: null, total: { $sum: "$duplicateCount" } } },
      ]).next(),
      runs.countDocuments({ source: "cfpb", status: "failed" }),
      mentions.countDocuments(),
      mentions.countDocuments({ status: "accepted" }),
      signals.countDocuments({ processingStatus: "no_problem" }),
      mentions.countDocuments({ status: "needs_review" }),
      signals.countDocuments({ processingStatus: "failed" }),
      mentions.aggregate<{ _id: unknown; count: number }>([
        { $match: { industry: { $ne: null } } },
        { $group: { _id: "$industry", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      mentions.aggregate<{ _id: unknown; count: number }>([
        { $match: { affectedUser: { $ne: null } } },
        { $group: { _id: "$affectedUser", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      mentions.aggregate<{ _id: unknown; count: number }>([
        { $group: { _id: "$problemType", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      mentions.aggregate<{ _id: unknown; count: number }>([
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      mentions.aggregate<{ _id: unknown; count: number }>([
        { $group: { _id: "$geography", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      mentions.aggregate<{ average: number }>([
        { $group: { _id: null, average: { $avg: "$extractionConfidence" } } },
      ]).next(),
      extractionRuns.findOne({}, { sort: { startedAt: -1 }, projection: { configurationSnapshot: 0 } }),
      extractionRuns.aggregate<{
        inputTokens: number; outputTokens: number; totalTokens: number; estimatedCost: number;
      }>([{ $group: {
        _id: null,
        inputTokens: { $sum: "$inputTokens" },
        outputTokens: { $sum: "$outputTokens" },
        totalTokens: { $sum: "$totalTokens" },
        estimatedCost: { $sum: "$estimatedCost" },
      } }]).next(),
    ]);
    const publicLatestRun = latestCollectionRun
      ? Object.fromEntries(Object.entries(latestCollectionRun).filter(([key]) => key !== "_id"))
      : null;
    const publicLatestRedditRun = latestRedditCollectionRun
      ? Object.fromEntries(Object.entries(latestRedditCollectionRun).filter(([key]) => key !== "_id"))
      : null;
    const publicLatestCfpbRun = latestCfpbCollectionRun
      ? Object.fromEntries(Object.entries(latestCfpbCollectionRun).filter(([key]) => key !== "_id"))
      : null;
    const rowsToRecord = (rows: Array<{ _id: unknown; count: number }>) =>
      Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
    const publicLatestExtractionRun = latestExtractionRun
      ? Object.fromEntries(Object.entries(latestExtractionRun).filter(([key]) => key !== "_id"))
      : null;
    const deduplicationMinimumConfidence = getDeduplicationConfig().minimumMentionConfidence;
    const [
      eligibleAcceptedMentions,
      waitingMentions,
      uniqueProblemCount,
      createdNewMentions,
      mergedMentions,
      averageMentions,
      deduplicationReviewCount,
      deduplicationFailedCount,
      uniqueByIndustry,
      uniqueByAffectedUser,
      uniqueByProblemType,
      uniqueGeography,
      multiSourceProblemCount,
      averageJudgeConfidence,
      latestDeduplicationRun,
      embeddingModelVersions,
      deduplicationUsage,
    ] = await Promise.all([
      mentions.countDocuments({ status: "accepted", extractionConfidence: { $gte: deduplicationMinimumConfidence } }),
      mentions.countDocuments({
        status: "accepted",
        extractionConfidence: { $gte: deduplicationMinimumConfidence },
        uniqueProblemId: { $exists: false },
        $or: [{ deduplicationStatus: { $exists: false } }, { deduplicationStatus: "pending" }],
      }),
      uniqueProblems.countDocuments({ status: "active" }),
      mentions.countDocuments({ deduplicationStatus: "created_new" }),
      mentions.countDocuments({ deduplicationStatus: "merged_existing" }),
      uniqueProblems.aggregate<{ average: number }>([
        { $match: { status: "active" } },
        { $group: { _id: null, average: { $avg: "$mentionCount" } } },
      ]).next(),
      mentions.countDocuments({ deduplicationStatus: "needs_review" }),
      mentions.countDocuments({ deduplicationStatus: "failed" }),
      uniqueProblems.aggregate<{ _id: unknown; count: number }>([
        { $match: { status: "active" } },
        { $group: { _id: "$industry", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      uniqueProblems.aggregate<{ _id: unknown; count: number }>([
        { $match: { status: "active" } }, { $unwind: "$affectedUsers" },
        { $group: { _id: "$affectedUsers", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      uniqueProblems.aggregate<{ _id: unknown; count: number }>([
        { $match: { status: "active" } }, { $unwind: "$problemTypes" },
        { $group: { _id: "$problemTypes", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      uniqueProblems.aggregate<{ _id: unknown; count: number }>([
        { $match: { status: "active" } },
        { $group: { _id: "$geography", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]).toArray(),
      uniqueProblems.countDocuments({ status: "active", sourceCount: { $gt: 1 } }),
      deduplicationDecisions.aggregate<{ average: number }>([
        { $match: { decisionConfidence: { $exists: true } } },
        { $group: { _id: null, average: { $avg: "$decisionConfidence" } } },
      ]).next(),
      deduplicationRuns.findOne({}, { sort: { startedAt: -1 }, projection: { configurationSnapshot: 0 } }),
      uniqueProblems.aggregate<{ _id: { model: string; version: string }; count: number }>([
        { $match: { status: "active" } },
        { $group: { _id: { model: "$embeddingModel", version: "$embeddingVersion" }, count: { $sum: 1 } } },
      ]).toArray(),
      deduplicationRuns.aggregate<{
        embeddingTokens: number; inputTokens: number; outputTokens: number;
        totalTokens: number; estimatedCost: number;
      }>([{ $group: {
        _id: null,
        embeddingTokens: { $sum: "$embeddingTokens" },
        inputTokens: { $sum: "$inputTokens" },
        outputTokens: { $sum: "$outputTokens" },
        totalTokens: { $sum: "$totalTokens" },
        estimatedCost: { $sum: "$estimatedCost" },
      } }]).next(),
    ]);
    const publicLatestDeduplicationRun = latestDeduplicationRun
      ? Object.fromEntries(Object.entries(latestDeduplicationRun).filter(([key]) => key !== "_id"))
      : null;
    const processedDeduplicationMentions = createdNewMentions + mergedMentions;
    const [
      pendingReviews,
      completedReviews,
      reviewDecisionRows,
      qualityMetrics,
      latestEvaluationRun,
      latestReadiness,
      evaluationVersions,
    ] = await Promise.all([
      humanReviewsCollection(this.database).countDocuments({ reviewStatus: { $in: ["pending", "in_review"] } }),
      humanReviewsCollection(this.database).countDocuments({ reviewStatus: "completed" }),
      humanReviewsCollection(this.database).aggregate<{ _id: unknown; count: number }>([
        { $match: { reviewStatus: "completed", reviewerDecision: { $exists: true } } },
        { $group: { _id: "$reviewerDecision", count: { $sum: 1 } } },
      ]).toArray(),
      calculateReviewMetrics(this.database, options.qualityReviewLimit),
      evaluationRunsCollection(this.database).findOne({}, { sort: { completedAt: -1 } }),
      readinessReportsCollection(this.database).findOne({}, { sort: { generatedAt: -1 } }),
      evaluationItemsCollection(this.database).distinct("datasetVersion"),
    ]);
    return {
      totalRawSignals,
      bySource,
      byProcessingStatus,
      byGeographyEvidence,
      byIndustrySeed,
      totalCollectionRuns,
      latestCollectionRun: publicLatestRun as ResearchStats["latestCollectionRun"],
      duplicateCount: duplicateTotals?.total || 0,
      failedRecordCount,
      reddit: {
        totalRawSignals: redditTotalRawSignals,
        byCommunity: rowsToRecord(redditByCommunity),
        byGeographyEvidence: rowsToRecord(redditByGeographyEvidence),
        byProcessingStatus: rowsToRecord(redditByProcessingStatus),
        latestCollectionRun: publicLatestRedditRun as ResearchStats["reddit"]["latestCollectionRun"],
        duplicateCount: redditDuplicateTotals?.total || 0,
        failedCollectionRuns: redditFailedCollectionRuns,
      },
      cfpb: {
        totalRawSignals: cfpbTotalRawSignals,
        byProduct: rowsToRecord(cfpbByProduct),
        byIssue: rowsToRecord(cfpbByIssue),
        byState: rowsToRecord(cfpbByState),
        byGeographyEvidence: rowsToRecord(cfpbByGeographyEvidence),
        byProcessingStatus: rowsToRecord(cfpbByProcessingStatus),
        latestCollectionRun: publicLatestCfpbRun as ResearchStats["cfpb"]["latestCollectionRun"],
        duplicateCount: cfpbDuplicateTotals?.total || 0,
        failedCollectionRuns: cfpbFailedCollectionRuns,
      },
      extraction: {
        totalProblemMentions,
        acceptedProblems,
        noProblemSignals,
        needsReviewMentions,
        failedExtractions,
        byIndustry: rowsToRecord(problemsByIndustry),
        byAffectedUser: rowsToRecord(problemsByAffectedUser),
        byProblemType: rowsToRecord(problemsByProblemType),
        bySource: rowsToRecord(problemsBySource),
        geographyDistribution: rowsToRecord(problemGeography),
        averageConfidence: confidenceAverage?.average || 0,
        latestRun: publicLatestExtractionRun as ResearchStats["extraction"]["latestRun"],
        inputTokens: extractionUsage?.inputTokens || 0,
        outputTokens: extractionUsage?.outputTokens || 0,
        totalTokens: extractionUsage?.totalTokens || 0,
        estimatedCost: extractionUsage?.estimatedCost || 0,
      },
      deduplication: {
        eligibleAcceptedMentions,
        waitingMentions,
        uniqueProblemCount,
        createdNewMentions,
        mergedMentions,
        averageMentionsPerUniqueProblem: averageMentions?.average || 0,
        duplicateMergeRate: processedDeduplicationMentions
          ? mergedMentions / processedDeduplicationMentions
          : 0,
        reviewCount: deduplicationReviewCount,
        failedCount: deduplicationFailedCount,
        byIndustry: rowsToRecord(uniqueByIndustry),
        byAffectedUser: rowsToRecord(uniqueByAffectedUser),
        byProblemType: rowsToRecord(uniqueByProblemType),
        geographyDistribution: rowsToRecord(uniqueGeography),
        multiSourceProblemCount,
        averageJudgeConfidence: averageJudgeConfidence?.average || 0,
        latestRun: publicLatestDeduplicationRun as ResearchStats["deduplication"]["latestRun"],
        embeddingModelsAndVersions: Object.fromEntries(embeddingModelVersions.map((row) => [
          `${row._id.model}@${row._id.version}`, row.count,
        ])),
        embeddingTokens: deduplicationUsage?.embeddingTokens || 0,
        inputTokens: deduplicationUsage?.inputTokens || 0,
        outputTokens: deduplicationUsage?.outputTokens || 0,
        totalTokens: deduplicationUsage?.totalTokens || 0,
        estimatedCost: deduplicationUsage?.estimatedCost || 0,
      },
      quality: {
        pendingReviews,
        completedReviews,
        reviewDecisionDistribution: rowsToRecord(reviewDecisionRows),
        reviewerAgreement: qualityMetrics.agreement.agreement,
        reviewerDisagreementRate: qualityMetrics.agreement.disagreementRate,
        cohensKappa: qualityMetrics.agreement.cohensKappa,
        geographyAccuracy: (() => {
          const metrics = latestEvaluationRun?.metrics as { geography?: { accuracy?: unknown } } | undefined;
          return typeof metrics?.geography?.accuracy === "number" ? metrics.geography.accuracy : 0;
        })(),
        extractionPrecision: qualityMetrics.extraction.precision,
        extractionRecall: qualityMetrics.extraction.recall,
        extractionF1: qualityMetrics.extraction.f1,
        deduplicationMergePrecision: qualityMetrics.deduplication.mergePrecision,
        duplicateRecall: qualityMetrics.deduplication.duplicateRecall,
        groundingAccuracy: qualityMetrics.groundingAccuracy,
        solutionBiasRate: qualityMetrics.solutionBiasRate,
        unsupportedFieldRate: qualityMetrics.unsupportedFieldRate,
        criticalAuditFindings: latestReadiness
          ? Object.values(latestReadiness.gates).filter((gate) => !gate.passed && gate.comparator === "lte").length
          : 0,
        latestEvaluationRun: latestEvaluationRun
          ? Object.fromEntries(Object.entries(latestEvaluationRun).filter(([key]) => key !== "_id")) as ResearchStats["quality"]["latestEvaluationRun"]
          : null,
        latestReadinessStatus: latestReadiness?.status || null,
        evaluationDatasetVersions: evaluationVersions.sort(),
      },
    };
  }
}

export const researchRepository = new ResearchRepository();

export const createCollectionRun = researchRepository.createCollectionRun.bind(researchRepository);
export const completeCollectionRun = researchRepository.completeCollectionRun.bind(researchRepository);
export const failCollectionRun = researchRepository.failCollectionRun.bind(researchRepository);
export const incrementCollectionRunCounters = researchRepository.incrementCollectionRunCounters.bind(researchRepository);
export const insertRawSignal = researchRepository.insertRawSignal.bind(researchRepository);
export const insertRawSignalsBatch = researchRepository.insertRawSignalsBatch.bind(researchRepository);
export const findRawSignalBySourceId = researchRepository.findRawSignalBySourceId.bind(researchRepository);
export const findRawSignalByContentHash = researchRepository.findRawSignalByContentHash.bind(researchRepository);
export const getPendingRawSignals = researchRepository.getPendingRawSignals.bind(researchRepository);
export const markRawSignalProcessing = researchRepository.markRawSignalProcessing.bind(researchRepository);
export const markRawSignalProcessed = researchRepository.markRawSignalProcessed.bind(researchRepository);
export const markRawSignalFailed = researchRepository.markRawSignalFailed.bind(researchRepository);
export const getResearchStats = researchRepository.getResearchStats.bind(researchRepository);
