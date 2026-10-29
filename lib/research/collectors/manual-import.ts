import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Db } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import { getResearchConfig } from "../config.ts";
import { logResearchEvent } from "../logger.ts";
import { ensureResearchIndexes } from "../models.ts";
import { ResearchRepository } from "../repository.ts";
import type { BatchInsertResult } from "../types.ts";

export interface ManualImportOptions {
  file: string;
  dryRun?: boolean;
  batchSize?: number;
}

export interface ManualImportResult extends BatchInsertResult {
  fetched: number;
  runStatus: "completed" | "partially_completed";
  durationMs: number;
}

function mergeBatch(target: BatchInsertResult, batch: BatchInsertResult, offset: number): void {
  target.inserted += batch.inserted;
  target.duplicate += batch.duplicate;
  target.skipped += batch.skipped;
  target.failed += batch.failed;
  target.wouldInsert += batch.wouldInsert;
  target.errors.push(...batch.errors.map((error) => ({ ...error, index: error.index + offset })));
}

export async function importManualJson(
  options: ManualImportOptions,
  database: Db = defaultDb,
): Promise<ManualImportResult> {
  const started = Date.now();
  const config = getResearchConfig();
  const dryRun = options.dryRun ?? config.dryRun;
  const batchSize = options.batchSize ?? config.batchSize;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new Error("batchSize must be a positive integer");
  }
  if (!config.collectors.manual_import) {
    throw new Error("The manual_import collector is disabled by configuration");
  }

  const absoluteFile = resolve(options.file);
  const contents = await readFile(absoluteFile, "utf8");
  let records: unknown;
  try {
    records = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Invalid JSON in ${absoluteFile}: ${error instanceof Error ? error.message : error}`);
  }
  if (!Array.isArray(records)) throw new Error("Import file must contain a JSON array");

  await ensureResearchIndexes(database);
  const repository = new ResearchRepository(database, config);
  const run = await repository.createCollectionRun({
    source: "manual_import",
    collectorName: "manual_json_import",
    dryRun,
    configurationSnapshot: {
      batchSize,
      maximumBodyLength: config.maximumBodyLength,
      defaultLanguage: config.defaultLanguage,
      targetCountry: config.targetCountry,
      collectionConcurrency: config.collectionConcurrency,
      fileName: absoluteFile.split("/").at(-1),
    },
  });
  if (!run._id) throw new Error("Collection run was created without an identifier");

  logResearchEvent("info", "collection_run_started", {
    collectorName: run.collectorName,
    dryRun,
    fetchedCount: records.length,
  });

  const summary: BatchInsertResult = {
    inserted: 0,
    duplicate: 0,
    skipped: 0,
    failed: 0,
    wouldInsert: 0,
    errors: [],
  };
  try {
    for (let offset = 0; offset < records.length; offset += batchSize) {
      const batch = await repository.insertRawSignalsBatch(records.slice(offset, offset + batchSize), {
        collectionRunId: run._id,
        dryRun,
      });
      mergeBatch(summary, batch, offset);
    }
    const runStatus = summary.skipped || summary.failed ? "partially_completed" : "completed";
    await repository.completeCollectionRun(run._id, runStatus);
    const durationMs = Date.now() - started;
    logResearchEvent("info", "collection_run_completed", {
      status: runStatus,
      dryRun,
      fetchedCount: records.length,
      insertedCount: summary.inserted,
      wouldInsertCount: summary.wouldInsert,
      duplicateCount: summary.duplicate,
      skippedCount: summary.skipped,
      failedCount: summary.failed,
      durationMs,
    });
    return { ...summary, fetched: records.length, runStatus, durationMs };
  } catch (error) {
    await repository.failCollectionRun(run._id, error);
    logResearchEvent("error", "collection_run_failed", {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    });
    throw error;
  }
}
