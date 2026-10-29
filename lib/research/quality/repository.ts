import { createHash } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import {
  correctionAuditsCollection,
  deduplicationDecisionsCollection,
  humanReviewsCollection,
  problemMentionsCollection,
  rawSignalsCollection,
  uniqueProblemsCollection,
} from "../models.ts";
import type {
  CorrectionAuditDocument,
  HumanReviewDocument,
  ReviewTargetType,
} from "../types.ts";
import { buildNormalizedProblemKey } from "../deduplication/text.ts";
import { parseReviewSubmission, reviewImportItemSchema } from "./schema.ts";

export interface ReviewQueueOptions {
  targetType?: ReviewTargetType;
  sampleSize: number;
  source?: string;
  industry?: string;
  status?: string;
  minimumConfidence?: number;
  maximumConfidence?: number;
  decision?: string;
  stratified?: boolean;
  seed: string;
  dryRun?: boolean;
  reviewRound?: number;
}

interface ReviewCandidate {
  targetType: ReviewTargetType;
  targetId: ObjectId;
  riskScore: number;
  strata: string[];
  sourceModel?: string;
  sourcePromptVersion?: string;
  sourceEmbeddingVersion?: string;
  sourceJudgePromptVersion?: string;
}

function deterministicRank(seed: string, candidate: ReviewCandidate) {
  return createHash("sha256").update(`${seed}:${candidate.targetType}:${candidate.targetId}`).digest("hex");
}

function near(value: number | undefined, thresholds: number[]) {
  return value === undefined ? 0 : Math.max(0, 1 - Math.min(...thresholds.map((threshold) => Math.abs(value - threshold))) * 10);
}

export class QualityRepository {
  constructor(private readonly database: Db = defaultDb) {}

  async generateQueue(options: ReviewQueueOptions) {
    const candidates = await this.collectCandidates(options);
    const ordered = candidates.sort((left, right) =>
      right.riskScore - left.riskScore || deterministicRank(options.seed, left).localeCompare(deterministicRank(options.seed, right)));
    const selected = options.stratified ? this.stratify(ordered, options.sampleSize) : ordered.slice(0, options.sampleSize);
    if (options.dryRun) return { selected, created: 0, existing: 0 };
    let created = 0;
    let existing = 0;
    for (const candidate of selected) {
      const now = new Date();
      const review: HumanReviewDocument = {
        ...candidate,
        reviewRound: options.reviewRound || 1,
        reviewStatus: "pending",
        createdAt: now,
        updatedAt: now,
      };
      try {
        await humanReviewsCollection(this.database).insertOne(review);
        created += 1;
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === 11000) existing += 1;
        else throw error;
      }
    }
    return { selected, created, existing };
  }

  private async collectCandidates(options: ReviewQueueOptions): Promise<ReviewCandidate[]> {
    const result: ReviewCandidate[] = [];
    if (!options.targetType || options.targetType === "problem_mention") {
      const mentions = await problemMentionsCollection(this.database).find({
        ...(options.source && { source: options.source }),
        ...(options.industry && { industry: options.industry }),
        ...(options.status && { status: options.status }),
        ...(options.minimumConfidence !== undefined && { extractionConfidence: { $gte: options.minimumConfidence } }),
        ...(options.maximumConfidence !== undefined && { extractionConfidence: { $lte: options.maximumConfidence } }),
      } as never).toArray();
      for (const item of mentions) if (item._id) {
        const risk = near(item.extractionConfidence, [0.55, 0.75])
          + (item.status === "needs_review" ? 2 : 0)
          + (item.deduplicationStatus === "needs_review" || item.deduplicationStatus === "failed" ? 2 : 0)
          + (item.canonicalProblem.length < 40 ? 1 : 0)
          + (item.geography === "unknown" ? 0.5 : 0);
        result.push({
          targetType: "problem_mention", targetId: item._id, riskScore: risk,
          strata: [`source:${item.source}`, `industry:${item.industry || "unknown"}`, `geography:${item.geography}`, `prompt:${item.promptVersion}`],
          sourceModel: item.model, sourcePromptVersion: item.promptVersion,
          sourceEmbeddingVersion: item.embeddingVersion,
        });
      }
    }
    if (!options.targetType || options.targetType === "raw_signal") {
      const signals = await rawSignalsCollection(this.database).find({
        processingStatus: { $in: ["no_problem", "failed"] },
        ...(options.source && { source: options.source }),
        ...(options.status && { processingStatus: options.status }),
      } as never).toArray();
      for (const item of signals) if (item._id) result.push({
        targetType: "raw_signal", targetId: item._id,
        riskScore: item.processingStatus === "failed" ? 3 : 1,
        strata: [`source:${item.source}`, `status:${item.processingStatus}`, `geography:${item.geographyEvidence}`],
      });
    }
    if (!options.targetType || options.targetType === "unique_problem") {
      const problems = await uniqueProblemsCollection(this.database).find({
        ...(options.industry && { industry: options.industry }),
        ...(options.status && { status: options.status }),
      } as never).toArray();
      for (const item of problems) if (item._id) result.push({
        targetType: "unique_problem", targetId: item._id,
        riskScore: (item.mentionCount >= 25 ? 4 : item.mentionCount / 25) + (item.sourceCount === 1 && item.mentionCount > 3 ? 2 : 0),
        strata: [`industry:${item.industry}`, `geography:${item.geography}`, `embedding:${item.embeddingVersion}`],
        sourceEmbeddingVersion: item.embeddingVersion,
      });
    }
    if (!options.targetType || options.targetType === "deduplication_decision") {
      const decisions = await deduplicationDecisionsCollection(this.database).find({
        ...(options.decision && { decision: options.decision }),
      } as never).toArray();
      for (const item of decisions) if (item._id) result.push({
        targetType: "deduplication_decision", targetId: item._id,
        riskScore: near(item.similarity, [0.7, 0.78, 0.92])
          + (item.decision === "uncertain" ? 3 : 0)
          + (item.decision === "same_problem" ? 1 : 0),
        strata: [`decision:${item.decision}`, `judge-prompt:${item.promptVersion}`],
        sourceModel: item.model, sourceJudgePromptVersion: item.promptVersion,
      });
    }
    return result;
  }

  private stratify(candidates: ReviewCandidate[], sampleSize: number) {
    const selected: ReviewCandidate[] = [];
    const used = new Set<string>();
    const strata = new Map<string, ReviewCandidate[]>();
    for (const candidate of candidates) for (const stratum of candidate.strata) {
      strata.set(stratum, [...(strata.get(stratum) || []), candidate]);
    }
    for (const bucket of strata.values()) {
      const candidate = bucket.find((item) => !used.has(`${item.targetType}:${item.targetId}`));
      if (candidate && selected.length < sampleSize) {
        selected.push(candidate);
        used.add(`${candidate.targetType}:${candidate.targetId}`);
      }
    }
    for (const candidate of candidates) {
      if (selected.length >= sampleSize) break;
      const key = `${candidate.targetType}:${candidate.targetId}`;
      if (!used.has(key)) { selected.push(candidate); used.add(key); }
    }
    return selected;
  }

  async claimNextReview(reviewerId?: string) {
    return humanReviewsCollection(this.database).findOneAndUpdate(
      { reviewStatus: "pending" },
      { $set: { reviewStatus: "in_review", ...(reviewerId && { reviewerId }), updatedAt: new Date() } },
      { sort: { riskScore: -1, createdAt: 1 }, returnDocument: "after" },
    );
  }

  async getReview(reviewId: ObjectId) { return humanReviewsCollection(this.database).findOne({ _id: reviewId }); }

  async submitReview(reviewId: ObjectId, input: unknown) {
    const submission = parseReviewSubmission(input);
    const now = new Date();
    const result = await humanReviewsCollection(this.database).updateOne(
      { _id: reviewId, reviewStatus: { $in: ["pending", "in_review"] } },
      { $set: { ...submission, reviewStatus: "completed", reviewedAt: now, updatedAt: now } },
    );
    if (!result.matchedCount) throw new Error("Review does not exist or is no longer active");
    return humanReviewsCollection(this.database).findOne({ _id: reviewId });
  }

  async createSecondReview(reviewId: ObjectId) {
    const original = await humanReviewsCollection(this.database).findOne({ _id: reviewId, reviewStatus: "completed" });
    if (!original) throw new Error("A completed first review is required");
    if (original.reviewRound !== 1) throw new Error("Only a first-round review can request a second review");
    const existing = await humanReviewsCollection(this.database).findOne({
      targetType: original.targetType, targetId: original.targetId, reviewRound: 2,
    });
    if (existing) return { review: existing, created: false };
    const now = new Date();
    const second: HumanReviewDocument = {
      targetType: original.targetType,
      targetId: original.targetId,
      reviewRound: 2,
      reviewStatus: "pending",
      riskScore: original.riskScore,
      strata: [...original.strata, "second-review"],
      ...(original.sourceModel && { sourceModel: original.sourceModel }),
      ...(original.sourcePromptVersion && { sourcePromptVersion: original.sourcePromptVersion }),
      ...(original.sourceEmbeddingVersion && { sourceEmbeddingVersion: original.sourceEmbeddingVersion }),
      ...(original.sourceJudgePromptVersion && { sourceJudgePromptVersion: original.sourceJudgePromptVersion }),
      createdAt: now,
      updatedAt: now,
    };
    const result = await humanReviewsCollection(this.database).insertOne(second);
    second._id = result.insertedId;
    return { review: second, created: true };
  }

  async skipReview(reviewId: ObjectId, notes?: string) {
    const result = await humanReviewsCollection(this.database).updateOne(
      { _id: reviewId, reviewStatus: { $in: ["pending", "in_review"] } },
      { $set: { reviewStatus: "skipped", ...(notes && { reviewerNotes: notes.slice(0, 2_000) }), updatedAt: new Date() } },
    );
    if (!result.matchedCount) throw new Error("Review does not exist or is no longer active");
  }

  async targetExists(type: ReviewTargetType, targetId: ObjectId) {
    if (type === "raw_signal") return Boolean(await rawSignalsCollection(this.database).findOne({ _id: targetId }));
    if (type === "problem_mention") return Boolean(await problemMentionsCollection(this.database).findOne({ _id: targetId }));
    if (type === "unique_problem") return Boolean(await uniqueProblemsCollection(this.database).findOne({ _id: targetId }));
    return Boolean(await deduplicationDecisionsCollection(this.database).findOne({ _id: targetId }));
  }

  async listReviews(filter: Record<string, unknown> = {}) {
    return humanReviewsCollection(this.database).find(filter).sort({ createdAt: 1 }).toArray();
  }

  async importReviews(items: unknown[], dryRun: boolean) {
    const result = { total: items.length, valid: 0, imported: 0, failed: 0, errors: [] as Array<{ index: number; error: string }> };
    for (let index = 0; index < items.length; index += 1) {
      try {
        const parsed = reviewImportItemSchema.parse(items[index]);
        const reviewId = new ObjectId(parsed.reviewId);
        const review = await this.getReview(reviewId);
        if (!review) throw new Error("Review target assignment does not exist");
        if (!await this.targetExists(review.targetType, review.targetId)) throw new Error("Research target no longer exists");
        if (review.reviewStatus === "completed") throw new Error("Review is already completed");
        result.valid += 1;
        if (!dryRun) { await this.submitReview(reviewId, parsed.submission); result.imported += 1; }
      } catch (error) {
        result.failed += 1;
        result.errors.push({ index, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return result;
  }

  async applyCorrections(reviewId: ObjectId, appliedBy?: string) {
    const review = await humanReviewsCollection(this.database).findOne({ _id: reviewId, reviewStatus: "completed" });
    if (!review) throw new Error("A completed review is required");
    if (!review.correctedValues || !Object.keys(review.correctedValues).length) throw new Error("Review has no approved corrected values");
    if (await correctionAuditsCollection(this.database).findOne({ reviewId })) throw new Error("Corrections were already applied");
    const now = new Date();
    let previousValues: Record<string, unknown> = {};
    let meaningChanged = false;
    if (review.targetType === "problem_mention") {
      const mention = await problemMentionsCollection(this.database).findOne({ _id: review.targetId });
      if (!mention) throw new Error("Problem mention no longer exists");
      const corrections = review.correctedValues;
      previousValues = Object.fromEntries(Object.keys(corrections).map((key) => [key, mention[key as keyof typeof mention]]));
      meaningChanged = ["canonicalProblem", "affectedUser", "workflow", "geography"].some((key) => key in corrections);
      await problemMentionsCollection(this.database).updateOne(
        { _id: mention._id },
        { $set: {
          ...corrections,
          ...(meaningChanged && { deduplicationStatus: "needs_review" }),
          updatedAt: now,
        }, ...(meaningChanged && { $unset: {
          embedding: "", embeddingModel: "", embeddingDimensions: "", embeddingVersion: "",
        } }) },
      );
      if (meaningChanged && mention.uniqueProblemId) {
        await uniqueProblemsCollection(this.database).updateOne(
          { _id: mention.uniqueProblemId }, { $set: { status: "needs_review", updatedAt: now } },
        );
      }
    } else if (review.targetType === "unique_problem") {
      const problem = await uniqueProblemsCollection(this.database).findOne({ _id: review.targetId });
      if (!problem) throw new Error("Unique problem no longer exists");
      const allowed = review.correctedValues.canonicalProblem
        ? { canonicalProblem: review.correctedValues.canonicalProblem }
        : {};
      previousValues = { canonicalProblem: problem.canonicalProblem, normalizedKey: problem.normalizedKey };
      meaningChanged = Boolean(review.correctedValues.canonicalProblem);
      const normalizedKey = meaningChanged ? buildNormalizedProblemKey({
        canonicalProblem: review.correctedValues.canonicalProblem!,
        affectedUser: problem.affectedUsers[0] || null,
        workflow: problem.workflows[0] || null,
      }) : problem.normalizedKey;
      await uniqueProblemsCollection(this.database).updateOne(
        { _id: problem._id },
        { $set: { ...allowed, normalizedKey, status: "needs_review", updatedAt: now },
          ...(meaningChanged && { $unset: { embedding: "", embeddingModel: "", embeddingDimensions: "", embeddingVersion: "" } }) },
      );
    } else throw new Error("Corrections are supported only for problem mentions and unique problems");
    const audit: CorrectionAuditDocument = {
      reviewId, targetType: review.targetType, targetId: review.targetId,
      previousValues, appliedValues: review.correctedValues, meaningChanged,
      ...(appliedBy && { appliedBy }), appliedAt: now, createdAt: now,
    };
    await correctionAuditsCollection(this.database).insertOne(audit);
    return audit;
  }
}
