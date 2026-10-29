import { z } from "zod";
import { normalizeWhitespace } from "../normalization.ts";
import {
  PROBLEM_GEOGRAPHIES,
  PROBLEM_TYPES,
  type RawSignalDocument,
} from "../types.ts";

const nullableText = z.string().trim().min(1).max(1_000).nullable();

export const extractionOutputSchema = z.object({
  containsProblem: z.boolean(),
  canonicalProblem: nullableText,
  shortLabel: z.string().trim().min(1).max(120).nullable(),
  industry: z.string().trim().min(1).max(120).nullable(),
  subIndustry: z.string().trim().min(1).max(120).nullable(),
  affectedUser: z.string().trim().min(1).max(160).nullable(),
  affectedRole: z.string().trim().min(1).max(160).nullable(),
  organizationType: z.string().trim().min(1).max(160).nullable(),
  workflow: z.string().trim().min(1).max(240).nullable(),
  problemType: z.enum(PROBLEM_TYPES).nullable(),
  currentWorkaround: nullableText,
  triggeringSituation: nullableText,
  desiredOutcome: nullableText,
  negativeConsequence: nullableText,
  geography: z.enum(PROBLEM_GEOGRAPHIES),
  evidenceText: z.string().trim().min(1).max(2_000).nullable(),
  extractionConfidence: z.number().finite().min(0).max(1),
  rejectionReason: z.string().trim().min(1).max(500).nullable(),
}).strict();

export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

export class ExtractionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionValidationError";
  }
}

const GROUNDING_FIELDS = [
  "affectedUser", "affectedRole", "organizationType", "workflow", "currentWorkaround",
  "triggeringSituation", "desiredOutcome", "negativeConsequence",
] as const;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "because", "by", "for", "from", "in", "is", "it",
  "of", "on", "or", "that", "the", "their", "to", "with", "without", "who", "when", "while",
]);

function contentTokens(value: string): string[] {
  return (normalizeWhitespace(value).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function isGroundedSummary(value: string, source: string, minimumMatch = 0.6): boolean {
  const tokens = [...new Set(contentTokens(value))];
  if (!tokens.length) return false;
  const sourceTokens = new Set(contentTokens(source));
  const matches = tokens.filter((token) => sourceTokens.has(token)).length;
  return matches / tokens.length >= minimumMatch;
}

function exactSourceExcerpt(source: string, proposedEvidence: string): string | null {
  const sourceChars = Array.from(source);
  const sourceKeyChars: string[] = [];
  const sourceIndexes: number[] = [];
  for (const [index, char] of sourceChars.entries()) {
    if (!/[\p{L}\p{N}]/u.test(char)) continue;
    for (const normalizedChar of Array.from(char.toLocaleLowerCase("en-US"))) {
      sourceKeyChars.push(normalizedChar);
      sourceIndexes.push(index);
    }
  }
  const evidenceKey = Array.from(proposedEvidence.toLocaleLowerCase("en-US"))
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .join("");
  if (!evidenceKey) return null;
  const startInKey = sourceKeyChars.join("").indexOf(evidenceKey);
  if (startInKey < 0) return null;
  const start = sourceIndexes[startInKey];
  const end = sourceIndexes[startInKey + Array.from(evidenceKey).length - 1];
  if (start === undefined || end === undefined) return null;
  return sourceChars.slice(start, end + 1).join("").trim() || null;
}

function groundedEvidenceWindow(source: string, canonicalProblem: string, maximumLength: number): string | null {
  const sourceChars = Array.from(source);
  const canonicalTokens = [...new Set(contentTokens(canonicalProblem))];
  if (!sourceChars.length || !canonicalTokens.length) return null;
  const windowLength = Math.min(maximumLength, 300);
  const step = Math.max(1, Math.floor(windowLength / 2));
  let best: { excerpt: string; coverage: number } | null = null;
  for (let start = 0; start < sourceChars.length; start += step) {
    const excerpt = sourceChars.slice(start, start + windowLength).join("").trim();
    if (!excerpt) continue;
    const excerptTokens = new Set(contentTokens(excerpt));
    const coverage = canonicalTokens.filter((token) => excerptTokens.has(token)).length / canonicalTokens.length;
    if (!best || coverage > best.coverage) best = { excerpt, coverage };
    if (start + windowLength >= sourceChars.length) break;
  }
  return best && best.coverage >= 0.4 ? best.excerpt : null;
}

export function conservativelyGroundExtraction(
  input: unknown,
  rawSignal: RawSignalDocument,
  maximumEvidenceLength: number,
): unknown {
  const parsed = extractionOutputSchema.safeParse(input);
  if (!parsed.success || !parsed.data.containsProblem) return input;
  const output = parsed.data;
  const groundingSource = normalizeWhitespace(
    [rawSignal.title, rawSignal.body, rawSignal.industrySeed, rawSignal.audienceSeed]
      .filter(Boolean)
      .join("\n"),
  );
  const evidenceSource = normalizeWhitespace([rawSignal.title, rawSignal.body].filter(Boolean).join("\n"));
  const groundedOptionalFields = Object.fromEntries(GROUNDING_FIELDS.map((field) => [
    field,
    output[field] && isGroundedSummary(output[field], groundingSource) ? output[field] : null,
  ]));
  const proposedEvidence = output.evidenceText ? normalizeWhitespace(output.evidenceText) : "";
  const exactEvidence = proposedEvidence ? exactSourceExcerpt(evidenceSource, proposedEvidence) : null;
  const evidenceText = exactEvidence && Array.from(exactEvidence).length <= maximumEvidenceLength
    ? exactEvidence
    : output.canonicalProblem
      ? groundedEvidenceWindow(evidenceSource, output.canonicalProblem, maximumEvidenceLength)
      : null;
  return { ...output, ...groundedOptionalFields, evidenceText: evidenceText || output.evidenceText };
}

export function parseAndValidateExtraction(
  input: unknown,
  rawSignal: RawSignalDocument,
  maximumEvidenceLength: number,
): ExtractionOutput {
  const parsed = extractionOutputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ExtractionValidationError(
      parsed.error.issues.map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`).join("; "),
    );
  }
  const output = parsed.data;
  const source = normalizeWhitespace(
    [rawSignal.title, rawSignal.body, rawSignal.industrySeed, rawSignal.audienceSeed]
      .filter(Boolean)
      .join("\n"),
  );
  const evidenceSource = normalizeWhitespace([rawSignal.title, rawSignal.body].filter(Boolean).join("\n"));

  if (!output.containsProblem) {
    if (!output.rejectionReason) {
      throw new ExtractionValidationError("rejectionReason is required when containsProblem is false");
    }
    const problemFields = [
      output.canonicalProblem, output.shortLabel, output.industry, output.subIndustry,
      output.problemType, output.evidenceText,
      ...GROUNDING_FIELDS.map((field) => output[field]),
    ];
    if (problemFields.some((value) => value !== null)) {
      throw new ExtractionValidationError("Problem fields must be null when containsProblem is false");
    }
    return output;
  }

  if (!output.canonicalProblem || !output.shortLabel || !output.problemType || !output.evidenceText) {
    throw new ExtractionValidationError(
      "canonicalProblem, shortLabel, problemType, and evidenceText are required for a problem",
    );
  }
  if (output.rejectionReason !== null) {
    throw new ExtractionValidationError("rejectionReason must be null when containsProblem is true");
  }
  if (output.canonicalProblem.endsWith("?")) {
    throw new ExtractionValidationError("canonicalProblem must be a statement, not a question");
  }
  if (/^(?:build|create|develop|launch)\b.*\b(?:app|platform|software|service)\b/i.test(output.canonicalProblem)) {
    throw new ExtractionValidationError("canonicalProblem must be solution-neutral");
  }
  if (!isGroundedSummary(output.canonicalProblem, source, 0.4)) {
    throw new ExtractionValidationError("canonicalProblem is not sufficiently grounded in the source");
  }
  const evidence = normalizeWhitespace(output.evidenceText);
  const groundedEvidence = exactSourceExcerpt(evidenceSource, evidence);
  if (!groundedEvidence) {
    throw new ExtractionValidationError("evidenceText is not grounded in the source");
  }
  if (Array.from(groundedEvidence).length > maximumEvidenceLength) {
    throw new ExtractionValidationError("evidenceText exceeds the configured maximum length");
  }
  for (const field of GROUNDING_FIELDS) {
    const value = output[field];
    if (value && !isGroundedSummary(value, source)) {
      throw new ExtractionValidationError(`${field} is not sufficiently grounded in the source`);
    }
  }
  return { ...output, evidenceText: groundedEvidence };
}

export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    containsProblem: { type: "boolean" },
    canonicalProblem: { type: ["string", "null"] },
    shortLabel: { type: ["string", "null"] },
    industry: { type: ["string", "null"] },
    subIndustry: { type: ["string", "null"] },
    affectedUser: { type: ["string", "null"] },
    affectedRole: { type: ["string", "null"] },
    organizationType: { type: ["string", "null"] },
    workflow: { type: ["string", "null"] },
    problemType: { anyOf: [{ type: "string", enum: PROBLEM_TYPES }, { type: "null" }] },
    currentWorkaround: { type: ["string", "null"], description: "An explicitly stated substitute method currently used because the problem remains unresolved; otherwise null." },
    triggeringSituation: { type: ["string", "null"] },
    desiredOutcome: { type: ["string", "null"], description: "An outcome the consumer explicitly says they want; otherwise null." },
    negativeConsequence: { type: ["string", "null"], description: "A concrete consequence explicitly described as happening to the consumer, never an inferred or potential harm; otherwise null." },
    geography: { type: "string", enum: PROBLEM_GEOGRAPHIES },
    evidenceText: { type: ["string", "null"], maxLength: 500, description: "One short contiguous excerpt copied character-for-character from the supplied title or body, with no quotation marks, ellipses, joined passages, or paraphrase." },
    extractionConfidence: { type: "number", minimum: 0, maximum: 1 },
    rejectionReason: { type: ["string", "null"] },
  },
  required: [
    "containsProblem", "canonicalProblem", "shortLabel", "industry", "subIndustry", "affectedUser",
    "affectedRole", "organizationType", "workflow", "problemType", "currentWorkaround",
    "triggeringSituation", "desiredOutcome", "negativeConsequence", "geography", "evidenceText",
    "extractionConfidence", "rejectionReason",
  ],
} as const;

export function buildExtractionJsonSchema(maximumEvidenceLength = 500) {
  return {
    ...EXTRACTION_JSON_SCHEMA,
    properties: {
      ...EXTRACTION_JSON_SCHEMA.properties,
      evidenceText: {
        ...EXTRACTION_JSON_SCHEMA.properties.evidenceText,
        maxLength: maximumEvidenceLength,
      },
    },
  };
}
