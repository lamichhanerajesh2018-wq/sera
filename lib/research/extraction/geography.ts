import { classifyUsGeography } from "../reddit/normalization.ts";
import type { ProblemGeography, RawSignalDocument } from "../types.ts";

export function mergeProblemGeography(
  signal: Pick<RawSignalDocument, "title" | "body" | "geographyEvidence">,
): ProblemGeography {
  const textClassification = classifyUsGeography(`${signal.title || ""}\n${signal.body}`);
  if (signal.geographyEvidence === "explicit_us") return "united_states";
  if (signal.geographyEvidence === "us_context") return "likely_united_states";
  if (signal.geographyEvidence === "non_us") {
    if (textClassification === "explicit_us") return "united_states";
    if (textClassification === "us_context") return "likely_united_states";
    return "non_us";
  }
  if (textClassification === "explicit_us") return "united_states";
  if (textClassification === "us_context") return "likely_united_states";
  if (textClassification === "non_us") return "non_us";
  return "unknown";
}
