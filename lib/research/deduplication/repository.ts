import { ObjectId, type ClientSession, type Db, type Filter } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import {
  deduplicationDecisionsCollection,
  deduplicationRunsCollection,
  problemMentionsCollection,
  rawSignalsCollection,
  uniqueProblemsCollection,
} from "../models.ts";
import type {
  CollectionRunStatus,
  DeduplicationDecisionDocument,
  DeduplicationRunDocument,
  ProblemMentionDocument,
  ResearchSource,
  UniqueProblemDocument,
} from "../types.ts";
import { cosineSimilarity } from "./text.ts";

export interface DeduplicationFilters {
  source?: ResearchSource;
  community?: string;
  industry?: string;
  minimumConfidence: number;
}

export interface DeduplicationRunIncrement {
  attemptedMentions?: number;
  embeddingsGenerated?: number;
  newUniqueProblems?: number;
  mergedMentions?: number;
  relatedButDistinctDecisions?: number;
  differentProblemDecisions?: number;
  uncertainReviewDecisions?: number;
  failedCount?: number;
  retryCount?: number;
  embeddingTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
}

export interface SemanticCandidate {
  problem: UniqueProblemDocument;
  similarity: number;
}

function eligibilityFilter(filters: DeduplicationFilters): Filter<ProblemMentionDocument> {
  return {
    status: "accepted",
    extractionConfidence: { $gte: filters.minimumConfidence },
    uniqueProblemId: { $exists: false },
    $or: [
      { deduplicationStatus: { $exists: false } },
      { deduplicationStatus: "pending" },
    ],
    ...(filters.source && { source: filters.source }),
    ...(filters.community && { sourceCommunity: filters.community }),
    ...(filters.industry && { industry: filters.industry }),
  };
}

function transactionUnsupported(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (
    ("code" in error && [20, 303].includes(Number(error.code))) ||
    ("message" in error && /transaction numbers are only allowed|transactions are not supported/i.test(String(error.message)))
  ));
}

export class DeduplicationRepository {
  constructor(private readonly database: Db = defaultDb) {}

  async createRun(input: {
    embeddingModel: string;
    duplicateJudgeModel: string;
    embeddingVersion: string;
    promptVersion: string;
    configurationSnapshot: Record<string, unknown>;
  }): Promise<DeduplicationRunDocument> {
    const now = new Date();
    const document: DeduplicationRunDocument = {
      startedAt: now,
      ...input,
      attemptedMentions: 0,
      embeddingsGenerated: 0,
      newUniqueProblems: 0,
      mergedMentions: 0,
      relatedButDistinctDecisions: 0,
      differentProblemDecisions: 0,
      uncertainReviewDecisions: 0,
      failedCount: 0,
      retryCount: 0,
      embeddingTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      dryRun: false,
      status: "running",
      createdAt: now,
      updatedAt: now,
    };
    const inserted = await deduplicationRunsCollection(this.database).insertOne(document);
    document._id = inserted.insertedId;
    return document;
  }

  async incrementRun(runId: ObjectId, counters: DeduplicationRunIncrement): Promise<void> {
    const increments = Object.fromEntries(Object.entries(counters).filter(([, value]) => value));
    if (!Object.keys(increments).length) return;
    await deduplicationRunsCollection(this.database).updateOne(
      { _id: runId }, { $inc: increments, $set: { updatedAt: new Date() } },
    );
  }

  async completeRun(runId: ObjectId, status: Extract<CollectionRunStatus, "completed" | "partially_completed">) {
    const now = new Date();
    await deduplicationRunsCollection(this.database).updateOne(
      { _id: runId }, { $set: { status, completedAt: now, updatedAt: now } },
    );
  }

  async failRun(runId: ObjectId, error: unknown) {
    const now = new Date();
    await deduplicationRunsCollection(this.database).updateOne(
      { _id: runId },
      { $set: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000),
        completedAt: now,
        updatedAt: now,
      } },
    );
  }

  async claimNextMention(input: {
    runId: ObjectId;
    workerId: string;
    filters: DeduplicationFilters;
    now: Date;
  }): Promise<ProblemMentionDocument | null> {
    return problemMentionsCollection(this.database).findOneAndUpdate(
      eligibilityFilter(input.filters),
      { $set: {
        deduplicationStatus: "processing",
        deduplicationRunId: input.runId,
        deduplicationStartedAt: input.now,
        deduplicationWorkerId: input.workerId,
        updatedAt: input.now,
      }, $unset: { deduplicationError: "" } },
      { sort: { createdAt: 1 }, returnDocument: "after" },
    );
  }

  async listEligibleMentions(limit: number, filters: DeduplicationFilters) {
    return problemMentionsCollection(this.database)
      .find(eligibilityFilter(filters)).sort({ createdAt: 1 }).limit(limit).toArray();
  }

  async recoverStale(staleBefore: Date): Promise<number> {
    const result = await problemMentionsCollection(this.database).updateMany(
      {
        deduplicationStatus: "processing",
        uniqueProblemId: { $exists: false },
        deduplicationStartedAt: { $lt: staleBefore },
      },
      {
        $set: { deduplicationStatus: "pending", updatedAt: new Date() },
        $inc: { deduplicationRetryCount: 1 },
        $unset: {
          deduplicationRunId: "", deduplicationStartedAt: "", deduplicationWorkerId: "",
        },
      },
    );
    return result.modifiedCount;
  }

  async requeueFailed(retryLimit: number, filters: Omit<DeduplicationFilters, "minimumConfidence">): Promise<number> {
    const result = await problemMentionsCollection(this.database).updateMany(
      {
        status: "accepted",
        deduplicationStatus: "failed",
        uniqueProblemId: { $exists: false },
        deduplicationRetryCount: { $lt: retryLimit },
        ...(filters.source && { source: filters.source }),
        ...(filters.community && { sourceCommunity: filters.community }),
        ...(filters.industry && { industry: filters.industry }),
      },
      { $set: { deduplicationStatus: "pending", updatedAt: new Date() }, $unset: { deduplicationError: "" } },
    );
    return result.modifiedCount;
  }

  async saveMentionEmbedding(
    mentionId: ObjectId,
    runId: ObjectId,
    embedding: number[],
    model: string,
    version: string,
  ) {
    const result = await problemMentionsCollection(this.database).updateOne(
      { _id: mentionId, deduplicationStatus: "processing", deduplicationRunId: runId },
      { $set: {
        embedding, embeddingModel: model, embeddingDimensions: embedding.length,
        embeddingVersion: version, updatedAt: new Date(),
      } },
    );
    if (!result.matchedCount) throw new Error("Mention claim was lost before saving its embedding");
  }

  async findExactCandidate(normalizedKey: string) {
    return uniqueProblemsCollection(this.database).findOne({ normalizedKey, status: "active" });
  }

  async findRawSignal(rawSignalId: ObjectId) {
    return rawSignalsCollection(this.database).findOne({ _id: rawSignalId });
  }

  async recordDecision(decision: DeduplicationDecisionDocument) {
    await deduplicationDecisionsCollection(this.database).insertOne(decision);
  }

  async findSemanticCandidates(input: {
    embedding: number[];
    model: string;
    dimensions: number;
    version: string;
    minimumSimilarity: number;
    candidateLimit: number;
    scanLimit: number;
    excludeId?: ObjectId;
  }): Promise<SemanticCandidate[]> {
    const problems = await uniqueProblemsCollection(this.database).find({
      status: "active",
      embeddingModel: input.model,
      embeddingDimensions: input.dimensions,
      embeddingVersion: input.version,
      ...(input.excludeId && { _id: { $ne: input.excludeId } }),
    }).limit(input.scanLimit).toArray();
    return problems
      .map((problem) => ({ problem, similarity: cosineSimilarity(input.embedding, problem.embedding) }))
      .filter((candidate) => candidate.similarity >= input.minimumSimilarity)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, input.candidateLimit);
  }

  async countCompatibleCandidates(input: {
    model: string;
    dimensions: number;
    version: string;
    excludeId?: ObjectId;
  }) {
    return uniqueProblemsCollection(this.database).countDocuments({
      status: "active",
      embeddingModel: input.model,
      embeddingDimensions: input.dimensions,
      embeddingVersion: input.version,
      ...(input.excludeId && { _id: { $ne: input.excludeId } }),
    });
  }

  async createAndLink(input: {
    mention: ProblemMentionDocument;
    uniqueProblem: UniqueProblemDocument;
    decision: DeduplicationDecisionDocument;
    runId: ObjectId;
  }): Promise<"created" | "duplicate_key"> {
    try {
      await this.withOptionalTransaction(async (session) => {
        const inserted = await uniqueProblemsCollection(this.database).insertOne(input.uniqueProblem, { session });
        input.uniqueProblem._id = inserted.insertedId;
        input.decision.finalUniqueProblemId = inserted.insertedId;
        const linked = await problemMentionsCollection(this.database).updateOne(
          {
            _id: input.mention._id,
            deduplicationStatus: "processing",
            deduplicationRunId: input.runId,
            uniqueProblemId: { $exists: false },
          },
          { $set: {
            uniqueProblemId: inserted.insertedId,
            deduplicationStatus: "created_new",
            duplicateDecision: "different_problem",
            deduplicationRunId: input.runId,
            deduplicatedAt: input.decision.processedAt,
            updatedAt: input.decision.processedAt,
          }, $unset: {
            deduplicationStartedAt: "", deduplicationWorkerId: "", deduplicationError: "",
          } },
          { session },
        );
        if (!linked.matchedCount) throw new Error("Mention claim was lost before linking a new unique problem");
        await deduplicationDecisionsCollection(this.database).insertOne(input.decision, { session });
      }, async () => {
        if (input.uniqueProblem._id) {
          await uniqueProblemsCollection(this.database).deleteOne({ _id: input.uniqueProblem._id });
          await problemMentionsCollection(this.database).updateOne(
            { _id: input.mention._id, uniqueProblemId: input.uniqueProblem._id },
            { $set: { deduplicationStatus: "processing", updatedAt: new Date() }, $unset: {
              uniqueProblemId: "", duplicateDecision: "", deduplicatedAt: "",
            } },
          );
        }
      });
      return "created";
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) return "duplicate_key";
      throw error;
    }
  }

  async mergeAndLink(input: {
    mention: ProblemMentionDocument;
    previous: UniqueProblemDocument;
    merged: UniqueProblemDocument;
    decision: DeduplicationDecisionDocument;
    runId: ObjectId;
    similarity: number;
    confidence: number;
    duplicateDecision: "same_problem";
  }): Promise<void> {
    await this.withOptionalTransaction(async (session) => {
      const updated = await uniqueProblemsCollection(this.database).replaceOne(
        { _id: input.previous._id, status: "active", mentionCount: input.previous.mentionCount },
        input.merged,
        { session },
      );
      if (!updated.matchedCount) throw new Error("Concurrent unique-problem update detected; retry safely");
      const linked = await problemMentionsCollection(this.database).updateOne(
        {
          _id: input.mention._id,
          deduplicationStatus: "processing",
          deduplicationRunId: input.runId,
          uniqueProblemId: { $exists: false },
        },
        { $set: {
          uniqueProblemId: input.previous._id,
          deduplicationStatus: "merged_existing",
          candidateSimilarity: input.similarity,
          duplicateDecision: input.duplicateDecision,
          duplicateDecisionConfidence: input.confidence,
          deduplicationRunId: input.runId,
          deduplicatedAt: input.decision.processedAt,
          updatedAt: input.decision.processedAt,
        }, $unset: {
          deduplicationStartedAt: "", deduplicationWorkerId: "", deduplicationError: "",
        } },
        { session },
      );
      if (!linked.matchedCount) throw new Error("Mention claim was lost before merge linking");
      await deduplicationDecisionsCollection(this.database).insertOne(input.decision, { session });
    }, async () => {
      await uniqueProblemsCollection(this.database).replaceOne({ _id: input.previous._id }, input.previous);
      await problemMentionsCollection(this.database).updateOne(
        { _id: input.mention._id, uniqueProblemId: input.previous._id },
        { $set: { deduplicationStatus: "processing", updatedAt: new Date() }, $unset: {
          uniqueProblemId: "", candidateSimilarity: "", duplicateDecision: "",
          duplicateDecisionConfidence: "", deduplicatedAt: "",
        } },
      );
    });
  }

  async markNeedsReview(input: {
    mentionId: ObjectId;
    runId: ObjectId;
    decision: DeduplicationDecisionDocument;
    similarity?: number;
    confidence?: number;
  }) {
    await this.withOptionalTransaction(async (session) => {
      const result = await problemMentionsCollection(this.database).updateOne(
        { _id: input.mentionId, deduplicationStatus: "processing", deduplicationRunId: input.runId },
        { $set: {
          deduplicationStatus: "needs_review",
          candidateSimilarity: input.similarity,
          duplicateDecision: "uncertain",
          duplicateDecisionConfidence: input.confidence,
          deduplicatedAt: input.decision.processedAt,
          updatedAt: input.decision.processedAt,
        }, $unset: { deduplicationStartedAt: "", deduplicationWorkerId: "" } },
        { session },
      );
      if (!result.matchedCount) throw new Error("Mention claim was lost before review routing");
      await deduplicationDecisionsCollection(this.database).insertOne(input.decision, { session });
    });
  }

  async markFailed(mentionId: ObjectId, runId: ObjectId, error: unknown) {
    await problemMentionsCollection(this.database).updateOne(
      { _id: mentionId, deduplicationStatus: "processing", deduplicationRunId: runId },
      { $set: {
        deduplicationStatus: "failed",
        deduplicationError: error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000),
        updatedAt: new Date(),
      }, $inc: { deduplicationRetryCount: 1 }, $unset: {
        deduplicationStartedAt: "", deduplicationWorkerId: "",
      } },
    );
  }

  async inspectUniqueProblems(limit: number) {
    const problems = await uniqueProblemsCollection(this.database).find({ status: "active" })
      .sort({ mentionCount: -1, updatedAt: -1 }).limit(limit).toArray();
    return Promise.all(problems.map(async (problem) => {
      const mentions = await problemMentionsCollection(this.database).find({ uniqueProblemId: problem._id })
        .limit(3).toArray();
      return { problem, evidencePreviews: mentions.map((mention) => mention.evidenceText.slice(0, 160)) };
    }));
  }

  async inspectDecisions(limit: number) {
    const decisions = await deduplicationDecisionsCollection(this.database).find({})
      .sort({ processedAt: -1 }).limit(limit).toArray();
    return Promise.all(decisions.map(async (decision) => ({
      decision,
      mention: await problemMentionsCollection(this.database).findOne({ _id: decision.mentionId }),
      candidate: decision.candidateUniqueProblemId
        ? await uniqueProblemsCollection(this.database).findOne({ _id: decision.candidateUniqueProblemId })
        : null,
    })));
  }

  async countEmbeddingsNeedingRebuild(model: string, version: string) {
    return problemMentionsCollection(this.database).countDocuments({
      status: "accepted",
      $or: [
        { embeddingModel: { $ne: model } },
        { embeddingVersion: { $ne: version } },
        { embedding: { $exists: false } },
      ],
    });
  }

  async listEmbeddingsNeedingRebuild(model: string, version: string, limit: number) {
    return problemMentionsCollection(this.database).find({
      status: "accepted",
      $or: [
        { embeddingModel: { $ne: model } },
        { embeddingVersion: { $ne: version } },
        { embedding: { $exists: false } },
      ],
    }).limit(limit).toArray();
  }

  async replaceMentionEmbedding(
    mentionId: ObjectId,
    embedding: number[],
    model: string,
    version: string,
  ) {
    await problemMentionsCollection(this.database).updateOne(
      { _id: mentionId },
      { $set: { embedding, embeddingModel: model, embeddingDimensions: embedding.length, embeddingVersion: version, updatedAt: new Date() } },
    );
  }

  async countUniqueEmbeddingsNeedingRebuild(model: string, version: string) {
    return uniqueProblemsCollection(this.database).countDocuments({
      status: "active",
      $or: [
        { embeddingModel: { $ne: model } },
        { embeddingVersion: { $ne: version } },
        { embedding: { $exists: false } },
      ],
    });
  }

  async listUniqueEmbeddingsNeedingRebuild(model: string, version: string, limit: number) {
    return uniqueProblemsCollection(this.database).find({
      status: "active",
      $or: [
        { embeddingModel: { $ne: model } },
        { embeddingVersion: { $ne: version } },
        { embedding: { $exists: false } },
      ],
    }).limit(limit).toArray();
  }

  async replaceUniqueProblemEmbedding(
    problemId: ObjectId,
    embedding: number[],
    model: string,
    version: string,
  ) {
    await uniqueProblemsCollection(this.database).updateOne(
      { _id: problemId, status: "active" },
      { $set: { embedding, embeddingModel: model, embeddingDimensions: embedding.length, embeddingVersion: version, updatedAt: new Date() } },
    );
  }

  private async withOptionalTransaction(
    work: (session?: ClientSession) => Promise<void>,
    compensate?: () => Promise<void>,
  ): Promise<void> {
    const client = this.database.client;
    if (!client?.startSession) {
      try { await work(undefined); } catch (error) {
        await compensate?.();
        throw error;
      }
      return;
    }
    const session = client.startSession();
    try {
      await session.withTransaction(() => work(session));
    } catch (error) {
      if (!transactionUnsupported(error)) throw error;
      try { await work(undefined); } catch (fallbackError) {
        await compensate?.();
        throw fallbackError;
      }
    } finally {
      await session.endSession();
    }
  }
}
