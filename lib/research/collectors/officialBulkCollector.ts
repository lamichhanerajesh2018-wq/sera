import type { Db, ObjectId } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import { getResearchConfig, type BulkCollectorConfig } from "../config.ts";
import { logResearchEvent } from "../logger.ts";
import { ensureResearchIndexes } from "../models.ts";
import { ResearchRepository } from "../repository.ts";
import type { CollectionRunStatus, GeographyEvidence, ResearchSource } from "../types.ts";

export interface OfficialBulkOptions {
  maximumRecords: number;
  maximumRowsScanned?: number;
  batchSize?: number;
  dryRun: boolean;
  includePreviews?: boolean;
}

export interface OfficialBulkReport {
  rowsScanned: number;
  recordsAccepted: number;
  recordsInserted: number;
  wouldInsert: number;
  duplicates: number;
  skippedByReason: Record<string, number>;
  failures: number;
  geographyEvidence: Partial<Record<GeographyEvidence, number>>;
  dryRun: boolean;
  runStatus: CollectionRunStatus;
  durationMs: number;
  previews: Array<{ sourceId: string; title: string; bodyPreview: string }>;
}

interface BulkSpecification {
  source: ResearchSource;
  collectorName: string;
  downloadUrl: string;
  rows: () => AsyncIterable<Record<string, string>>;
  normalize: (row: Record<string, string>, now: Date) =>
    | { accepted: true; geographyEvidence: GeographyEvidence; signal: Record<string, unknown> }
    | { accepted: false; reason: string };
}

interface Dependencies {
  database?: Db;
  repository?: ResearchRepository;
  now?: () => Date;
  ensureIndexes?: boolean;
  config: BulkCollectorConfig;
}

function increment(values: Record<string, number>, key: string, amount = 1) {
  values[key] = (values[key] || 0) + amount;
}

export async function collectOfficialBulkRows(
  input: OfficialBulkOptions,
  specification: BulkSpecification,
  dependencies: Dependencies,
): Promise<OfficialBulkReport> {
  const startedAt = Date.now();
  const { config } = dependencies;
  const maximumRowsScanned = input.maximumRowsScanned ?? config.maximumRowsScannedPerRun;
  const batchSize = input.batchSize ?? config.batchSize;
  if (!Number.isSafeInteger(input.maximumRecords) || input.maximumRecords < 1 ||
      input.maximumRecords > config.maximumRecordsPerRun) {
    throw new Error(`maximumRecords must be between 1 and ${config.maximumRecordsPerRun}`);
  }
  if (!Number.isSafeInteger(maximumRowsScanned) || maximumRowsScanned < input.maximumRecords ||
      maximumRowsScanned > config.maximumRowsScannedPerRun) {
    throw new Error(`maximumRowsScanned must be between maximumRecords and ${config.maximumRowsScannedPerRun}`);
  }
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1_000) {
    throw new Error("batchSize must be between 1 and 1000");
  }
  const database = dependencies.database || defaultDb;
  if (dependencies.ensureIndexes !== false) await ensureResearchIndexes(database);
  const repository = dependencies.repository || new ResearchRepository(database, getResearchConfig());
  const now = dependencies.now || (() => new Date());
  const run = await repository.createCollectionRun({
    source: specification.source,
    collectorName: specification.collectorName,
    dryRun: input.dryRun,
    configurationSnapshot: {
      downloadUrl: specification.downloadUrl,
      maximumRecords: input.maximumRecords,
      maximumRowsScanned,
      batchSize,
      officialBulkDownload: true,
    },
  });
  if (!run._id) throw new Error("Collection run was created without an identifier");
  const runId = run._id as ObjectId;
  const report: OfficialBulkReport = {
    rowsScanned: 0, recordsAccepted: 0, recordsInserted: 0, wouldInsert: 0, duplicates: 0,
    skippedByReason: {}, failures: 0, geographyEvidence: {}, dryRun: input.dryRun,
    runStatus: "running", durationMs: 0, previews: [],
  };
  const pending: Record<string, unknown>[] = [];
  let unreportedSkipped = 0;
  let lastProgressLogged = 0;
  const targetProgress = () => report.recordsInserted + report.wouldInsert;
  const flushSkipped = async () => {
    if (!unreportedSkipped) return;
    await repository.incrementCollectionRunCounters(runId, {
      fetchedCount: unreportedSkipped, skippedCount: unreportedSkipped,
    });
    unreportedSkipped = 0;
  };
  const flush = async () => {
    const remaining = input.maximumRecords - targetProgress();
    if (remaining <= 0 || !pending.length) return;
    const chunk = pending.splice(0, Math.min(pending.length, remaining));
    const result = await repository.insertRawSignalsBatch(chunk, {
      collectionRunId: runId, dryRun: input.dryRun, concurrency: config.insertConcurrency,
      logIndividual: false,
    });
    report.recordsInserted += result.inserted;
    report.wouldInsert += result.wouldInsert;
    report.duplicates += result.duplicate;
    report.failures += result.failed;
    if (result.skipped) increment(report.skippedByReason, "validation", result.skipped);
    if (targetProgress() - lastProgressLogged >= 5_000 || targetProgress() >= input.maximumRecords) {
      lastProgressLogged = targetProgress();
      logResearchEvent("info", "official_bulk_collection_progress", {
        source: specification.source, rowsScanned: report.rowsScanned,
        inserted: report.recordsInserted, wouldInsert: report.wouldInsert,
        duplicates: report.duplicates, failures: report.failures,
      });
    }
  };

  logResearchEvent("info", "official_bulk_collection_started", {
    source: specification.source, maximumRecords: input.maximumRecords, dryRun: input.dryRun,
  });
  try {
    for await (const row of specification.rows()) {
      if (report.rowsScanned >= maximumRowsScanned || targetProgress() >= input.maximumRecords) break;
      report.rowsScanned += 1;
      const normalized = specification.normalize(row, now());
      if (!normalized.accepted) {
        increment(report.skippedByReason, normalized.reason);
        unreportedSkipped += 1;
        if (unreportedSkipped >= 1_000) await flushSkipped();
        continue;
      }
      report.recordsAccepted += 1;
      increment(report.geographyEvidence as Record<string, number>, normalized.geographyEvidence);
      pending.push(normalized.signal);
      if (input.includePreviews && report.previews.length < 5) report.previews.push({
        sourceId: String(normalized.signal.sourceId),
        title: String(normalized.signal.title || "").slice(0, 200),
        bodyPreview: String(normalized.signal.body || "").slice(0, 120),
      });
      if (pending.length >= batchSize) await flush();
    }
    while (pending.length && targetProgress() < input.maximumRecords) await flush();
    await flushSkipped();
    report.runStatus = report.failures ? "partially_completed" : "completed";
    await repository.completeCollectionRun(runId, report.runStatus);
    report.durationMs = Date.now() - startedAt;
    logResearchEvent("info", "official_bulk_collection_completed", {
      ...report, source: specification.source, previews: undefined,
    });
    return report;
  } catch (error) {
    await flushSkipped().catch(() => undefined);
    await repository.failCollectionRun(runId, error);
    logResearchEvent("error", "official_bulk_collection_failed", {
      source: specification.source, rowsScanned: report.rowsScanned, durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}
