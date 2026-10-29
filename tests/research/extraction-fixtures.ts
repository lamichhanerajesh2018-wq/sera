import { ObjectId } from "mongodb";
import type { RawSignalDocument } from "../../lib/research/types.ts";

export function signal(overrides: Partial<RawSignalDocument> = {}): RawSignalDocument {
  const now = new Date("2026-07-13T00:00:00Z");
  return {
    _id: new ObjectId(),
    source: "manual_import",
    sourceId: "sample",
    sourceUrl: "https://example.com/sample",
    title: "Childcare is difficult with night shifts",
    body: "I work nights and cannot find childcare that stays open late, so I wait for family help.",
    collectedAt: now,
    language: "en",
    targetCountry: "united_states",
    geographyEvidence: "unknown",
    industrySeed: "Childcare",
    contentHash: "hash",
    processingStatus: "pending",
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function validProblem(overrides: Record<string, unknown> = {}) {
  return {
    containsProblem: true,
    canonicalProblem: "Night-shift workers struggle to find childcare because providers close before late shifts end.",
    shortLabel: "Night-shift childcare availability",
    industry: "Childcare",
    subIndustry: null,
    affectedUser: null,
    affectedRole: null,
    organizationType: null,
    workflow: "find childcare",
    problemType: "availability",
    currentWorkaround: "wait for family help",
    triggeringSituation: "work nights",
    desiredOutcome: null,
    negativeConsequence: null,
    geography: "unknown",
    evidenceText: "cannot find childcare that stays open late",
    extractionConfidence: 0.9,
    rejectionReason: null,
    ...overrides,
  };
}

export function noProblem(rejectionReason = "insufficient evidence") {
  return {
    containsProblem: false,
    canonicalProblem: null,
    shortLabel: null,
    industry: null,
    subIndustry: null,
    affectedUser: null,
    affectedRole: null,
    organizationType: null,
    workflow: null,
    problemType: null,
    currentWorkaround: null,
    triggeringSituation: null,
    desiredOutcome: null,
    negativeConsequence: null,
    geography: "unknown",
    evidenceText: null,
    extractionConfidence: 0.95,
    rejectionReason,
  };
}
