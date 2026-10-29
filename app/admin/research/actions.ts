"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/mongodb";
import { isAdmin } from "@/lib/admin-auth";
import { assertResearchAdmin, parseObjectId } from "@/lib/research/admin/core";
import { QualityRepository } from "@/lib/research/quality/repository";

const FIELD_NAMES = ["canonicalProblem", "affectedUser", "industry", "workflow", "workaround", "consequence", "geography", "evidenceText"] as const;
const CORRECTION_NAMES = ["canonicalProblem", "affectedUser", "industry", "subIndustry", "workflow", "currentWorkaround", "negativeConsequence", "geography"] as const;

function optional(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function submitResearchReview(formData: FormData) {
  await assertResearchAdmin(isAdmin);
  const reviewId = parseObjectId(String(formData.get("reviewId") || ""), "review id");
  const fieldReviews = Object.fromEntries(FIELD_NAMES.map((name) => [name, optional(formData, `field.${name}`)]).filter(([, value]) => value));
  const correctedValues = Object.fromEntries(CORRECTION_NAMES.map((name) => [name, optional(formData, `corrected.${name}`)]).filter(([, value]) => value));
  const reasonCodes = formData.getAll("reasonCodes").filter((value): value is string => typeof value === "string");
  await new QualityRepository(db).submitReview(reviewId, {
    reviewerDecision: optional(formData, "reviewerDecision"),
    ...(optional(formData, "extractionDecision") && { extractionDecision: optional(formData, "extractionDecision") }),
    ...(optional(formData, "deduplicationDecision") && { deduplicationDecision: optional(formData, "deduplicationDecision") }),
    ...(Object.keys(fieldReviews).length && { fieldReviews }),
    ...(Object.keys(correctedValues).length && { correctedValues }),
    ...(reasonCodes.length && { reasonCodes }),
    ...(optional(formData, "reviewerNotes") && { reviewerNotes: optional(formData, "reviewerNotes") }),
    ...(optional(formData, "reviewerId") && { reviewerId: optional(formData, "reviewerId") }),
  });
  revalidatePath("/admin/research/reviews");
  revalidatePath(`/admin/research/reviews/${reviewId}`);
}

export async function skipResearchReview(formData: FormData) {
  await assertResearchAdmin(isAdmin);
  const reviewId = parseObjectId(String(formData.get("reviewId") || ""), "review id");
  await new QualityRepository(db).skipReview(reviewId, optional(formData, "reviewerNotes"));
  revalidatePath("/admin/research/reviews");
}

export async function requestSecondResearchReview(formData: FormData) {
  await assertResearchAdmin(isAdmin);
  const reviewId = parseObjectId(String(formData.get("reviewId") || ""), "review id");
  await new QualityRepository(db).createSecondReview(reviewId);
  revalidatePath("/admin/research/reviews");
  revalidatePath(`/admin/research/reviews/${reviewId}`);
}
