import { normalizeWhitespace, validateUrl } from "../normalization.ts";
import type { RedditPostData } from "./client.ts";
import type { GeographyEvidence } from "../types.ts";

export type RedditSkipReason =
  | "deleted_or_removed"
  | "empty_content"
  | "short_body"
  | "nsfw"
  | "stickied_or_moderator"
  | "promotional"
  | "unsupported_language"
  | "too_old"
  | "invalid_url"
  | "invalid_post"
  | "not_self_post"
  | "validation";

export interface RedditNormalizationOptions {
  query: string;
  industrySeed?: string;
  audienceSeed?: string;
  minimumPostBodyLength: number;
  maximumPostAgeDays: number;
  includeSelfTextOnly: boolean;
  excludeNsfw: boolean;
  now?: Date;
}

export type RedditNormalizationResult =
  | { accepted: true; signal: Record<string, unknown>; geographyEvidence: GeographyEvidence }
  | { accepted: false; reason: RedditSkipReason };

const ENGLISH_FUNCTION_WORDS = new Set([
  "a", "about", "after", "all", "am", "an", "and", "are", "as", "at", "be", "because",
  "been", "before", "but", "by", "can", "cannot", "could", "did", "do", "does", "doing",
  "for", "from", "get", "had", "has", "have", "he", "help", "her", "here", "how", "i",
  "if", "in", "is", "it", "just", "me", "my", "not", "of", "on", "or", "our", "out",
  "she", "so", "that", "the", "their", "there", "they", "this", "to", "too", "up", "was",
  "we", "were", "what", "when", "where", "which", "who", "why", "will", "with", "would",
  "you", "your",
]);

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "District of Columbia",
];

const STATE_ABBREVIATIONS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY", "DC",
];

const NON_US_COUNTRIES = [
  "Canada", "Mexico", "United Kingdom", "UK", "England", "Scotland", "Wales", "Ireland", "Australia",
  "New Zealand", "India", "Pakistan", "Bangladesh", "Germany", "France", "Spain", "Italy", "Netherlands",
  "Belgium", "Sweden", "Norway", "Denmark", "Finland", "Brazil", "Argentina", "South Africa", "Japan",
  "China", "Singapore", "Philippines", "Nepal",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isSafeRedditCommunityName(value: string): boolean {
  return /^[A-Za-z0-9_]{2,21}$/.test(value);
}

export function isPredominantlyEnglish(value: string): boolean {
  const normalized = normalizeWhitespace(value).toLowerCase();
  const letters = Array.from(normalized).filter((character) => /\p{L}/u.test(character));
  if (letters.length < 8) return false;
  const latinLetters = letters.filter((character) => /[a-z]/i.test(character)).length;
  if (latinLetters / letters.length < 0.9) return false;
  const words = normalized.match(/[a-z]+(?:'[a-z]+)?/g) || [];
  if (words.length < 3) return false;
  const hits = words.filter((word) => ENGLISH_FUNCTION_WORDS.has(word)).length;
  return hits >= (words.length >= 10 ? 2 : 1) && hits / words.length >= 0.04;
}

export function classifyUsGeography(value: string): GeographyEvidence {
  const text = normalizeWhitespace(value);
  const statePattern = US_STATES.map(escapeRegExp).join("|");
  const nonUsPattern = NON_US_COUNTRIES.map(escapeRegExp).join("|");

  if (
    new RegExp(
      `\\b(?:I (?:live|work|am based|am located)|we (?:live|work|are based)|here|my home) in (?:the )?(?:US|USA|U\\.S\\.A?\\.?|United States)\\b`,
      "i",
    ).test(text) ||
    new RegExp(
      `\\b(?:I (?:live|work|am based|am located|moved)|we (?:live|work|are based)|here) in (?:${statePattern})\\b`,
      "i",
    ).test(text) ||
    new RegExp(
      `\\b(?:I (?:live|work|am based|am located)|we (?:live|work|are based)) in [A-Z][A-Za-z .'-]+,\\s*(?:${STATE_ABBREVIATIONS.join("|")})\\b`,
    ).test(text)
  ) {
    return "explicit_us";
  }

  if (
    new RegExp(
      `\\b(?:I (?:live|work|am based|am located|moved)|we (?:live|work|are based)|here) in (?:the )?(?:${nonUsPattern})\\b`,
      "i",
    ).test(text) ||
    /\b(?:my|our) (?:NHS|provincial health|council tax|Centrelink|GST)\b/i.test(text)
  ) {
    return "non_us";
  }

  if (
    /\b(?:IRS|401\s*\(?k\)?|Medicaid|Medicare|FAFSA|W-?2|FICO|state DMV|Department of Motor Vehicles|health insurance deductible|copay|HOA)\b/i.test(text)
  ) {
    return "us_context";
  }
  return "unknown";
}

function isPromotional(title: string, body: string): boolean {
  return /\b(?:giveaway|promo(?:tional)? code|discount code|use my code|limited[- ]time offer|buy now|affiliate link)\b/i
    .test(`${title}\n${body}`);
}

function safeAuthorName(value: string | undefined): string | undefined {
  if (!value || value === "[deleted]") return undefined;
  return /^(?=.*[A-Za-z])[A-Za-z0-9_-]{1,20}$/.test(value) ? value : undefined;
}

export function normalizeRedditPost(
  post: RedditPostData,
  options: RedditNormalizationOptions,
): RedditNormalizationResult {
  const title = normalizeWhitespace(post.title || "");
  const body = normalizeWhitespace(post.selftext || "");
  if (
    post.removed_by_category ||
    [title.toLowerCase(), body.toLowerCase()].some((value) => ["[deleted]", "[removed]"].includes(value))
  ) {
    return { accepted: false, reason: "deleted_or_removed" };
  }
  if (!title && !body) return { accepted: false, reason: "empty_content" };
  if (options.includeSelfTextOnly && post.is_self !== true) return { accepted: false, reason: "not_self_post" };
  if (Array.from(body).length < options.minimumPostBodyLength) {
    return { accepted: false, reason: "short_body" };
  }
  if (options.excludeNsfw && post.over_18) return { accepted: false, reason: "nsfw" };
  if (post.stickied || post.distinguished === "moderator") {
    return { accepted: false, reason: "stickied_or_moderator" };
  }
  if (isPromotional(title, body)) return { accepted: false, reason: "promotional" };
  if (!isPredominantlyEnglish(body)) {
    return { accepted: false, reason: "unsupported_language" };
  }
  if (!post.id || !post.subreddit || !post.created_utc || !Number.isFinite(post.created_utc)) {
    return { accepted: false, reason: "invalid_post" };
  }
  const publishedAt = new Date(post.created_utc * 1_000);
  const now = options.now || new Date();
  const maximumAgeMs = options.maximumPostAgeDays * 86_400_000;
  if (publishedAt.getTime() > now.getTime() + 300_000 || now.getTime() - publishedAt.getTime() > maximumAgeMs) {
    return { accepted: false, reason: "too_old" };
  }
  if (!post.permalink?.startsWith("/r/")) return { accepted: false, reason: "invalid_url" };
  const sourceUrl = validateUrl(`https://www.reddit.com${post.permalink}`);
  if (!sourceUrl || new URL(sourceUrl).hostname !== "www.reddit.com") {
    return { accepted: false, reason: "invalid_url" };
  }

  const geographyEvidence = classifyUsGeography(`${title}\n${body}`);
  const authorName = safeAuthorName(post.author);
  return {
    accepted: true,
    geographyEvidence,
    signal: {
      source: "reddit",
      sourceId: post.id,
      sourceUrl,
      sourceCommunity: post.subreddit,
      ...(title && { title }),
      body,
      ...(authorName && { authorName }),
      publishedAt,
      collectedAt: now,
      language: "en",
      targetCountry: "united_states",
      geographyEvidence,
      ...(options.industrySeed && { industrySeed: options.industrySeed }),
      ...(options.audienceSeed && { audienceSeed: options.audienceSeed }),
      searchQuery: options.query,
      engagement: {
        ...(typeof post.score === "number" && Number.isFinite(post.score) && { score: post.score }),
        ...(typeof post.num_comments === "number" && post.num_comments >= 0 && {
          comments: Math.trunc(post.num_comments),
        }),
        ...(typeof post.upvote_ratio === "number" && post.upvote_ratio >= 0 && post.upvote_ratio <= 1 && {
          upvoteRatio: post.upvote_ratio,
        }),
      },
      metadata: {
        redditPermalink: post.permalink,
        ...(post.domain && { redditDomain: post.domain }),
        isSelfPost: Boolean(post.is_self),
        over18: Boolean(post.over_18),
        locked: Boolean(post.locked),
        stickied: Boolean(post.stickied),
        spoiler: Boolean(post.spoiler),
      },
    },
  };
}
