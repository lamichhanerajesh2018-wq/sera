import { ObjectId, type Db, type Filter } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import {
  extractionRunsCollection,
  problemMentionsCollection,
  rawSignalsCollection,
} from "../models.ts";
import type {
  CollectionRunStatus,
  ExtractionRunDocument,
  ProblemMentionDocument,
  RawSignalDocument,
  ResearchSource,
} from "../types.ts";

export interface ExtractionFilters {
  source?: ResearchSource;
  community?: string;
}

export interface ExtractionRunIncrement {
  attemptedCount?: number;
  acceptedProblemCount?: number;
  noProblemCount?: number;
  needsReviewCount?: number;
  failedCount?: number;
  retryCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
}

function id(value: ObjectId | string): ObjectId {
  return value instanceof ObjectId ? value : new ObjectId(value);
}

function signalFilter(status: RawSignalDocument["processingStatus"], filters: ExtractionFilters) {
  return {
    processingStatus: status,
    ...(filters.source && { source: filters.source }),
    ...(filters.community && { sourceCommunity: filters.community }),
  } as Filter<RawSignalDocument>;
}

export class ExtractionRepository {
  constructor(private readonly database: Db = defaultDb) {}

  async createRun(input: {
    model: string;
    promptVersion: string;
    dryRun: boolean;
    configurationSnapshot: Record<string, unknown>;
  }): Promise<ExtractionRunDocument> {
    const now = new Date();
    const document: ExtractionRunDocument = {
      startedAt: now,
      model: input.model,
      promptVersion: input.promptVersion,
      attemptedCount: 0,
      acceptedProblemCount: 0,
      noProblemCount: 0,
      needsReviewCount: 0,
      failedCount: 0,
      retryCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      dryRun: input.dryRun,
      status: "running",
      configurationSnapshot: input.configurationSnapshot,
      createdAt: now,
      updatedAt: now,
    };
    const result = await extractionRunsCollection(this.database).insertOne(document);
    document._id = result.insertedId;
    return document;
  }

  async incrementRun(runId: ObjectId | string, counters: ExtractionRunIncrement): Promise<void> {
    const increments = Object.fromEntries(Object.entries(counters).filter(([, value]) => value));
    if (!Object.keys(increments).length) return;
    await extractionRunsCollection(this.database).updateOne(
      { _id: id(runId) },
      { $inc: increments, $set: { updatedAt: new Date() } },
    );
  }

  async completeRun(runId: ObjectId | string, status: Extract<CollectionRunStatus, "completed" | "partially_completed">) {
    const now = new Date();
    await extractionRunsCollection(this.database).updateOne(
      { _id: id(runId) },
      { $set: { status, completedAt: now, updatedAt: now } },
    );
  }

  async failRun(runId: ObjectId | string, error: unknown): Promise<void> {
    const now = new Date();
    await extractionRunsCollection(this.database).updateOne(
      { _id: id(runId) },
      { $set: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000),
        completedAt: now,
        updatedAt: now,
      } },
    );
  }

  async claimNextSignal(input: {
    runId: ObjectId;
    workerId: string;
    filters: ExtractionFilters;
    now?: Date;
  }): Promise<RawSignalDocument | null> {
    const now = input.now || new Date();
    return rawSignalsCollection(this.database).findOneAndUpdate(
      signalFilter("pending", input.filters),
      { $set: {
        processingStatus: "processing",
        processingStartedAt: now,
        processingWorkerId: input.workerId,
        extractionRunId: input.runId,
        updatedAt: now,
      }, $unset: { errorMessage: "", rejectionReason: "" } },
      { sort: { collectedAt: 1 }, returnDocument: "after" },
    );
  }

  async listPendingSignals(limit: number, filters: ExtractionFilters): Promise<RawSignalDocument[]> {
    return rawSignalsCollection(this.database)
      .find(signalFilter("pending", filters))
      .sort({ collectedAt: 1 })
      .limit(limit)
      .toArray();
  }

  async recoverStaleProcessing(staleBefore: Date): Promise<number> {
    const result = await rawSignalsCollection(this.database).updateMany(
      { processingStatus: "processing", processingStartedAt: { $lt: staleBefore } },
      {
        $set: { processingStatus: "pending", updatedAt: new Date() },
        $inc: { retryCount: 1 },
        $unset: { processingStartedAt: "", processingWorkerId: "", extractionRunId: "" },
      },
    );
    return result.modifiedCount;
  }

  async requeueFailedSignals(retryLimit: number, filters: ExtractionFilters): Promise<number> {
    const result = await rawSignalsCollection(this.database).updateMany(
      { ...signalFilter("failed", filters), retryCount: { $lt: retryLimit } },
      {
        $set: { processingStatus: "pending", updatedAt: new Date() },
        $unset: {
          errorMessage: "", rejectionReason: "", processingStartedAt: "",
          processingWorkerId: "", extractionRunId: "",
        },
      },
    );
    return result.modifiedCount;
  }

  async findMentionByRawSignalId(rawSignalId: ObjectId | string) {
    return problemMentionsCollection(this.database).findOne({ rawSignalId: id(rawSignalId) });
  }

  async insertMention(document: ProblemMentionDocument): Promise<"inserted" | "duplicate"> {
    try {
      await problemMentionsCollection(this.database).insertOne(document);
      return "inserted";
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) return "duplicate";
      throw error;
    }
  }

  async markProcessed(rawSignalId: ObjectId | string): Promise<void> {
    await this.finishSignal(rawSignalId, "processed");
  }

  async markNoProblem(rawSignalId: ObjectId | string, rejectionReason: string): Promise<void> {
    await this.finishSignal(rawSignalId, "no_problem", { rejectionReason: rejectionReason.slice(0, 500) });
  }

  async markFailed(rawSignalId: ObjectId | string, error: unknown): Promise<void> {
    await rawSignalsCollection(this.database).updateOne(
      { _id: id(rawSignalId), processingStatus: "processing" },
      {
        $set: {
          processingStatus: "failed",
          errorMessage: error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000),
          updatedAt: new Date(),
        },
        $inc: { retryCount: 1 },
        $unset: { processingStartedAt: "", processingWorkerId: "" },
      },
    );
  }

  private async finishSignal(
    rawSignalId: ObjectId | string,
    status: "processed" | "no_problem",
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await rawSignalsCollection(this.database).updateOne(
      { _id: id(rawSignalId), processingStatus: "processing" },
      {
        $set: { processingStatus: status, updatedAt: new Date(), ...extra },
        $unset: { errorMessage: "", processingStartedAt: "", processingWorkerId: "" },
      },
    );
  }

  async inspectMentions(limit: number) {
    const mentions = await problemMentionsCollection(this.database)
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    const signalIds = mentions.map((mention) => mention.rawSignalId);
    const signals = signalIds.length
      ? await rawSignalsCollection(this.database).find({ _id: { $in: signalIds } }).toArray()
      : [];
    const byId = new Map(signals.map((signal) => [signal._id?.toString(), signal]));
    return mentions.map((mention) => ({ mention, signal: byId.get(mention.rawSignalId.toString()) }));
  }
}
