import { z } from "zod";
import { getResearchConfig, type ResearchConfig } from "./config.ts";
import {
  calculateContentHash,
  hasMeaningfulText,
  normalizeLanguageCode,
  normalizeSourceId,
  normalizeWhitespace,
  safelyTrimBody,
  safelyTrimTitle,
  sourceTimestampToDate,
  validateUrl,
} from "./normalization.ts";
import {
  GEOGRAPHY_EVIDENCE,
  RESEARCH_SOURCES,
  type RawSignalDocument,
} from "./types.ts";

const optionalText = z.string().max(10_000).optional();
const countValue = z.number().finite().nonnegative().int().optional();

const rawInputSchema = z
  .object({
    source: z.enum(RESEARCH_SOURCES),
    sourceId: z.string(),
    sourceUrl: z.string(),
    sourceCommunity: optionalText,
    title: optionalText,
    body: z.string(),
    authorName: optionalText,
    authorId: optionalText,
    publishedAt: z.union([z.string(), z.number(), z.date()]).optional(),
    collectedAt: z.union([z.string(), z.number(), z.date()]).optional(),
    language: z.string().optional(),
    targetCountry: z.literal("united_states").optional().default("united_states"),
    geographyEvidence: z.enum(GEOGRAPHY_EVIDENCE).optional().default("unknown"),
    industrySeed: optionalText,
    audienceSeed: optionalText,
    searchQuery: optionalText,
    engagement: z
      .object({
        score: z.number().finite().optional(),
        likes: countValue,
        replies: countValue,
        comments: countValue,
        views: countValue,
        rating: z.number().finite().min(0).max(5).optional(),
        upvoteRatio: z.number().finite().min(0).max(1).optional(),
      })
      .strict()
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type RawSignalInput = z.input<typeof rawInputSchema>;

export class RawSignalValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("; "));
    this.name = "RawSignalValidationError";
    this.issues = issues;
  }
}

function cleanOptional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return normalizeWhitespace(value) || undefined;
}

function containsContactInformation(value: string | undefined): boolean {
  if (!value) return false;
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phone = /(?:^|\D)(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?:\D|$)/;
  return email.test(value) || phone.test(value);
}

function containsSensitiveMetadata(value: unknown): boolean {
  if (typeof value === "string") return containsContactInformation(value);
  if (Array.isArray(value)) return value.some(containsSensitiveMetadata);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) =>
    /(?:password|passwd|token|secret|email|phone|exact.?address|api.?key)/i.test(key) ||
    containsSensitiveMetadata(nested),
  );
}

function urlContainsSecrets(value: string): boolean {
  const url = new URL(value);
  return [...url.searchParams.keys()].some((key) =>
    /(?:password|passwd|token|secret|api.?key)/i.test(key),
  );
}

export function parseRawSignalInput(
  input: unknown,
  config: ResearchConfig = getResearchConfig(),
): Omit<RawSignalDocument, "_id" | "collectionRunId"> {
  const parsed = rawInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new RawSignalValidationError(
      parsed.error.issues.map((issue) => {
        const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      }),
    );
  }

  const value = parsed.data;
  const sourceId = normalizeSourceId(value.sourceId);
  const sourceUrl = validateUrl(value.sourceUrl);
  const title = safelyTrimTitle(value.title);
  const bodyResult = safelyTrimBody(value.body, config.maximumBodyLength);
  const publishedAt = sourceTimestampToDate(value.publishedAt);
  const collectedAt = sourceTimestampToDate(value.collectedAt) || new Date();
  const language = normalizeLanguageCode(value.language || config.defaultLanguage);
  const issues: string[] = [];

  if (!sourceId) issues.push("sourceId: Required");
  if (!sourceUrl) issues.push("sourceUrl: Must be a valid HTTP(S) URL without credentials");
  else if (urlContainsSecrets(sourceUrl)) issues.push("sourceUrl: Secret-bearing query parameters are not permitted");
  if (!title && !bodyResult.value) issues.push("title/body: At least one must contain text");
  if (!hasMeaningfulText(bodyResult.value)) issues.push("body: Must contain meaningful text");
  if (value.publishedAt !== undefined && !publishedAt) issues.push("publishedAt: Invalid timestamp");
  if (value.collectedAt !== undefined && !sourceTimestampToDate(value.collectedAt)) {
    issues.push("collectedAt: Invalid timestamp");
  }
  if (!language || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(language)) {
    issues.push("language: Invalid language code");
  }
  if (
    [
      title,
      bodyResult.value,
      value.authorName,
      value.authorId,
      value.sourceCommunity,
      value.searchQuery,
    ].some(containsContactInformation)
  ) {
    issues.push("content: Email addresses and phone numbers are not permitted");
  }
  if (containsSensitiveMetadata(value.metadata)) {
    issues.push("metadata: Sensitive contact, credential, token, or exact-address fields are not permitted");
  }
  if (issues.length) throw new RawSignalValidationError(issues);

  const metadata = { ...(value.metadata || {}) };
  if (bodyResult.truncated) {
    metadata.originalBodyLength = bodyResult.originalLength;
    metadata.bodyTruncated = true;
  }

  const now = new Date();
  return {
    source: value.source,
    sourceId,
    sourceUrl: sourceUrl!,
    ...(cleanOptional(value.sourceCommunity) && {
      sourceCommunity: cleanOptional(value.sourceCommunity),
    }),
    ...(title && { title }),
    body: bodyResult.value,
    ...(cleanOptional(value.authorName) && { authorName: cleanOptional(value.authorName) }),
    ...(cleanOptional(value.authorId) && { authorId: cleanOptional(value.authorId) }),
    ...(publishedAt && { publishedAt }),
    collectedAt,
    language,
    targetCountry: "united_states",
    geographyEvidence: value.geographyEvidence,
    ...(cleanOptional(value.industrySeed) && { industrySeed: cleanOptional(value.industrySeed) }),
    ...(cleanOptional(value.audienceSeed) && { audienceSeed: cleanOptional(value.audienceSeed) }),
    ...(cleanOptional(value.searchQuery) && { searchQuery: cleanOptional(value.searchQuery) }),
    ...(value.engagement && Object.keys(value.engagement).length && {
      engagement: value.engagement,
    }),
    ...(Object.keys(metadata).length && { metadata }),
    contentHash: calculateContentHash(title, bodyResult.value),
    processingStatus: "pending",
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function formatValidationError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
