import { normalizeWhitespace } from "../normalization.ts";
import type { GeographyEvidence } from "../types.ts";

export type NhtsaSkipReason = "missing_narrative" | "malformed_record" | "privacy_filter";

export const NHTSA_COLUMNS = [
  "CMPLID", "ODINO", "MFR_NAME", "MAKETXT", "MODELTXT", "YEARTXT", "CRASH", "FAILDATE", "FIRE",
  "INJURED", "DEATHS", "COMPDESC", "CITY", "STATE", "VIN", "DATEA", "LDATE", "MILES",
  "OCCURRENCES", "CDESCR", "CMPL_TYPE", "POLICE_RPT_YN", "PURCH_DT", "ORIG_OWNER_YN",
  "ANTI_BRAKES_YN", "CRUISE_CONT_YN", "NUM_CYLS", "DRIVE_TRAIN", "FUEL_SYS", "FUEL_TYPE",
  "TRANS_TYPE", "VEH_SPEED", "DOT", "TIRE_SIZE", "LOC_OF_TIRE", "TIRE_FAIL_TYPE", "ORIG_EQUIP_YN",
  "MANUF_DT", "SEAT_TYPE", "RESTRAINT_TYPE", "DEALER_NAME", "DEALER_TEL", "DEALER_CITY",
  "DEALER_STATE", "DEALER_ZIP", "PROD_TYPE", "REPAIRED_YN", "MEDICAL_ATTN", "VEHICLES_TOWED_YN",
  "STATE_OF_INCIDENT", "VEHICLE_OPERATOR",
] as const;

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY", "DC", "AS", "GU", "MP", "PR", "VI",
]);

function text(value: unknown) {
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

function contactInformation(value: string) {
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value) ||
    /(?:^|\D)(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?:\D|$)/.test(value);
}

function date(value: string) {
  if (!/^\d{8}$/.test(value)) return undefined;
  const timestamp = Date.parse(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function number(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function yes(value: string) { return value.toUpperCase() === "Y" ? true : undefined; }

export function normalizeNhtsaComplaint(row: Record<string, string>, collectedAt = new Date()):
  | { accepted: true; geographyEvidence: GeographyEvidence; signal: Record<string, unknown> }
  | { accepted: false; reason: NhtsaSkipReason } {
  const sourceId = text(row.CMPLID);
  const narrative = text(row.CDESCR);
  if (!narrative) return { accepted: false, reason: "missing_narrative" };
  const receivedAt = date(text(row.LDATE));
  const component = text(row.COMPDESC);
  if (!/^\d{1,12}$/.test(sourceId) || !receivedAt || !component) {
    return { accepted: false, reason: "malformed_record" };
  }
  if (contactInformation(narrative)) return { accepted: false, reason: "privacy_filter" };
  const make = text(row.MAKETXT);
  const model = text(row.MODELTXT);
  const modelYear = /^\d{4}$/.test(text(row.YEARTXT)) && text(row.YEARTXT) !== "9999" ? text(row.YEARTXT) : "";
  const state = text(row.STATE_OF_INCIDENT || row.STATE).toUpperCase();
  const geographyEvidence: GeographyEvidence = US_STATE_CODES.has(state) ? "explicit_us" : "us_context";
  const titleParts = [[modelYear, make, model].filter(Boolean).join(" "), component].filter(Boolean);
  const metadata = Object.fromEntries(Object.entries({
    odiNumber: /^\d{1,12}$/.test(text(row.ODINO)) ? text(row.ODINO) : undefined,
    manufacturer: text(row.MFR_NAME) || undefined,
    make: make || undefined,
    model: model || undefined,
    modelYear: modelYear || undefined,
    component,
    productType: text(row.PROD_TYPE) || undefined,
    complaintType: text(row.CMPL_TYPE) || undefined,
    incidentDate: date(text(row.FAILDATE)),
    state: US_STATE_CODES.has(state) ? state : undefined,
    crash: yes(text(row.CRASH)),
    fire: yes(text(row.FIRE)),
    injuries: number(text(row.INJURED)),
    deaths: number(text(row.DEATHS)),
    occurrences: number(text(row.OCCURRENCES)),
    mileageAtFailure: number(text(row.MILES)),
    medicalAttention: yes(text(row.MEDICAL_ATTN)),
    vehicleTowed: yes(text(row.VEHICLES_TOWED_YN)),
  }).filter(([, value]) => value !== undefined));
  return {
    accepted: true,
    geographyEvidence,
    signal: {
      source: "nhtsa",
      sourceId,
      sourceUrl: "https://www.nhtsa.gov/nhtsa-datasets-and-apis",
      title: titleParts.join(" — ").slice(0, 500),
      body: narrative,
      publishedAt: receivedAt,
      collectedAt,
      language: "en",
      targetCountry: "united_states",
      geographyEvidence,
      industrySeed: "Automotive safety",
      metadata,
    },
  };
}
