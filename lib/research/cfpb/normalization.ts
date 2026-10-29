import { normalizeWhitespace } from "../normalization.ts";
import type { GeographyEvidence } from "../types.ts";
import type { CfpbComplaint } from "./client.ts";

export type CfpbSkipReason = "missing_narrative" | "malformed_record" | "privacy_filter";

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY", "DC", "AS", "GU", "MP", "PR", "VI",
]);

function text(value: unknown) {
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

function containsContactInformation(value: string) {
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value) ||
    /(?:^|\D)(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?:\D|$)/.test(value);
}

function receivedTimestamp(value: string) {
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(`${value}T00:00:00.000Z`)
    : Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

export function normalizeCfpbComplaint(record: CfpbComplaint, collectedAt = new Date()):
  | { accepted: true; geographyEvidence: GeographyEvidence; signal: Record<string, unknown> }
  | { accepted: false; reason: CfpbSkipReason } {
  const complaintId = typeof record.complaint_id === "number" || typeof record.complaint_id === "string"
    ? String(record.complaint_id).trim() : "";
  const narrative = text(record.complaint_what_happened);
  if (!narrative) return { accepted: false, reason: "missing_narrative" };
  const product = text(record.product);
  const issue = text(record.issue);
  const dateReceived = text(record.date_received);
  const publishedAt = receivedTimestamp(dateReceived);
  if (!/^\d{1,10}$/.test(complaintId) || !product || !issue || !publishedAt) {
    return { accepted: false, reason: "malformed_record" };
  }
  const metadataValues = [
    product, text(record.sub_product), issue, text(record.sub_issue), text(record.company),
    text(record.state), text(record.submitted_via), text(record.company_response),
    text(record.company_public_response),
  ];
  if (containsContactInformation(narrative) || metadataValues.some(containsContactInformation)) {
    return { accepted: false, reason: "privacy_filter" };
  }
  const state = text(record.state).toUpperCase();
  const geographyEvidence: GeographyEvidence = US_STATE_CODES.has(state) ? "explicit_us" : "us_context";
  const metadata = Object.fromEntries(Object.entries({
    product,
    subProduct: text(record.sub_product) || undefined,
    issue,
    subIssue: text(record.sub_issue) || undefined,
    company: text(record.company) || undefined,
    state: US_STATE_CODES.has(state) ? state : undefined,
    submissionMethod: text(record.submitted_via) || undefined,
    companyResponse: text(record.company_response) || text(record.company_public_response) || undefined,
    companyPublicResponse: text(record.company_public_response) || undefined,
  }).filter(([, value]) => value !== undefined));
  return {
    accepted: true,
    geographyEvidence,
    signal: {
      source: "cfpb",
      sourceId: complaintId,
      sourceUrl: `https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/${complaintId}`,
      title: `${product} — ${issue}`,
      body: narrative,
      publishedAt,
      collectedAt,
      language: "en",
      targetCountry: "united_states",
      geographyEvidence,
      industrySeed: product,
      metadata,
    },
  };
}
