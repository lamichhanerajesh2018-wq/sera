import type { Db, ObjectId } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import { getCfpbConfig, getResearchConfig, type CfpbConfig } from "../config.ts";
import { CfpbApiClient, CfpbApiError } from "../cfpb/client.ts";
import { normalizeCfpbComplaint, type CfpbSkipReason } from "../cfpb/normalization.ts";
import { logResearchEvent } from "../logger.ts";
import { ensureResearchIndexes } from "../models.ts";
import { normalizeWhitespace } from "../normalization.ts";
import { ResearchRepository } from "../repository.ts";
import type { CollectionRunStatus, GeographyEvidence } from "../types.ts";

const ABSOLUTE_PILOT_LIMIT = 500;
const API_PAGE_LIMIT = 100;

export interface CfpbCollectorOptions {
  dateReceivedMin?: string;
  dateReceivedMax?: string;
  products?: string[];
  maximumRecords?: number;
  pageSize?: number;
  maximumRequests?: number;
  dryRun?: boolean;
  includePreviews?: boolean;
}

export interface CfpbCollectorReport {
  pagesFetched: number;
  apiRequestsMade: number;
  totalMatchingRecords: number;
  recordsFetched: number;
  recordsAccepted: number;
  recordsInserted: number;
  wouldInsert: number;
  duplicates: number;
  skippedByReason: Partial<Record<CfpbSkipReason | "validation", number>>;
  failures: number;
  geographyEvidence: Partial<Record<GeographyEvidence, number>>;
  dataStale: boolean;
  narrativeStale: boolean;
  lastUpdated?: string;
  dryRun: boolean;
  runStatus: CollectionRunStatus;
  durationMs: number;
  previews: Array<{ sourceId: string; title: string; bodyPreview: string; geographyEvidence: GeographyEvidence }>;
}

interface CollectorDependencies {
  database?: Db;
  repository?: ResearchRepository;
  client?: CfpbApiClient;
  cfpbConfig?: CfpbConfig;
  now?: () => Date;
  ensureIndexes?: boolean;
}

function dateFilter(value: string | undefined, name: string) {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`${name} must be a valid YYYY-MM-DD date`);
  }
  return value;
}

function increment<T extends string>(values: Partial<Record<T, number>>, key: T, amount = 1) {
  values[key] = (values[key] || 0) + amount;
}

export function validateCfpbCollectorOptions(
  input: CfpbCollectorOptions,
  config: CfpbConfig = getCfpbConfig(),
) {
  if (!config.enabled) throw new Error("CFPB collection is disabled. Set RESEARCH_COLLECTOR_CFPB_ENABLED=true.");
  const dateReceivedMin = dateFilter(input.dateReceivedMin, "dateReceivedMin");
  const dateReceivedMax = dateFilter(input.dateReceivedMax, "dateReceivedMax");
  if (dateReceivedMin && dateReceivedMax && dateReceivedMin >= dateReceivedMax) {
    throw new Error("dateReceivedMin must be earlier than dateReceivedMax");
  }
  const products = [...new Set((input.products || []).map(normalizeWhitespace).filter(Boolean))];
  if (products.length > 20) throw new Error("At most 20 CFPB product filters are allowed");
  if (products.some((product) => Array.from(product).length > 200)) throw new Error("CFPB product filters are too long");
  const configuredMaximum = Math.min(config.maximumRecordsPerRun, ABSOLUTE_PILOT_LIMIT);
  const maximumRecords = input.maximumRecords ?? configuredMaximum;
  if (!Number.isSafeInteger(maximumRecords) || maximumRecords < 1 || maximumRecords > configuredMaximum) {
    throw new Error(`maximumRecords must be between 1 and ${configuredMaximum}`);
  }
  const pageSize = input.pageSize ?? Math.min(config.pageSize, maximumRecords);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > API_PAGE_LIMIT) {
    throw new Error(`pageSize must be between 1 and ${API_PAGE_LIMIT}`);
  }
  const maximumRequests = input.maximumRequests ?? config.maximumRequestsPerRun;
  if (!Number.isSafeInteger(maximumRequests) || maximumRequests < 1 || maximumRequests > config.maximumRequestsPerRun) {
    throw new Error(`maximumRequests must be between 1 and ${config.maximumRequestsPerRun}`);
  }
  if (Math.ceil(maximumRecords / pageSize) > maximumRequests) {
    throw new Error("Record and page limits exceed the CFPB request ceiling");
  }
  return {
    ...(dateReceivedMin && { dateReceivedMin }),
    ...(dateReceivedMax && { dateReceivedMax }),
    products,
    maximumRecords,
    pageSize,
    maximumRequests,
    dryRun: input.dryRun ?? config.dryRun,
    includePreviews: Boolean(input.includePreviews),
  };
}

export async function collectCfpbComplaints(
  input: CfpbCollectorOptions,
  dependencies: CollectorDependencies = {},
): Promise<CfpbCollectorReport> {
  const startedAt = Date.now();
  const config = dependencies.cfpbConfig || getCfpbConfig();
  const options = validateCfpbCollectorOptions(input, config);
  const database = dependencies.database || defaultDb;
  if (dependencies.ensureIndexes !== false) await ensureResearchIndexes(database);
  const repository = dependencies.repository || new ResearchRepository(database, getResearchConfig());
  const client = dependencies.client || new CfpbApiClient(config, options.maximumRequests);
  const now = dependencies.now || (() => new Date());
  const run = await repository.createCollectionRun({
    source: "cfpb",
    collectorName: "cfpb_consumer_complaint_api",
    ...(options.products.length === 1 && { industrySeed: options.products[0] }),
    dryRun: options.dryRun,
    configurationSnapshot: {
      dateReceivedMin: options.dateReceivedMin,
      dateReceivedMax: options.dateReceivedMax,
      products: options.products,
      maximumRecords: options.maximumRecords,
      pageSize: options.pageSize,
      maximumRequests: options.maximumRequests,
      narrativesOnly: true,
      apiBaseUrl: config.apiBaseUrl,
    },
  });
  if (!run._id) throw new Error("CFPB collection run was created without an identifier");
  const runId = run._id as ObjectId;
  const skippedByReason: CfpbCollectorReport["skippedByReason"] = {};
  const geographyEvidence: CfpbCollectorReport["geographyEvidence"] = {};
  const previews: CfpbCollectorReport["previews"] = [];
  let pagesFetched = 0;
  let totalMatchingRecords = 0;
  let recordsFetched = 0;
  let recordsAccepted = 0;
  let recordsInserted = 0;
  let wouldInsert = 0;
  let duplicates = 0;
  let failures = 0;
  let dataStale = false;
  let narrativeStale = false;
  let lastUpdated: string | undefined;

  logResearchEvent("info", "cfpb_collection_started", {
    products: options.products, maximumRecords: options.maximumRecords,
    pageSize: options.pageSize, dryRun: options.dryRun,
  });
  try {
    let offset = 0;
    let pageNumber = 1;
    let searchAfter: string | undefined;
    while (recordsFetched < options.maximumRecords) {
      // CFPB's search_after cursor is tied to the original page size. Keep it
      // stable across a run and trim the final response locally.
      const requestedSize = options.pageSize;
      const page = await client.fetchPage({
        offset, size: requestedSize, page: pageNumber, searchAfter,
        dateReceivedMin: options.dateReceivedMin,
        dateReceivedMax: options.dateReceivedMax,
        products: options.products,
      });
      pagesFetched += 1;
      totalMatchingRecords = page.total;
      dataStale ||= page.dataStale;
      narrativeStale ||= page.narrativeStale;
      lastUpdated = page.lastUpdated || lastUpdated;
      const remaining = options.maximumRecords - recordsFetched;
      const fetchedRecords = page.records.slice(0, remaining);
      recordsFetched += fetchedRecords.length;
      const signals: Record<string, unknown>[] = [];
      let prefiltered = 0;
      for (const record of fetchedRecords) {
        const normalized = normalizeCfpbComplaint(record, now());
        if (!normalized.accepted) {
          increment(skippedByReason, normalized.reason);
          prefiltered += 1;
          continue;
        }
        recordsAccepted += 1;
        increment(geographyEvidence, normalized.geographyEvidence);
        signals.push(normalized.signal);
        if (options.includePreviews && previews.length < 5) previews.push({
          sourceId: String(normalized.signal.sourceId),
          title: String(normalized.signal.title).slice(0, 200),
          bodyPreview: String(normalized.signal.body).slice(0, 120),
          geographyEvidence: normalized.geographyEvidence,
        });
      }
      if (prefiltered) await repository.incrementCollectionRunCounters(runId, {
        fetchedCount: prefiltered, skippedCount: prefiltered,
      });
      if (signals.length) {
        const batch = await repository.insertRawSignalsBatch(signals, {
          collectionRunId: runId, dryRun: options.dryRun, concurrency: config.insertConcurrency,
        });
        recordsInserted += batch.inserted;
        wouldInsert += batch.wouldInsert;
        duplicates += batch.duplicate;
        failures += batch.failed;
        if (batch.skipped) increment(skippedByReason, "validation", batch.skipped);
      }
      if (!page.records.length || page.records.length < requestedSize || recordsFetched >= page.total) break;
      if (!page.nextSearchAfter) {
        throw new CfpbApiError("CFPB response omitted the required pagination cursor", "server");
      }
      offset += page.records.length;
      pageNumber += 1;
      searchAfter = page.nextSearchAfter;
    }
    const runStatus: CollectionRunStatus = failures ? "partially_completed" : "completed";
    await repository.completeCollectionRun(runId, runStatus);
    const report: CfpbCollectorReport = {
      pagesFetched, apiRequestsMade: client.requestCount, totalMatchingRecords, recordsFetched,
      recordsAccepted, recordsInserted, wouldInsert, duplicates, skippedByReason, failures,
      geographyEvidence, dataStale, narrativeStale, ...(lastUpdated && { lastUpdated }),
      dryRun: options.dryRun, runStatus, durationMs: Date.now() - startedAt, previews,
    };
    logResearchEvent("info", "cfpb_collection_completed", { ...report, previews: undefined });
    return report;
  } catch (error) {
    await repository.failCollectionRun(runId, error);
    logResearchEvent("error", "cfpb_collection_failed", {
      category: error instanceof CfpbApiError ? error.category : "unknown",
      status: error instanceof CfpbApiError ? error.status : undefined,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}
