import { createHash } from "node:crypto";

export function removeNullBytes(value: string): string {
  return value.replaceAll("\0", "");
}

export function removeRepeatedBlankLines(value: string): string {
  return value.replace(/\n[\t ]*\n(?:[\t ]*\n)+/g, "\n\n");
}

export function normalizeWhitespace(value: string): string {
  return removeRepeatedBlankLines(
    removeNullBytes(value)
      .normalize("NFC")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[\t ]+/g, " ").trim())
      .join("\n"),
  ).trim();
}

export function truncateUnicode(value: string, maximumLength: number) {
  const characters = Array.from(value);
  if (characters.length <= maximumLength) {
    return { value, truncated: false, originalLength: characters.length };
  }
  return {
    value: characters.slice(0, maximumLength).join("").trimEnd(),
    truncated: true,
    originalLength: characters.length,
  };
}

export function safelyTrimTitle(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizeWhitespace(value).replaceAll("\n", " ");
  return normalized || undefined;
}

export function safelyTrimBody(value: string | undefined, maximumLength: number) {
  const normalized = normalizeWhitespace(value || "");
  return truncateUnicode(normalized, maximumLength);
}

export function calculateContentHash(title: string | undefined, body: string): string {
  const normalizedTitle = safelyTrimTitle(title) || "";
  const normalizedBody = normalizeWhitespace(body);
  return createHash("sha256")
    .update(`${normalizedTitle}\n\n${normalizedBody}`, "utf8")
    .digest("hex");
}

export function validateUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeSourceId(value: string): string {
  return removeNullBytes(value).normalize("NFC").trim().replace(/\s+/g, " ");
}

export function normalizeLanguageCode(value: string): string {
  const normalized = value.trim().replaceAll("_", "-").toLowerCase();
  try {
    return Intl.getCanonicalLocales(normalized)[0]?.toLowerCase() || normalized;
  } catch {
    return normalized;
  }
}

export function sourceTimestampToDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function hasMeaningfulText(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}
