import { createHash } from "node:crypto";
import { normalizeWhitespace } from "../normalization.ts";
import type {
  ProblemGeography,
  ProblemMentionDocument,
  UniqueProblemGeography,
  UniqueProblemDocument,
} from "../types.ts";

export function normalizeDeduplicationValue(value: string): string {
  return normalizeWhitespace(value.normalize("NFKC"))
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildNormalizedProblemKey(
  mention: Pick<ProblemMentionDocument, "canonicalProblem" | "affectedUser" | "workflow">,
): string {
  const material = [mention.canonicalProblem, mention.affectedUser || "", mention.workflow || ""]
    .map(normalizeDeduplicationValue)
    .join("\n");
  return createHash("sha256").update(material).digest("hex");
}

export function buildEmbeddingText(mention: ProblemMentionDocument): string {
  const fields: Array<[string, string | null | undefined]> = [
    ["canonical_problem", mention.canonicalProblem],
    ["affected_user", mention.affectedUser],
    ["workflow", mention.workflow],
    ["triggering_situation", mention.triggeringSituation],
    ["negative_consequence", mention.negativeConsequence],
    ["industry", mention.industry],
    ["subindustry", mention.subIndustry],
  ];
  return fields
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([name, value]) => `${name}: ${normalizeWhitespace(value!)}`)
    .join("\n");
}

export function buildUniqueProblemEmbeddingText(problem: UniqueProblemDocument): string {
  const joined = (values: string[]) => [...values]
    .sort((left, right) => normalizeDeduplicationValue(left).localeCompare(normalizeDeduplicationValue(right)))
    .join("; ");
  const fields: Array<[string, string]> = [
    ["canonical_problem", problem.canonicalProblem],
    ["affected_user", joined(problem.affectedUsers)],
    ["workflow", joined(problem.workflows)],
    ["triggering_situation", joined(problem.triggeringSituations)],
    ["negative_consequence", joined(problem.negativeConsequences)],
    ["industry", problem.industry],
    ["subindustry", joined(problem.subIndustries)],
  ];
  return fields.filter(([, value]) => Boolean(value.trim()))
    .map(([name, value]) => `${name}: ${normalizeWhitespace(value)}`).join("\n");
}

export function validateEmbeddingVector(vector: unknown, expectedDimensions?: number): number[] {
  if (!Array.isArray(vector) || vector.length === 0 || vector.length > 100_000) {
    throw new Error("Embedding must be a non-empty numeric vector");
  }
  if (expectedDimensions !== undefined && vector.length !== expectedDimensions) {
    throw new Error(`Incompatible embedding dimensions: expected ${expectedDimensions}, received ${vector.length}`);
  }
  if (!vector.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new Error("Embedding contains a non-finite numeric value");
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) throw new Error("Embedding vector cannot have zero magnitude");
  return vector;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  validateEmbeddingVector(left);
  validateEmbeddingVector(right, left.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function uniqueNormalized(values: Array<string | null | undefined>): string[] {
  const found = new Map<string, string>();
  for (const value of values) {
    const clean = value ? normalizeWhitespace(value) : "";
    const key = clean ? normalizeDeduplicationValue(clean) : "";
    if (key && !found.has(key)) found.set(key, clean);
  }
  return [...found.values()];
}

export function aggregateGeography(
  current: UniqueProblemGeography,
  incoming: ProblemGeography,
): UniqueProblemGeography {
  if (current === "mixed") return "mixed";
  if (incoming === "non_us") return current === "unknown" ? "mixed" : "mixed";
  if (current === "united_states") return "united_states";
  if (incoming === "united_states") return "united_states";
  if (current === "likely_united_states" || incoming === "likely_united_states") {
    return "likely_united_states";
  }
  return "unknown";
}

export function initialUniqueGeography(geography: ProblemGeography): UniqueProblemGeography {
  return geography === "non_us" ? "mixed" : geography;
}

export function hasMaterialGroundingConflict(
  mention: ProblemMentionDocument,
  candidate: { affectedUsers: string[]; workflows: string[] },
): boolean {
  const affected = mention.affectedUser && normalizeDeduplicationValue(mention.affectedUser);
  const workflow = mention.workflow && normalizeDeduplicationValue(mention.workflow);
  const candidateAffected = new Set(candidate.affectedUsers.map(normalizeDeduplicationValue));
  const candidateWorkflows = new Set(candidate.workflows.map(normalizeDeduplicationValue));
  return Boolean(
    (affected && candidateAffected.size && !candidateAffected.has(affected)) ||
    (workflow && candidateWorkflows.size && !candidateWorkflows.has(workflow))
  );
}

export function isCanonicalImprovementGrounded(
  preferred: string | null,
  mention: ProblemMentionDocument,
  existingCanonical: string,
): preferred is string {
  if (!preferred || preferred.endsWith("?")) return false;
  if (/^(?:build|create|develop|launch)\b/i.test(preferred)) return false;
  const sourceTokens = new Set(normalizeDeduplicationValue(
    `${mention.canonicalProblem} ${mention.evidenceText} ${existingCanonical}`,
  ).split(" "));
  const tokens = [...new Set(normalizeDeduplicationValue(preferred).split(" ").filter((token) => token.length > 2))];
  return Boolean(tokens.length && tokens.filter((token) => sourceTokens.has(token)).length / tokens.length >= 0.7);
}
