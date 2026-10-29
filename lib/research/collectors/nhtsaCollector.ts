import { streamZipDelimitedRows } from "../bulk/download.ts";
import { getBulkCollectorConfig, type BulkCollectorConfig } from "../config.ts";
import { NHTSA_COLUMNS, normalizeNhtsaComplaint } from "../nhtsa/normalization.ts";
import { collectOfficialBulkRows, type OfficialBulkOptions } from "./officialBulkCollector.ts";

export function collectNhtsaComplaints(
  input: OfficialBulkOptions,
  dependencies: { config?: BulkCollectorConfig; rows?: () => AsyncIterable<Record<string, string>> } = {},
) {
  const config = dependencies.config || getBulkCollectorConfig();
  return collectOfficialBulkRows(input, {
    source: "nhtsa",
    collectorName: "nhtsa_official_complaint_bulk",
    downloadUrl: config.nhtsaDownloadUrl,
    rows: dependencies.rows || (() => streamZipDelimitedRows({
      url: config.nhtsaDownloadUrl, entryPattern: /(?:FLAT_CMPL|complaints[^/]*)\.(?:txt|csv)$/i,
      delimiter: "\t", columns: [...NHTSA_COLUMNS], userAgent: config.userAgent,
      requestTimeoutMs: config.requestTimeoutMs,
    })),
    normalize: normalizeNhtsaComplaint,
  }, { config });
}
