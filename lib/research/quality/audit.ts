import type { Db } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import { DUPLICATE_JUDGE_PROMPT_VERSION, EMBEDDING_TEXT_VERSION, EXTRACTION_PROMPT_VERSION, getDeduplicationConfig, getResearchConfig } from "../config.ts";
import {
  deduplicationDecisionsCollection,
  deduplicationRunsCollection,
  problemMentionsCollection,
  rawSignalsCollection,
  uniqueProblemsCollection,
} from "../models.ts";
import { normalizeWhitespace } from "../normalization.ts";
import { normalizeDeduplicationValue } from "../deduplication/text.ts";

export interface QualityFinding {
  code: string;
  severity: "critical" | "warning" | "info";
  targetType: string;
  summary: string;
}

function appearsSupported(value: string, source: string) {
  const words = normalizeDeduplicationValue(value).split(" ").filter((word) => word.length > 2);
  if (!words.length) return true;
  const sourceWords = new Set(normalizeDeduplicationValue(source).split(" "));
  return words.filter((word) => sourceWords.has(word)).length / words.length >= 0.5;
}

export async function auditQuality(database: Db = defaultDb) {
  const findings: QualityFinding[] = [];
  const [mentions, problems, rawSignals, decisions, runs] = await Promise.all([
    problemMentionsCollection(database).find({}).toArray(),
    uniqueProblemsCollection(database).find({}).toArray(),
    rawSignalsCollection(database).find({}).toArray(),
    deduplicationDecisionsCollection(database).find({}).toArray(),
    deduplicationRunsCollection(database).find({}).toArray(),
  ]);
  const rawById = new Map(rawSignals.map((item) => [item._id?.toString(), item]));
  const problemById = new Map(problems.map((item) => [item._id?.toString(), item]));
  const mentionByProblem = new Map<string, typeof mentions>();
  const mentionRawLinks = new Map<string, number>();
  for (const mention of mentions) if (mention.uniqueProblemId) {
    const key = mention.uniqueProblemId.toString();
    mentionByProblem.set(key, [...(mentionByProblem.get(key) || []), mention]);
  }
  for (const mention of mentions) {
    const raw = rawById.get(mention.rawSignalId.toString());
    const rawKey = mention.rawSignalId.toString();
    mentionRawLinks.set(rawKey, (mentionRawLinks.get(rawKey) || 0) + 1);
    if (!mention.evidenceText) findings.push({ code: "missing_evidence", severity: "critical", targetType: "problem_mention", summary: "Accepted mention has no evidence text" });
    else if (!raw || !normalizeWhitespace(`${raw.title || ""}\n${raw.body}`).toLowerCase().includes(normalizeWhitespace(mention.evidenceText).toLowerCase())) {
      findings.push({ code: "evidence_not_grounded", severity: "critical", targetType: "problem_mention", summary: "Evidence excerpt is absent from its raw source" });
    }
    if (/^(?:build|create|develop|launch)\b|\b(?:app|platform) should be built\b/i.test(mention.canonicalProblem)) {
      findings.push({ code: "solution_biased", severity: "critical", targetType: "problem_mention", summary: "Canonical problem appears solution-oriented" });
    }
    if (raw) {
      const source = `${raw.title || ""}\n${raw.body}`;
      const unsupported = [mention.affectedUser, mention.currentWorkaround, mention.negativeConsequence]
        .filter((value): value is string => Boolean(value))
        .filter((value) => !appearsSupported(value, source));
      if (unsupported.length) findings.push({ code: "unsupported_extracted_field", severity: "warning", targetType: "problem_mention", summary: "One or more high-risk extracted fields are not lexically supported by the source" });
    }
    if (mention.canonicalProblem.length < 30) findings.push({ code: "vague_canonical", severity: "warning", targetType: "problem_mention", summary: "Canonical problem is unusually short" });
    if (mention.uniqueProblemId && !problemById.has(mention.uniqueProblemId.toString())) {
      findings.push({ code: "orphaned_mention", severity: "critical", targetType: "problem_mention", summary: "Mention links to a missing unique problem" });
    }
    const linked = mention.uniqueProblemId ? problemById.get(mention.uniqueProblemId.toString()) : null;
    if (linked && mention.embedding && (
      mention.embeddingModel !== linked.embeddingModel || mention.embeddingDimensions !== linked.embeddingDimensions ||
      mention.embeddingVersion !== linked.embeddingVersion
    )) findings.push({ code: "incompatible_embedding", severity: "warning", targetType: "problem_mention", summary: "Linked mention and unique problem use incompatible embedding metadata" });
    if (mention.promptVersion !== EXTRACTION_PROMPT_VERSION) findings.push({ code: "old_extraction_prompt", severity: "info", targetType: "problem_mention", summary: "Mention uses an older extraction prompt version" });
    if (mention.embeddingVersion && mention.embeddingVersion !== EMBEDDING_TEXT_VERSION) findings.push({ code: "old_embedding_version", severity: "info", targetType: "problem_mention", summary: "Mention uses an older embedding text version" });
  }
  for (const count of mentionRawLinks.values()) if (count > 1) {
    findings.push({ code: "duplicate_problem_mention_link", severity: "critical", targetType: "problem_mention", summary: "Multiple problem mentions link to the same raw signal" });
  }
  const canonicalKeys = new Map<string, Set<string>>();
  for (const problem of problems) {
    const linked = mentionByProblem.get(problem._id?.toString() || "") || [];
    const sources = new Set(linked.map((item) => item.source));
    const evidence = linked.filter((item) => item.evidenceText).length;
    if (problem.mentionCount !== linked.length) findings.push({ code: "mention_count_mismatch", severity: "critical", targetType: "unique_problem", summary: "Stored mention count does not match linked mentions" });
    if (problem.evidenceCount !== evidence) findings.push({ code: "evidence_count_mismatch", severity: "critical", targetType: "unique_problem", summary: "Stored evidence count does not match linked evidence" });
    if (problem.sourceCount !== sources.size) findings.push({ code: "source_count_mismatch", severity: "critical", targetType: "unique_problem", summary: "Stored source count does not match linked sources" });
    if (!linked.length) findings.push({ code: "orphaned_unique_problem", severity: "critical", targetType: "unique_problem", summary: "Unique problem has no linked mentions" });
    if (problem.mentionCount >= 25) findings.push({ code: "suspiciously_large_cluster", severity: "warning", targetType: "unique_problem", summary: `Cluster contains ${problem.mentionCount} mentions` });
    if (problem.sourceCount === 1 && problem.mentionCount > 3) findings.push({ code: "single_source_concentration", severity: "warning", targetType: "unique_problem", summary: "Cluster has several mentions but only one source" });
    if (problem.geography === "mixed") findings.push({ code: "conflicting_geography", severity: "warning", targetType: "unique_problem", summary: "Cluster contains conflicting geography evidence" });
    const canonical = normalizeDeduplicationValue(problem.canonicalProblem);
    canonicalKeys.set(canonical, new Set([...(canonicalKeys.get(canonical) || []), problem.normalizedKey]));
  }
  for (const keys of canonicalKeys.values()) if (keys.size > 1) {
    findings.push({ code: "repeated_canonical_different_keys", severity: "warning", targetType: "unique_problem", summary: "Canonical wording is repeated across different normalized keys" });
  }
  const runIds = new Set(runs.map((item) => item._id?.toString()));
  for (const decision of decisions) {
    if (!runIds.has(decision.deduplicationRunId.toString())) findings.push({ code: "decision_missing_run", severity: "critical", targetType: "deduplication_decision", summary: "Decision references a missing run" });
    if (decision.promptVersion !== DUPLICATE_JUDGE_PROMPT_VERSION) findings.push({ code: "old_judge_prompt", severity: "info", targetType: "deduplication_decision", summary: "Decision uses an older judge prompt" });
  }
  const staleBefore = Date.now() - getDeduplicationConfig().staleProcessingMinutes * 60_000;
  for (const mention of mentions) if (mention.deduplicationStatus === "processing" && (mention.deduplicationStartedAt?.getTime() || 0) < staleBefore) {
    findings.push({ code: "stale_deduplication_processing", severity: "critical", targetType: "problem_mention", summary: "Mention has a stale processing claim" });
  }
  const extractionRetry = getResearchConfig().retryLimit;
  for (const raw of rawSignals) if (raw.processingStatus === "failed" && raw.retryCount > extractionRetry) {
    findings.push({ code: "retry_limit_exceeded", severity: "critical", targetType: "raw_signal", summary: "Failed signal exceeds retry limit" });
  }
  return {
    generatedAt: new Date(),
    reportOnly: true,
    totals: {
      findings: findings.length,
      critical: findings.filter((item) => item.severity === "critical").length,
      warnings: findings.filter((item) => item.severity === "warning").length,
      info: findings.filter((item) => item.severity === "info").length,
    },
    findings,
  };
}

export async function auditClusters(database: Db = defaultDb, limit = 10) {
  const problems = await uniqueProblemsCollection(database).find({ status: { $in: ["active", "needs_review"] } })
    .sort({ mentionCount: -1 }).limit(limit).toArray();
  const output = [];
  const canonicalFrequency = new Map<string, number>();
  for (const problem of problems) {
    const canonical = normalizeDeduplicationValue(problem.canonicalProblem);
    canonicalFrequency.set(canonical, (canonicalFrequency.get(canonical) || 0) + 1);
  }
  for (const problem of problems) {
    const mentions = await problemMentionsCollection(database).find({ uniqueProblemId: problem._id }).limit(50).toArray();
    const decisions = await deduplicationDecisionsCollection(database).find({ finalUniqueProblemId: problem._id }).sort({ processedAt: -1 }).limit(50).toArray();
    const workflows = new Set(mentions.map((item) => normalizeDeduplicationValue(item.workflow || "")).filter(Boolean));
    const users = new Set(mentions.map((item) => normalizeDeduplicationValue(item.affectedUser || "")).filter(Boolean));
    const obstacles = new Set(mentions.map((item) => normalizeDeduplicationValue(item.triggeringSituation || "")).filter(Boolean));
    const consequences = new Set(mentions.map((item) => normalizeDeduplicationValue(item.negativeConsequence || "")).filter(Boolean));
    const communities = new Set(mentions.map((item) => item.sourceCommunity).filter(Boolean));
    const flags = [
      ...(workflows.size > 3 ? ["conflicting_workflows"] : []),
      ...(users.size > 3 ? ["conflicting_affected_users"] : []),
      ...(obstacles.size > 3 ? ["conflicting_obstacles"] : []),
      ...(consequences.size > 3 ? ["conflicting_consequences"] : []),
      ...((canonicalFrequency.get(normalizeDeduplicationValue(problem.canonicalProblem)) || 0) > 1 ? ["possibly_under_merged"] : []),
      ...(problem.mentionCount >= 25 ? ["possibly_over_merged"] : []),
      ...(problem.sourceCount === 1 && problem.mentionCount > 3 ? ["single_source_concentration"] : []),
      ...(communities.size === 1 && problem.mentionCount > 3 ? ["single_community_concentration"] : []),
    ];
    output.push({
      canonicalProblem: problem.canonicalProblem,
      mentionVariants: mentions.map((item) => item.canonicalProblem.slice(0, 240)),
      affectedUsers: [...users], workflows: [...workflows], obstacles: [...obstacles], consequences: [...consequences],
      similarities: decisions.map((item) => item.similarity).filter((item) => item !== undefined),
      decisions: decisions.map((item) => item.decision),
      sources: problem.sources, communities: problem.communities,
      geography: problem.geography,
      confidenceDistribution: mentions.map((item) => item.extractionConfidence),
      flags,
    });
  }
  return { reportOnly: true, sampled: output.length, clusters: output };
}
