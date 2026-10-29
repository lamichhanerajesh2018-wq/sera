import { streamZipDelimitedRows } from "../bulk/download.ts";
import { cfpbCsvRowToComplaint } from "../cfpb/bulk.ts";
import { normalizeCfpbComplaint } from "../cfpb/normalization.ts";
import { getBulkCollectorConfig, type BulkCollectorConfig } from "../config.ts";
import { collectOfficialBulkRows, type OfficialBulkOptions } from "./officialBulkCollector.ts";

export function collectCfpbBulk(
  input: OfficialBulkOptions,
  dependencies: { config?: BulkCollectorConfig; rows?: () => AsyncIterable<Record<string, string>> } = {},
) {
  const config = dependencies.config || getBulkCollectorConfig();
  return collectOfficialBulkRows(input, {
    source: "cfpb",
    collectorName: "cfpb_official_csv_bulk",
    downloadUrl: config.cfpbDownloadUrl,
    rows: dependencies.rows || (() => streamZipDelimitedRows({
      url: config.cfpbDownloadUrl, entryPattern: /complaints\.csv$/i, delimiter: ",", columns: true,
      userAgent: config.userAgent, requestTimeoutMs: config.requestTimeoutMs,
    })),
    normalize: (row, now) => normalizeCfpbComplaint(cfpbCsvRowToComplaint(row), now),
  }, { config });
}
