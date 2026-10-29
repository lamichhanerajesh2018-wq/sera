import { z } from "zod";
import { DUPLICATE_DECISIONS } from "../types.ts";

export const duplicateJudgeOutputSchema = z.object({
  decision: z.enum(DUPLICATE_DECISIONS),
  confidence: z.number().finite().min(0).max(1),
  preferredCanonicalProblem: z.string().trim().min(1).max(1_000).nullable(),
  reason: z.string().trim().min(1).max(1_000),
  matchingDimensions: z.object({
    affectedUser: z.boolean(),
    jobOrWorkflow: z.boolean(),
    obstacle: z.boolean(),
    consequence: z.boolean(),
  }).strict(),
}).strict();

export type DuplicateJudgeOutput = z.infer<typeof duplicateJudgeOutputSchema>;

export function parseDuplicateJudgeOutput(input: unknown): DuplicateJudgeOutput {
  const parsed = duplicateJudgeOutputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) =>
      `${issue.path.join(".") || "response"}: ${issue.message}`).join("; "));
  }
  if (parsed.data.decision === "same_problem") {
    const dimensions = parsed.data.matchingDimensions;
    if (!dimensions.affectedUser || !dimensions.jobOrWorkflow || !dimensions.obstacle) {
      throw new Error("same_problem requires matching affected user, workflow, and obstacle");
    }
  }
  return parsed.data;
}

export const DUPLICATE_JUDGE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: { type: "string", enum: DUPLICATE_DECISIONS },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    preferredCanonicalProblem: { type: ["string", "null"] },
    reason: { type: "string" },
    matchingDimensions: {
      type: "object",
      additionalProperties: false,
      properties: {
        affectedUser: { type: "boolean" },
        jobOrWorkflow: { type: "boolean" },
        obstacle: { type: "boolean" },
        consequence: { type: "boolean" },
      },
      required: ["affectedUser", "jobOrWorkflow", "obstacle", "consequence"],
    },
  },
  required: ["decision", "confidence", "preferredCanonicalProblem", "reason", "matchingDimensions"],
} as const;
