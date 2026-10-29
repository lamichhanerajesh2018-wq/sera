import { z } from "zod";
import {
  DUPLICATE_DECISIONS,
  EXTRACTION_REVIEW_DECISIONS,
  FIELD_REVIEW_VALUES,
  PROBLEM_GEOGRAPHIES,
  REVIEWER_DECISIONS,
  REVIEW_STATUSES,
  REVIEW_TARGET_TYPES,
} from "../types.ts";

export const EXTRACTION_REVIEW_REASON_CODES = [
  "false_positive_problem", "false_negative_problem", "vague_problem", "solution_biased",
  "unsupported_affected_user", "unsupported_occupation", "unsupported_workaround",
  "unsupported_consequence", "incorrect_industry", "incorrect_workflow", "incorrect_geography",
  "weak_evidence", "evidence_not_grounded", "prompt_injection_failure", "duplicate_problem_mention",
] as const;

export const DEDUPLICATION_REVIEW_REASON_CODES = [
  "incorrect_merge", "missed_duplicate", "related_but_distinct_merged", "same_problem_split",
  "affected_user_conflict", "workflow_conflict", "obstacle_conflict", "consequence_conflict",
  "canonical_wording_degraded", "uncertain_should_review",
] as const;

export const REVIEW_REASON_CODES = [
  ...EXTRACTION_REVIEW_REASON_CODES,
  ...DEDUPLICATION_REVIEW_REASON_CODES,
] as const;

const correctedValuesSchema = z.object({
  canonicalProblem: z.string().trim().min(20).max(1_000).optional(),
  affectedUser: z.string().trim().min(1).max(160).optional(),
  industry: z.string().trim().min(1).max(120).optional(),
  subIndustry: z.string().trim().min(1).max(120).optional(),
  workflow: z.string().trim().min(1).max(240).optional(),
  currentWorkaround: z.string().trim().min(1).max(1_000).optional(),
  negativeConsequence: z.string().trim().min(1).max(1_000).optional(),
  geography: z.enum(PROBLEM_GEOGRAPHIES).optional(),
}).strict();

const fieldReviewsSchema = z.object({
  canonicalProblem: z.enum(FIELD_REVIEW_VALUES).optional(),
  affectedUser: z.enum(FIELD_REVIEW_VALUES).optional(),
  industry: z.enum(FIELD_REVIEW_VALUES).optional(),
  workflow: z.enum(FIELD_REVIEW_VALUES).optional(),
  workaround: z.enum(FIELD_REVIEW_VALUES).optional(),
  consequence: z.enum(FIELD_REVIEW_VALUES).optional(),
  geography: z.enum(FIELD_REVIEW_VALUES).optional(),
  evidenceText: z.enum(FIELD_REVIEW_VALUES).optional(),
}).strict();

export const reviewSubmissionSchema = z.object({
  reviewerDecision: z.enum(REVIEWER_DECISIONS),
  extractionDecision: z.enum(EXTRACTION_REVIEW_DECISIONS).optional(),
  deduplicationDecision: z.enum(DUPLICATE_DECISIONS).optional(),
  fieldReviews: fieldReviewsSchema.optional(),
  correctedValues: correctedValuesSchema.optional(),
  reasonCodes: z.array(z.enum(REVIEW_REASON_CODES)).max(30).optional(),
  reviewerNotes: z.string().trim().max(2_000).optional(),
  reviewerId: z.string().trim().min(1).max(120).optional(),
}).strict().superRefine((value, context) => {
  const canonical = value.correctedValues?.canonicalProblem;
  if (canonical?.endsWith("?")) context.addIssue({ code: "custom", path: ["correctedValues", "canonicalProblem"], message: "must be a statement" });
  if (canonical && /^(?:build|create|develop|launch)\b/i.test(canonical)) {
    context.addIssue({ code: "custom", path: ["correctedValues", "canonicalProblem"], message: "must remain solution-neutral" });
  }
});

export const reviewImportItemSchema = z.object({
  reviewId: z.string().regex(/^[a-f\d]{24}$/i),
  reviewStatus: z.enum(REVIEW_STATUSES).optional(),
  submission: reviewSubmissionSchema,
}).strict();

export const evaluationItemSchema = z.object({
  datasetVersion: z.string().trim().regex(/^[a-z0-9-]+-v\d+$/),
  targetType: z.enum(REVIEW_TARGET_TYPES),
  safeSourceExcerpt: z.string().trim().min(1).max(1_000),
  expectedContainsProblem: z.boolean().optional(),
  expectedFields: z.record(z.string(), z.string().nullable()).optional(),
  expectedGeography: z.enum(PROBLEM_GEOGRAPHIES).optional(),
  expectedDeduplicationDecision: z.enum(DUPLICATE_DECISIONS).optional(),
  sourceCategory: z.string().trim().min(1).max(100),
  sourceCommunity: z.string().trim().min(1).max(120).optional(),
  industry: z.string().trim().min(1).max(120).optional(),
  difficulty: z.enum(["easy", "medium", "hard", "adversarial"]),
  annotationVersion: z.string().trim().min(1).max(100),
  reviewerAgreement: z.number().min(0).max(1),
}).strict();

export function parseReviewSubmission(input: unknown) { return reviewSubmissionSchema.parse(input); }
