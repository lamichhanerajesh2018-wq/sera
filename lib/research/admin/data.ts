import "server-only";

import { redirect } from "next/navigation";
import { isAdmin } from "../../admin-auth.ts";
import { db } from "../../mongodb.ts";
import { ResearchRepository } from "../repository.ts";
import {
  ResearchAdminRepository,
  type MentionListInput,
  type RawSignalListInput,
  type UniqueProblemListInput,
} from "./core.ts";

async function repository() {
  if (!(await isAdmin())) redirect("/admin/login");
  return new ResearchAdminRepository(db);
}

export async function requireResearchAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
  return true;
}

export async function getResearchOverview() {
  if (!(await isAdmin())) redirect("/admin/login");
  const [stats, runs] = await Promise.all([
    new ResearchRepository(db).getResearchStats({ qualityReviewLimit: 500 }),
    new ResearchAdminRepository(db).listRuns(12),
  ]);
  return { stats, runs };
}

export async function listResearchRawSignals(input: RawSignalListInput) {
  return (await repository()).listRawSignals(input);
}

export async function getResearchRawSignal(id: string) {
  return (await repository()).getRawSignalDetail(id);
}

export async function listResearchProblemMentions(input: MentionListInput) {
  return (await repository()).listProblemMentions(input);
}

export async function getResearchProblemMention(id: string) {
  return (await repository()).getProblemMentionDetail(id);
}

export async function listResearchUniqueProblems(input: UniqueProblemListInput) {
  return (await repository()).listUniqueProblems(input);
}

export async function getResearchUniqueProblem(id: string) {
  return (await repository()).getUniqueProblemDetail(id);
}

export async function listResearchReviews(input: { page?: unknown; pageSize?: unknown; status?: string; targetType?: string }) {
  return (await repository()).listReviews(input);
}

export async function getResearchReview(id: string) {
  return (await repository()).getReviewDetail(id);
}

export async function listResearchRuns(limit = 30) {
  return (await repository()).listRuns(limit);
}

export async function getResearchQuality() {
  if (!(await isAdmin())) redirect("/admin/login");
  const stats = await new ResearchRepository(db).getResearchStats({ qualityReviewLimit: 500 });
  return new ResearchAdminRepository(db).qualitySnapshot(stats);
}
