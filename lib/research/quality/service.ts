import { ObjectId, type Db } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import {
  deduplicationDecisionsCollection,
  humanReviewsCollection,
  problemMentionsCollection,
  rawSignalsCollection,
  uniqueProblemsCollection,
} from "../models.ts";
import type { HumanReviewDocument } from "../types.ts";
import { confusionMatrix, deduplicationMetrics, fieldAccuracy, reviewerAgreement, safeDivide } from "./metrics.ts";
import { QualityRepository, type ReviewQueueOptions } from "./repository.ts";

export async function generateReviewQueue(
  options: ReviewQueueOptions,
  database: Db = defaultDb,
) {
  if (!Number.isSafeInteger(options.sampleSize) || options.sampleSize < 1 || options.sampleSize > 1_000) {
    throw new Error("sampleSize must be between 1 and 1000");
  }
  return new QualityRepository(database).generateQueue(options);
}

export async function safeReviewView(review: HumanReviewDocument, database: Db = defaultDb, previewLength = 400) {
  if (review.targetType === "raw_signal") {
    const raw = await rawSignalsCollection(database).findOne({ _id: review.targetId });
    if (!raw) throw new Error("Review target no longer exists");
    return {
      reviewStatus: review.reviewStatus,
      targetType: review.targetType,
      sourcePreview: `${raw.title ? `${raw.title}\n` : ""}${raw.body}`.slice(0, previewLength),
      currentExtractionResult: raw.processingStatus,
      geography: raw.geographyEvidence,
      model: null,
      promptVersion: null,
    };
  }
  if (review.targetType === "problem_mention") {
    const mention = await problemMentionsCollection(database).findOne({ _id: review.targetId });
    if (!mention) throw new Error("Review target no longer exists");
    const raw = await rawSignalsCollection(database).findOne({ _id: mention.rawSignalId });
    const unique = mention.uniqueProblemId
      ? await uniqueProblemsCollection(database).findOne({ _id: mention.uniqueProblemId }) : null;
    return {
      reviewStatus: review.reviewStatus,
      targetType: review.targetType,
      sourcePreview: raw ? `${raw.title ? `${raw.title}\n` : ""}${raw.body}`.slice(0, previewLength) : null,
      currentExtractionResult: {
        canonicalProblem: mention.canonicalProblem, affectedUser: mention.affectedUser,
        industry: mention.industry, workflow: mention.workflow, problemType: mention.problemType,
      },
      evidenceText: mention.evidenceText,
      confidence: mention.extractionConfidence,
      geography: mention.geography,
      uniqueProblem: unique?.canonicalProblem || null,
      model: mention.model,
      promptVersion: mention.promptVersion,
      embeddingVersion: mention.embeddingVersion || null,
    };
  }
  if (review.targetType === "unique_problem") {
    const problem = await uniqueProblemsCollection(database).findOne({ _id: review.targetId });
    if (!problem) throw new Error("Review target no longer exists");
    return {
      reviewStatus: review.reviewStatus, targetType: review.targetType,
      canonicalProblem: problem.canonicalProblem, affectedUsers: problem.affectedUsers,
      workflows: problem.workflows, industry: problem.industry, problemTypes: problem.problemTypes,
      mentionCount: problem.mentionCount, sourceCount: problem.sourceCount,
      geography: problem.geography, confidence: problem.averageConfidence,
      embeddingVersion: problem.embeddingVersion,
    };
  }
  const decision = await deduplicationDecisionsCollection(database).findOne({ _id: review.targetId });
  if (!decision) throw new Error("Review target no longer exists");
  const mention = await problemMentionsCollection(database).findOne({ _id: decision.mentionId });
  const candidate = decision.candidateUniqueProblemId
    ? await uniqueProblemsCollection(database).findOne({ _id: decision.candidateUniqueProblemId }) : null;
  return {
    reviewStatus: review.reviewStatus, targetType: review.targetType,
    incomingCanonicalProblem: mention?.canonicalProblem || null,
    candidateCanonicalProblem: candidate?.canonicalProblem || null,
    similarity: decision.similarity ?? null, decision: decision.decision,
    confidence: decision.decisionConfidence ?? null, reason: decision.reason,
    model: decision.model || null, promptVersion: decision.promptVersion,
  };
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}

export async function exportReviews(database: Db = defaultDb, status?: string) {
  const repository = new QualityRepository(database);
  const reviews = await repository.listReviews(status ? { reviewStatus: status } : {});
  const rows = [];
  for (const review of reviews) {
    const view = await safeReviewView(review, database);
    rows.push({
      reviewId: review._id?.toString(), reviewRound: review.reviewRound,
      riskScore: review.riskScore,
      ...view,
    });
  }
  return rows;
}

export async function calculateReviewMetrics(database: Db = defaultDb, maximumReviews?: number) {
  let cursor = humanReviewsCollection(database).find({ reviewStatus: "completed" }).sort({ reviewedAt: -1, _id: -1 });
  if (maximumReviews !== undefined) {
    if (!Number.isSafeInteger(maximumReviews) || maximumReviews < 1 || maximumReviews > 10_000) throw new Error("maximumReviews must be between 1 and 10000");
    cursor = cursor.limit(maximumReviews);
  }
  const reviews = await cursor.toArray();
  const extractionObservations: Array<{ expected: boolean; predicted: boolean }> = [];
  const dedupObservations: Parameters<typeof deduplicationMetrics>[0] = [];
  for (const review of reviews) {
    if (review.extractionDecision) {
      extractionObservations.push({
        expected: review.extractionDecision === "valid_problem",
        predicted: review.targetType === "problem_mention",
      });
    }
    if (review.targetType === "deduplication_decision" && review.deduplicationDecision) {
      const decision = await deduplicationDecisionsCollection(database).findOne({ _id: review.targetId });
      if (decision) dedupObservations.push({
        expectedSame: review.deduplicationDecision === "same_problem",
        predictedSame: decision.decision === "same_problem",
        uncertain: decision.decision === "uncertain",
        relatedExpected: review.deduplicationDecision === "related_but_distinct",
        relatedPredicted: decision.decision === "related_but_distinct",
      });
    }
  }
  const extraction = confusionMatrix(extractionObservations);
  const deduplication = deduplicationMetrics(dedupObservations);
  const fields = [
    "canonicalProblem", "affectedUser", "industry", "workflow", "workaround",
    "consequence", "geography", "evidenceText",
  ] as const;
  const fieldMetrics = Object.fromEntries(fields.map((field) => [
    field, fieldAccuracy(reviews.map((review) => review.fieldReviews?.[field])),
  ]));
  const allFieldValues = reviews.flatMap((review) => Object.values(review.fieldReviews || {}));
  const labels = reviews.filter((review) => review.reviewerDecision && review.reviewerId).map((review) => ({
    item: `${review.targetType}:${review.targetId}`,
    reviewer: review.reviewerId!,
    label: review.reviewerDecision!,
  }));
  return {
    reviewedSampleSize: reviews.length,
    extraction,
    deduplication,
    fieldMetrics,
    groundingAccuracy: fieldAccuracy(reviews.map((review) => review.fieldReviews?.evidenceText)).accuracy,
    solutionBiasRate: safeDivide(reviews.filter((review) => review.reasonCodes?.includes("solution_biased")).length, reviews.length),
    unsupportedFieldRate: safeDivide(allFieldValues.filter((value) => value === "unsupported").length, allFieldValues.length),
    promptInjectionFailureRate: safeDivide(
      reviews.filter((review) => review.reasonCodes?.includes("prompt_injection_failure")).length, reviews.length,
    ),
    agreement: reviewerAgreement(labels),
  };
}

export async function reviewStats(database: Db = defaultDb) {
  const [pending, inReview, completed, skipped, metrics] = await Promise.all([
    humanReviewsCollection(database).countDocuments({ reviewStatus: "pending" }),
    humanReviewsCollection(database).countDocuments({ reviewStatus: "in_review" }),
    humanReviewsCollection(database).countDocuments({ reviewStatus: "completed" }),
    humanReviewsCollection(database).countDocuments({ reviewStatus: "skipped" }),
    calculateReviewMetrics(database),
  ]);
  return { pending, inReview, completed, skipped, metrics };
}

export function parseObjectId(value: string, name = "id") {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new Error(`${name} must be a MongoDB ObjectId`);
  return new ObjectId(value);
}
