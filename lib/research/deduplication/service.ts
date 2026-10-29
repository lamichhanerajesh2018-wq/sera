import { randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import {
  getDeduplicationConfig,
  requireDeduplicationConfiguration,
  type DeduplicationConfig,
} from "../config.ts";
import { OpenRouterError } from "../extraction/client.ts";
import { logResearchEvent } from "../logger.ts";
import { ensureResearchIndexes } from "../models.ts";
import type {
  DeduplicationDecisionDocument,
  ProblemMentionDocument,
  RawSignalDocument,
  ResearchSource,
  UniqueProblemDocument,
} from "../types.ts";
import {
  OpenRouterDuplicateJudgeClient,
  OpenRouterEmbeddingClient,
  type DuplicateJudgeResult,
} from "./clients.ts";
import { DeduplicationRepository, type DeduplicationFilters, type SemanticCandidate } from "./repository.ts";
import {
  aggregateGeography,
  buildEmbeddingText,
  buildNormalizedProblemKey,
  hasMaterialGroundingConflict,
  initialUniqueGeography,
  isCanonicalImprovementGrounded,
  uniqueNormalized,
  validateEmbeddingVector,
} from "./text.ts";

export interface DeduplicationOptions {
  limit?: number;
  batchSize?: number;
  concurrency?: number;
  source?: ResearchSource;
  community?: string;
  industry?: string;
  minimumConfidence?: number;
  candidateLimit?: number;
  minimumSimilarity?: number;
  maximumCost?: number;
  dryRun?: boolean;
  retryFailed?: boolean;
}

export interface DeduplicationReport {
  runId?: string;
  attempted: number;
  embeddingsGenerated: number;
  newUniqueProblems: number;
  mergedMentions: number;
  relatedButDistinct: number;
  differentProblems: number;
  needsReview: number;
  failed: number;
  retries: number;
  staleRecovered: number;
  failedRequeued: number;
  embeddingTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  dryRun: boolean;
  costLimitReached: boolean;
  status: "completed" | "partially_completed";
  durationMs: number;
}

interface Dependencies {
  database?: Db;
  repository?: DeduplicationRepository;
  embeddingClient?: OpenRouterEmbeddingClient;
  judgeClient?: OpenRouterDuplicateJudgeClient;
  config?: DeduplicationConfig;
  now?: () => Date;
  ensureIndexes?: boolean;
  workerId?: string;
}

interface ValidatedOptions {
  limit: number;
  batchSize: number;
  concurrency: number;
  filters: DeduplicationFilters;
  candidateLimit: number;
  minimumSimilarity: number;
  maximumCost: number;
  dryRun: boolean;
  retryFailed: boolean;
}

function integer(value: number, name: string, maximum: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be between 1 and ${maximum}`);
  }
  return value;
}

export function validateDeduplicationOptions(
  input: DeduplicationOptions,
  config: DeduplicationConfig = getDeduplicationConfig(),
): ValidatedOptions {
  const minimumConfidence = input.minimumConfidence ?? config.minimumMentionConfidence;
  const minimumSimilarity = input.minimumSimilarity ?? config.minimumCandidateSimilarity;
  const maximumCost = input.maximumCost ?? config.maximumCostPerRun;
  if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1) {
    throw new Error("minimumConfidence must be between 0 and 1");
  }
  if (!Number.isFinite(minimumSimilarity) || minimumSimilarity < -1 || minimumSimilarity > 1) {
    throw new Error("minimumSimilarity must be between -1 and 1");
  }
  if (!Number.isFinite(maximumCost) || maximumCost < 0 || maximumCost > config.maximumCostPerRun) {
    throw new Error(`maximumCost must be between 0 and ${config.maximumCostPerRun}`);
  }
  return {
    limit: integer(input.limit ?? config.embeddingBatchSize, "limit", config.maximumRecordsPerRun),
    batchSize: integer(input.batchSize ?? config.embeddingBatchSize, "batchSize", config.maximumRecordsPerRun),
    concurrency: integer(input.concurrency ?? config.concurrency, "concurrency", 20),
    filters: {
      minimumConfidence,
      ...(input.source && { source: input.source }),
      ...(input.community?.trim() && { community: input.community.trim() }),
      ...(input.industry?.trim() && { industry: input.industry.trim() }),
    },
    candidateLimit: integer(input.candidateLimit ?? config.candidateLimit, "candidateLimit", 100),
    minimumSimilarity,
    maximumCost,
    dryRun: input.dryRun ?? config.dryRun,
    retryFailed: Boolean(input.retryFailed),
  };
}

function assertEligibleCanonical(mention: ProblemMentionDocument) {
  const canonical = mention.canonicalProblem.trim();
  if (canonical.length < 20 || canonical.endsWith("?")) throw new Error("Canonical problem is not a valid statement");
  if (/^(?:build|create|develop|launch)\b.*\b(?:app|software|platform|service)\b/i.test(canonical)) {
    throw new Error("Canonical problem is not solution-neutral");
  }
}

function sourceDate(mention: ProblemMentionDocument, raw: RawSignalDocument | null) {
  return raw?.publishedAt || raw?.collectedAt || mention.createdAt;
}

function createUniqueProblem(input: {
  mention: ProblemMentionDocument;
  embedding: number[];
  embeddingModel: string;
  embeddingVersion: string;
  observedAt: Date;
  now: Date;
}): UniqueProblemDocument {
  const { mention } = input;
  return {
    canonicalProblem: mention.canonicalProblem,
    shortLabel: mention.shortLabel,
    industry: mention.industry || "Unclassified",
    subIndustries: uniqueNormalized([mention.subIndustry]),
    affectedUsers: uniqueNormalized([mention.affectedUser]),
    affectedRoles: uniqueNormalized([mention.affectedRole]),
    organizationTypes: uniqueNormalized([mention.organizationType]),
    workflows: uniqueNormalized([mention.workflow]),
    problemTypes: [mention.problemType],
    currentWorkarounds: uniqueNormalized([mention.currentWorkaround]),
    triggeringSituations: uniqueNormalized([mention.triggeringSituation]),
    desiredOutcomes: uniqueNormalized([mention.desiredOutcome]),
    negativeConsequences: uniqueNormalized([mention.negativeConsequence]),
    geography: initialUniqueGeography(mention.geography),
    normalizedKey: buildNormalizedProblemKey(mention),
    embedding: input.embedding,
    embeddingModel: input.embeddingModel,
    embeddingDimensions: input.embedding.length,
    embeddingVersion: input.embeddingVersion,
    mentionCount: 1,
    evidenceCount: mention.evidenceText ? 1 : 0,
    sourceCount: 1,
    sources: [mention.source],
    communities: uniqueNormalized([mention.sourceCommunity]),
    averageConfidence: mention.extractionConfidence,
    highestConfidence: mention.extractionConfidence,
    firstSeenAt: input.observedAt,
    lastSeenAt: input.observedAt,
    status: "active",
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function mergeUniqueProblem(input: {
  candidate: UniqueProblemDocument;
  mention: ProblemMentionDocument;
  observedAt: Date;
  judge: DuplicateJudgeResult;
  judgeThreshold: number;
  now: Date;
}) {
  const { candidate, mention } = input;
  const canImprove = input.judge.output.confidence >= Math.max(0.95, input.judgeThreshold)
    && isCanonicalImprovementGrounded(
      input.judge.output.preferredCanonicalProblem,
      mention,
      candidate.canonicalProblem,
    );
  const canonicalProblem = canImprove && input.judge.output.preferredCanonicalProblem
    ? input.judge.output.preferredCanonicalProblem
    : candidate.canonicalProblem;
  const mentionCount = candidate.mentionCount + 1;
  const sources = uniqueNormalized([...candidate.sources, mention.source]) as UniqueProblemDocument["sources"];
  const merged: UniqueProblemDocument = {
    ...candidate,
    canonicalProblem,
    normalizedKey: canImprove
      ? buildNormalizedProblemKey({
        canonicalProblem,
        affectedUser: candidate.affectedUsers[0] || mention.affectedUser,
        workflow: candidate.workflows[0] || mention.workflow,
      })
      : candidate.normalizedKey,
    subIndustries: uniqueNormalized([...candidate.subIndustries, mention.subIndustry]),
    affectedUsers: uniqueNormalized([...candidate.affectedUsers, mention.affectedUser]),
    affectedRoles: uniqueNormalized([...candidate.affectedRoles, mention.affectedRole]),
    organizationTypes: uniqueNormalized([...candidate.organizationTypes, mention.organizationType]),
    workflows: uniqueNormalized([...candidate.workflows, mention.workflow]),
    problemTypes: uniqueNormalized([...candidate.problemTypes, mention.problemType]) as UniqueProblemDocument["problemTypes"],
    currentWorkarounds: uniqueNormalized([...candidate.currentWorkarounds, mention.currentWorkaround]),
    triggeringSituations: uniqueNormalized([...candidate.triggeringSituations, mention.triggeringSituation]),
    desiredOutcomes: uniqueNormalized([...candidate.desiredOutcomes, mention.desiredOutcome]),
    negativeConsequences: uniqueNormalized([...candidate.negativeConsequences, mention.negativeConsequence]),
    geography: aggregateGeography(candidate.geography, mention.geography),
    mentionCount,
    evidenceCount: candidate.evidenceCount + (mention.evidenceText ? 1 : 0),
    sources,
    sourceCount: sources.length,
    communities: uniqueNormalized([...candidate.communities, mention.sourceCommunity]),
    averageConfidence:
      (candidate.averageConfidence * candidate.mentionCount + mention.extractionConfidence) / mentionCount,
    highestConfidence: Math.max(candidate.highestConfidence, mention.extractionConfidence),
    firstSeenAt: new Date(Math.min(candidate.firstSeenAt.getTime(), input.observedAt.getTime())),
    lastSeenAt: new Date(Math.max(candidate.lastSeenAt.getTime(), input.observedAt.getTime())),
    updatedAt: input.now,
  };
  return { merged, canonicalChanged: canImprove };
}

export async function runDeduplicationPipeline(
  input: DeduplicationOptions = {},
  dependencies: Dependencies = {},
): Promise<DeduplicationReport> {
  const started = Date.now();
  const config = dependencies.config || getDeduplicationConfig();
  const credentials = requireDeduplicationConfiguration(config);
  const options = validateDeduplicationOptions(input, config);
  const database = dependencies.database || defaultDb;
  if (dependencies.ensureIndexes !== false) await ensureResearchIndexes(database);
  const repository = dependencies.repository || new DeduplicationRepository(database);
  const embeddingClient = dependencies.embeddingClient || new OpenRouterEmbeddingClient(config);
  const judgeClient = dependencies.judgeClient || new OpenRouterDuplicateJudgeClient(config);
  const now = dependencies.now || (() => new Date());
  const ephemeralRunId = new ObjectId();
  const run = options.dryRun ? null : await repository.createRun({
    embeddingModel: credentials.embeddingModel,
    duplicateJudgeModel: credentials.duplicateJudgeModel,
    embeddingVersion: config.embeddingVersion,
    promptVersion: config.promptVersion,
    configurationSnapshot: {
      limit: options.limit,
      batchSize: options.batchSize,
      concurrency: options.concurrency,
      source: options.filters.source || null,
      community: options.filters.community || null,
      industry: options.filters.industry || null,
      minimumConfidence: options.filters.minimumConfidence,
      candidateLimit: options.candidateLimit,
      minimumSimilarity: options.minimumSimilarity,
      highSimilarity: config.highSimilarity,
      ambiguousSimilarity: config.ambiguousSimilarity,
      judgeConfidence: config.judgeConfidence,
      maximumCost: options.maximumCost,
      candidateRetrieval: "application_cosine_fallback",
    },
  });
  const runId = run?._id || ephemeralRunId;
  const report: DeduplicationReport = {
    ...(run?._id && { runId: run._id.toString() }),
    attempted: 0, embeddingsGenerated: 0, newUniqueProblems: 0, mergedMentions: 0,
    relatedButDistinct: 0, differentProblems: 0, needsReview: 0, failed: 0,
    retries: 0, staleRecovered: 0, failedRequeued: 0, embeddingTokens: 0,
    inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0,
    dryRun: options.dryRun, costLimitReached: options.maximumCost === 0,
    status: "completed", durationMs: 0,
  };
  const increment = async (counters: Parameters<DeduplicationRepository["incrementRun"]>[1]) => {
    if (run?._id) await repository.incrementRun(run._id, counters);
  };

  try {
    if (!options.dryRun) {
      report.staleRecovered = await repository.recoverStale(
        new Date(now().getTime() - config.staleProcessingMinutes * 60_000),
      );
      if (options.retryFailed) {
        report.failedRequeued = await repository.requeueFailed(config.retryLimit, options.filters);
      }
    }
    const dryMentions = options.dryRun
      ? await repository.listEligibleMentions(options.limit, options.filters)
      : [];
    let dryCursor = 0;
    let totalReserved = 0;
    const workerPrefix = dependencies.workerId || randomUUID();

    const accountEmbedding = async (result: Awaited<ReturnType<OpenRouterEmbeddingClient["embed"]>>) => {
      report.embeddingsGenerated += result.embeddings.length;
      report.retries += result.retryCount;
      report.embeddingTokens += result.usage.totalTokens;
      report.totalTokens += result.usage.totalTokens;
      report.estimatedCost += result.usage.estimatedCost;
      await increment({
        embeddingsGenerated: result.embeddings.length, retryCount: result.retryCount,
        embeddingTokens: result.usage.totalTokens, totalTokens: result.usage.totalTokens,
        estimatedCost: result.usage.estimatedCost,
      });
      if (report.estimatedCost >= options.maximumCost) report.costLimitReached = true;
    };

    const accountJudge = async (result: DuplicateJudgeResult) => {
      report.retries += result.retryCount;
      report.inputTokens += result.usage.inputTokens;
      report.outputTokens += result.usage.outputTokens;
      report.totalTokens += result.usage.totalTokens;
      report.estimatedCost += result.usage.estimatedCost;
      await increment({
        retryCount: result.retryCount, inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens, totalTokens: result.usage.totalTokens,
        estimatedCost: result.usage.estimatedCost,
      });
      if (report.estimatedCost >= options.maximumCost) report.costLimitReached = true;
    };

    const decisionDocument = (
      mention: ProblemMentionDocument,
      action: DeduplicationDecisionDocument["finalAction"],
      decision: DeduplicationDecisionDocument["decision"],
      reason: string,
      candidate?: SemanticCandidate,
      judge?: DuplicateJudgeResult,
    ): DeduplicationDecisionDocument => ({
      mentionId: mention._id!,
      ...(candidate?.problem._id && { candidateUniqueProblemId: candidate.problem._id }),
      ...(candidate && { similarity: candidate.similarity }),
      decision,
      ...(judge && { decisionConfidence: judge.output.confidence, model: judge.model }),
      reason: reason.slice(0, 1_000),
      finalAction: action,
      promptVersion: config.promptVersion,
      deduplicationRunId: runId,
      processedAt: now(),
      createdAt: now(),
    });

    const processMention = async (mention: ProblemMentionDocument) => {
      if (!mention._id) throw new Error("Problem mention has no identifier");
      report.attempted += 1;
      await increment({ attemptedMentions: 1 });
      try {
        assertEligibleCanonical(mention);
        let embedding: number[];
        if (
          mention.embedding &&
          mention.embeddingModel === credentials.embeddingModel &&
          mention.embeddingVersion === config.embeddingVersion
        ) {
          embedding = validateEmbeddingVector(mention.embedding, mention.embeddingDimensions);
        } else {
          const result = await embeddingClient.embed([buildEmbeddingText(mention)]);
          await accountEmbedding(result);
          embedding = result.embeddings[0];
          if (!options.dryRun) {
            await repository.saveMentionEmbedding(
              mention._id, runId, embedding, credentials.embeddingModel, config.embeddingVersion,
            );
          }
        }
        const normalizedKey = buildNormalizedProblemKey(mention);
        const exact = await repository.findExactCandidate(normalizedKey);
        const semantic = await repository.findSemanticCandidates({
          embedding,
          model: credentials.embeddingModel,
          dimensions: embedding.length,
          version: config.embeddingVersion,
          minimumSimilarity: options.minimumSimilarity,
          candidateLimit: options.candidateLimit,
          scanLimit: config.candidateScanLimit,
          excludeId: exact?._id,
        });
        const compatibleCandidateCount = await repository.countCompatibleCandidates({
          model: credentials.embeddingModel,
          dimensions: embedding.length,
          version: config.embeddingVersion,
          excludeId: exact?._id,
        });
        const candidateSpaceTruncated = compatibleCandidateCount > config.candidateScanLimit;
        const candidates: SemanticCandidate[] = [
          ...(exact ? [{ problem: exact, similarity: 1 }] : []),
          ...semantic,
        ].slice(0, options.candidateLimit);
        const raw = await repository.findRawSignal(mention.rawSignalId);
        const observedAt = sourceDate(mention, raw);
        const nonMergeAudits: DeduplicationDecisionDocument[] = [];

        if (candidates.length && report.costLimitReached) {
          report.needsReview += 1;
          await increment({ uncertainReviewDecisions: 1 });
          const audit = decisionDocument(
            mention, "needs_review", "uncertain",
            "Run cost ceiling was reached before candidate judgment", candidates[0],
          );
          if (!options.dryRun) {
            await repository.markNeedsReview({
              mentionId: mention._id, runId, decision: audit, similarity: candidates[0].similarity,
            });
          }
          return;
        }

        for (let index = 0; index < candidates.length; index += 1) {
          const candidate = candidates[index];
          if (index > 0 && report.costLimitReached) {
            report.needsReview += 1;
            await increment({ uncertainReviewDecisions: 1 });
            const audit = decisionDocument(
              mention, "needs_review", "uncertain",
              "Run cost ceiling was reached before all candidates could be judged", candidate,
            );
            if (!options.dryRun) {
              await repository.markNeedsReview({
                mentionId: mention._id, runId, decision: audit, similarity: candidate.similarity,
              });
              for (const previous of nonMergeAudits) {
                previous.finalAction = "needs_review";
                await repository.recordDecision(previous);
              }
            }
            return;
          }
          const judged = await judgeClient.judge(mention, candidate.problem, candidate.similarity);
          await accountJudge(judged);
          const { output } = judged;
          if (output.decision === "related_but_distinct") {
            report.relatedButDistinct += 1;
            await increment({ relatedButDistinctDecisions: 1 });
            nonMergeAudits.push(decisionDocument(
              mention, "created_new", output.decision, output.reason, candidate, judged,
            ));
            continue;
          }
          if (output.decision === "different_problem") {
            report.differentProblems += 1;
            await increment({ differentProblemDecisions: 1 });
            nonMergeAudits.push(decisionDocument(
              mention, "created_new", output.decision, output.reason, candidate, judged,
            ));
            continue;
          }
          const conflict = hasMaterialGroundingConflict(mention, candidate.problem);
          if (
            output.decision === "uncertain" ||
            output.confidence < config.judgeConfidence ||
            conflict
          ) {
            report.needsReview += 1;
            await increment({ uncertainReviewDecisions: 1 });
            const reason = conflict ? `Grounding conflict: ${output.reason}` : output.reason;
            const audit = decisionDocument(mention, "needs_review", "uncertain", reason, candidate, judged);
            if (!options.dryRun) {
              await repository.markNeedsReview({
                mentionId: mention._id, runId, decision: audit,
                similarity: candidate.similarity, confidence: output.confidence,
              });
              for (const previous of nonMergeAudits) {
                previous.finalAction = "needs_review";
                await repository.recordDecision(previous);
              }
            }
            return;
          }
          const { merged, canonicalChanged } = mergeUniqueProblem({
            candidate: candidate.problem, mention, observedAt, judge: judged,
            judgeThreshold: config.judgeConfidence, now: now(),
          });
          const audit = decisionDocument(
            mention, "merged_existing", "same_problem", output.reason, candidate, judged,
          );
          audit.finalUniqueProblemId = candidate.problem._id;
          if (canonicalChanged) {
            audit.previousCanonicalProblem = candidate.problem.canonicalProblem;
            audit.newCanonicalProblem = merged.canonicalProblem;
          }
          if (!options.dryRun) {
            await repository.mergeAndLink({
              mention, previous: candidate.problem, merged, decision: audit, runId,
              similarity: candidate.similarity, confidence: output.confidence,
              duplicateDecision: "same_problem",
            });
            for (const previous of nonMergeAudits) {
              previous.finalAction = "merged_existing";
              previous.finalUniqueProblemId = candidate.problem._id;
              await repository.recordDecision(previous);
            }
          }
          report.mergedMentions += 1;
          await increment({ mergedMentions: 1 });
          return;
        }

        if (candidateSpaceTruncated) {
          report.needsReview += 1;
          await increment({ uncertainReviewDecisions: 1 });
          const audit = decisionDocument(
            mention, "needs_review", "uncertain",
            "Compatible candidate set exceeded the safe application-side scan limit",
          );
          if (!options.dryRun) {
            await repository.markNeedsReview({ mentionId: mention._id, runId, decision: audit });
            for (const previous of nonMergeAudits) {
              previous.finalAction = "needs_review";
              await repository.recordDecision(previous);
            }
          }
          return;
        }

        const uniqueProblem = createUniqueProblem({
          mention, embedding, embeddingModel: credentials.embeddingModel,
          embeddingVersion: config.embeddingVersion, observedAt, now: now(),
        });
        const audit = decisionDocument(
          mention, "created_new", "created_new",
          candidates.length ? "No retrieved candidate was a genuine duplicate" : "No compatible candidate met retrieval criteria",
        );
        if (!options.dryRun) {
          const creation = await repository.createAndLink({ mention, uniqueProblem, decision: audit, runId });
          if (creation === "duplicate_key") {
            throw new Error("Concurrent exact duplicate creation detected; retry safely");
          }
          for (const previous of nonMergeAudits) {
            previous.finalUniqueProblemId = uniqueProblem._id;
            await repository.recordDecision(previous);
          }
        }
        report.newUniqueProblems += 1;
        await increment({ newUniqueProblems: 1 });
      } catch (error) {
        report.failed += 1;
        const retries = error instanceof OpenRouterError ? error.retries : 0;
        report.retries += retries;
        await increment({ failedCount: 1, retryCount: retries });
        if (!options.dryRun) await repository.markFailed(mention._id, runId, error);
        logResearchEvent("error", "deduplication_mention_failed", {
          source: mention.source,
          category: error instanceof OpenRouterError ? error.category : "validation_or_consistency",
        });
      }
    };

    while (totalReserved < options.limit && !report.costLimitReached) {
      let batchReserved = 0;
      const reserve = () => {
        if (batchReserved >= options.batchSize || totalReserved >= options.limit || report.costLimitReached) return false;
        batchReserved += 1;
        totalReserved += 1;
        return true;
      };
      const next = async (workerId: string) => {
        if (!reserve()) return null;
        if (options.dryRun) return dryMentions[dryCursor++] || null;
        return repository.claimNextMention({ runId, workerId, filters: options.filters, now: now() });
      };
      const worker = async (index: number) => {
        while (true) {
          const mention = await next(`${workerPrefix}:${index}`);
          if (!mention) break;
          await processMention(mention);
        }
      };
      const workers = Math.min(options.concurrency, options.batchSize, options.limit - totalReserved);
      await Promise.all(Array.from({ length: workers }, (_, index) => worker(index)));
      if (!batchReserved) break;
    }
    report.status = report.failed ? "partially_completed" : "completed";
    report.durationMs = Date.now() - started;
    if (run?._id) await repository.completeRun(run._id, report.status);
    logResearchEvent("info", "deduplication_run_completed", { ...report, runId: undefined });
    return report;
  } catch (error) {
    if (run?._id) await repository.failRun(run._id, error);
    throw error;
  }
}
