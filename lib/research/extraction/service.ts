import { randomUUID } from "node:crypto";
import type { Db, ObjectId } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import {
  getExtractionConfig,
  requireOpenRouterConfiguration,
  type ExtractionConfig,
} from "../config.ts";
import { logResearchEvent } from "../logger.ts";
import { ensureResearchIndexes } from "../models.ts";
import type {
  ProblemMentionDocument,
  ProblemMentionStatus,
  RawSignalDocument,
  ResearchSource,
} from "../types.ts";
import { OpenRouterExtractionClient, OpenRouterError } from "./client.ts";
import { mergeProblemGeography } from "./geography.ts";
import { ExtractionRepository, type ExtractionFilters } from "./repository.ts";
import {
  ExtractionValidationError,
  conservativelyGroundExtraction,
  parseAndValidateExtraction,
} from "./schema.ts";

export interface ExtractionPipelineOptions {
  limit?: number;
  batchSize?: number;
  concurrency?: number;
  source?: ResearchSource;
  community?: string;
  minimumConfidence?: number;
  maximumInputLength?: number;
  maximumCost?: number;
  dryRun?: boolean;
  retryFailed?: boolean;
}

export interface ExtractionPipelineReport {
  runId?: string;
  attempted: number;
  accepted: number;
  needsReview: number;
  noProblem: number;
  failed: number;
  duplicates: number;
  retries: number;
  staleRecovered: number;
  failedRequeued: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  dryRun: boolean;
  costLimitReached: boolean;
  durationMs: number;
  status: "completed" | "partially_completed";
}

interface ServiceDependencies {
  database?: Db;
  repository?: ExtractionRepository;
  client?: OpenRouterExtractionClient;
  config?: ExtractionConfig;
  now?: () => Date;
  ensureIndexes?: boolean;
  workerId?: string;
}

interface ValidatedOptions {
  limit: number;
  batchSize: number;
  concurrency: number;
  filters: ExtractionFilters;
  minimumConfidence: number;
  maximumInputLength: number;
  maximumCost: number;
  dryRun: boolean;
  retryFailed: boolean;
}

function positiveInteger(value: number, name: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be between 1 and ${maximum}`);
  }
  return value;
}

export function validateExtractionOptions(
  options: ExtractionPipelineOptions,
  config: ExtractionConfig = getExtractionConfig(),
): ValidatedOptions {
  const limit = positiveInteger(options.limit ?? config.batchSize, "limit", config.maximumRecordsPerRun);
  const batchSize = positiveInteger(options.batchSize ?? config.batchSize, "batchSize", config.maximumRecordsPerRun);
  const concurrency = positiveInteger(options.concurrency ?? config.concurrency, "concurrency", 20);
  const minimumConfidence = options.minimumConfidence ?? config.acceptConfidence;
  if (!Number.isFinite(minimumConfidence) || minimumConfidence < config.reviewConfidence || minimumConfidence > 1) {
    throw new Error(`minimumConfidence must be between ${config.reviewConfidence} and 1`);
  }
  const maximumInputLength = options.maximumInputLength ?? config.maximumInputLength;
  if (!Number.isSafeInteger(maximumInputLength) || maximumInputLength < 500 || maximumInputLength > config.maximumInputLength) {
    throw new Error(`maximumInputLength must be between 500 and ${config.maximumInputLength}`);
  }
  const maximumCost = options.maximumCost ?? config.maximumCostPerRun;
  if (!Number.isFinite(maximumCost) || maximumCost < 0 || maximumCost > config.maximumCostPerRun) {
    throw new Error(`maximumCost must be between 0 and ${config.maximumCostPerRun}`);
  }
  return {
    limit,
    batchSize,
    concurrency,
    filters: {
      ...(options.source && { source: options.source }),
      ...(options.community?.trim() && { community: options.community.trim() }),
    },
    minimumConfidence,
    maximumInputLength,
    maximumCost,
    dryRun: options.dryRun ?? config.dryRun,
    retryFailed: Boolean(options.retryFailed),
  };
}

export async function runExtractionPipeline(
  input: ExtractionPipelineOptions = {},
  dependencies: ServiceDependencies = {},
): Promise<ExtractionPipelineReport> {
  const started = Date.now();
  const config = dependencies.config || getExtractionConfig();
  const credentials = requireOpenRouterConfiguration(config);
  const options = validateExtractionOptions(input, config);
  const database = dependencies.database || defaultDb;
  if (dependencies.ensureIndexes !== false) await ensureResearchIndexes(database);
  const repository = dependencies.repository || new ExtractionRepository(database);
  const client = dependencies.client || new OpenRouterExtractionClient({
    ...config,
    maximumInputLength: options.maximumInputLength,
  });
  const now = dependencies.now || (() => new Date());
  const workerPrefix = dependencies.workerId || randomUUID();
  const run = await repository.createRun({
    model: credentials.model,
    promptVersion: config.promptVersion,
    dryRun: options.dryRun,
    configurationSnapshot: {
      limit: options.limit,
      batchSize: options.batchSize,
      concurrency: options.concurrency,
      source: options.filters.source || null,
      community: options.filters.community || null,
      minimumConfidence: options.minimumConfidence,
      reviewConfidence: config.reviewConfidence,
      maximumInputLength: options.maximumInputLength,
      maximumEvidenceLength: config.maximumEvidenceLength,
      maximumCost: options.maximumCost,
      staleProcessingMinutes: config.staleProcessingMinutes,
    },
  });
  if (!run._id) throw new Error("Extraction run was created without an identifier");
  const runId = run._id as ObjectId;
  const report: ExtractionPipelineReport = {
    runId: runId.toString(),
    attempted: 0,
    accepted: 0,
    needsReview: 0,
    noProblem: 0,
    failed: 0,
    duplicates: 0,
    retries: 0,
    staleRecovered: 0,
    failedRequeued: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    dryRun: options.dryRun,
    costLimitReached: false,
    durationMs: 0,
    status: "completed",
  };
  if (options.maximumCost === 0) report.costLimitReached = true;

  try {
    if (!options.dryRun) {
      report.staleRecovered = await repository.recoverStaleProcessing(
        new Date(now().getTime() - config.staleProcessingMinutes * 60_000),
      );
      if (options.retryFailed) {
        report.failedRequeued = await repository.requeueFailedSignals(config.retryLimit, options.filters);
      }
    }
    const drySignals = options.dryRun
      ? await repository.listPendingSignals(options.limit, options.filters)
      : [];
    let dryCursor = 0;
    let totalReserved = 0;

    const processSignal = async (signal: RawSignalDocument) => {
      if (!signal._id) throw new Error("Raw signal has no identifier");
      report.attempted += 1;
      await repository.incrementRun(runId, { attemptedCount: 1 });
      const existing = await repository.findMentionByRawSignalId(signal._id);
      if (existing) {
        report.duplicates += 1;
        if (existing.status === "accepted") {
          report.accepted += 1;
          await repository.incrementRun(runId, { acceptedProblemCount: 1 });
        } else {
          report.needsReview += 1;
          await repository.incrementRun(runId, { needsReviewCount: 1 });
        }
        if (!options.dryRun) await repository.markProcessed(signal._id);
        return;
      }
      try {
        const accountResult = async (result: Awaited<ReturnType<OpenRouterExtractionClient["extract"]>>) => {
          report.retries += result.retryCount;
          report.inputTokens += result.usage.inputTokens;
          report.outputTokens += result.usage.outputTokens;
          report.totalTokens += result.usage.totalTokens;
          report.estimatedCost += result.usage.estimatedCost;
          await repository.incrementRun(runId, {
            retryCount: result.retryCount,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
            estimatedCost: result.usage.estimatedCost,
          });
          if (report.estimatedCost >= options.maximumCost) report.costLimitReached = true;
        };
        let result = await client.extract(signal);
        await accountResult(result);
        let output;
        try {
          output = parseAndValidateExtraction(
            conservativelyGroundExtraction(result.output, signal, config.maximumEvidenceLength),
            signal,
            config.maximumEvidenceLength,
          );
        } catch (error) {
          if (!(error instanceof ExtractionValidationError) || !config.validationRepairLimit || report.costLimitReached) {
            throw error;
          }
          report.retries += 1;
          await repository.incrementRun(runId, { retryCount: 1 });
          result = await client.extract(signal, error.message);
          await accountResult(result);
          output = parseAndValidateExtraction(
            conservativelyGroundExtraction(result.output, signal, config.maximumEvidenceLength),
            signal,
            config.maximumEvidenceLength,
          );
        }

        if (!output.containsProblem || output.extractionConfidence < config.reviewConfidence) {
          const reason = !output.containsProblem
            ? output.rejectionReason!
            : `low_confidence:${output.extractionConfidence.toFixed(4)}`;
          report.noProblem += 1;
          await repository.incrementRun(runId, { noProblemCount: 1 });
          if (!options.dryRun) await repository.markNoProblem(signal._id, reason);
          return;
        }
        const status: ProblemMentionStatus = output.extractionConfidence >= options.minimumConfidence
          ? "accepted"
          : "needs_review";
        const timestamp = now();
        const mention: ProblemMentionDocument = {
          rawSignalId: signal._id,
          extractionRunId: runId,
          source: signal.source,
          ...(signal.sourceCommunity && { sourceCommunity: signal.sourceCommunity }),
          containsProblem: true,
          status,
          canonicalProblem: output.canonicalProblem!,
          shortLabel: output.shortLabel!,
          industry: output.industry,
          subIndustry: output.subIndustry,
          affectedUser: output.affectedUser,
          affectedRole: output.affectedRole,
          organizationType: output.organizationType,
          workflow: output.workflow,
          problemType: output.problemType!,
          currentWorkaround: output.currentWorkaround,
          triggeringSituation: output.triggeringSituation,
          desiredOutcome: output.desiredOutcome,
          negativeConsequence: output.negativeConsequence,
          geography: mergeProblemGeography(signal),
          evidenceText: output.evidenceText!,
          extractionConfidence: output.extractionConfidence,
          rejectionReason: null,
          model: result.model,
          promptVersion: config.promptVersion,
          ...(result.usage.inputTokens && { inputTokens: result.usage.inputTokens }),
          ...(result.usage.outputTokens && { outputTokens: result.usage.outputTokens }),
          ...(result.usage.totalTokens && { totalTokens: result.usage.totalTokens }),
          ...(result.usage.estimatedCost && { estimatedCost: result.usage.estimatedCost }),
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        if (!options.dryRun) {
          const insert = await repository.insertMention(mention);
          if (insert === "duplicate") report.duplicates += 1;
          await repository.markProcessed(signal._id);
        }
        if (status === "accepted") {
          report.accepted += 1;
          await repository.incrementRun(runId, { acceptedProblemCount: 1 });
        } else {
          report.needsReview += 1;
          await repository.incrementRun(runId, { needsReviewCount: 1 });
        }
      } catch (error) {
        report.failed += 1;
        const retries = error instanceof OpenRouterError ? error.retries : 0;
        report.retries += retries;
        await repository.incrementRun(runId, { failedCount: 1, retryCount: retries });
        if (!options.dryRun) await repository.markFailed(signal._id, error);
        logResearchEvent("error", "extraction_signal_failed", {
          source: signal.source,
          sourceId: signal.sourceId,
          category: error instanceof OpenRouterError ? error.category : "validation",
          reason: error instanceof Error ? error.message.slice(0, 500) : "unknown_error",
        });
      }
    };

    while (totalReserved < options.limit && !report.costLimitReached) {
      let batchReserved = 0;
      const reserve = () => {
        if (
          batchReserved >= options.batchSize ||
          totalReserved >= options.limit ||
          report.costLimitReached
        ) return false;
        batchReserved += 1;
        totalReserved += 1;
        return true;
      };
      const nextSignal = async (workerId: string): Promise<RawSignalDocument | null> => {
        if (!reserve()) return null;
        if (options.dryRun) return drySignals[dryCursor++] || null;
        return repository.claimNextSignal({ runId, workerId, filters: options.filters, now: now() });
      };
      const worker = async (workerIndex: number) => {
        while (true) {
          const signal = await nextSignal(`${workerPrefix}:${workerIndex}`);
          if (!signal) break;
          await processSignal(signal);
        }
      };
      const workerCount = Math.min(options.concurrency, options.batchSize, options.limit - totalReserved);
      await Promise.all(Array.from({ length: workerCount }, (_, index) => worker(index)));
      if (batchReserved === 0) break;
    }
    report.status = report.failed ? "partially_completed" : "completed";
    report.durationMs = Date.now() - started;
    await repository.completeRun(runId, report.status);
    logResearchEvent("info", "extraction_run_completed", { ...report, runId: undefined });
    return report;
  } catch (error) {
    await repository.failRun(runId, error);
    throw error;
  }
}
