import assert from "node:assert/strict";
import test from "node:test";
import { cfpbCsvRowToComplaint } from "../../lib/research/cfpb/bulk.ts";
import { normalizeCfpbComplaint } from "../../lib/research/cfpb/normalization.ts";
import { getBulkCollectorConfig } from "../../lib/research/config.ts";
import { collectOfficialBulkRows } from "../../lib/research/collectors/officialBulkCollector.ts";
import { normalizeNhtsaComplaint } from "../../lib/research/nhtsa/normalization.ts";
import { ResearchRepository } from "../../lib/research/repository.ts";
import { FakeResearchDb } from "./fake-db.ts";

const NOW = new Date("2026-07-13T00:00:00.000Z");

function config() {
  return getBulkCollectorConfig({
    RESEARCH_BULK_MAX_RECORDS_PER_RUN: "100",
    RESEARCH_BULK_MAX_ROWS_SCANNED_PER_RUN: "1000",
    RESEARCH_BULK_BATCH_SIZE: "2",
    RESEARCH_BULK_INSERT_CONCURRENCY: "1",
  });
}

function nhtsa(id: string, narrative = `Vehicle ${id} lost braking power while driving and required emergency towing.`) {
  return {
    CMPLID: id, ODINO: id, MFR_NAME: "Example Motors", MAKETXT: "EXAMPLE", MODELTXT: "SAFE",
    YEARTXT: "2025", CRASH: "N", FAILDATE: "20260601", FIRE: "N", INJURED: "0", DEATHS: "0",
    COMPDESC: "SERVICE BRAKES", STATE: "CA", LDATE: "20260602", MILES: "1000", OCCURRENCES: "1",
    CDESCR: narrative, CMPL_TYPE: "IVOQ", PROD_TYPE: "V", MEDICAL_ATTN: "N", VEHICLES_TOWED_YN: "Y",
    CITY: "Private City", VIN: "PRIVATEVIN", DEALER_TEL: "555-555-1212", DEALER_ZIP: "90210",
    VEHICLE_OPERATOR: "Private Person", STATE_OF_INCIDENT: "CA",
  };
}

async function* rows(items: Array<Record<string, string>>) {
  for (const item of items) yield item;
}

test("CFPB official CSV row maps into the existing privacy-safe normalizer", () => {
  const complaint = cfpbCsvRowToComplaint({
    "Complaint ID": "123", "Consumer complaint narrative": "The bank repeatedly charged an unexplained fee.",
    "Date received": "2026-06-01", Product: "Checking or savings account", Issue: "Managing an account",
    Company: "Example Bank", State: "CA", "ZIP code": "90210", "Submitted via": "Web",
  });
  const result = normalizeCfpbComplaint(complaint, NOW);
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.signal.sourceId, "123");
  assert.equal("zipCode" in (result.signal.metadata as Record<string, unknown>), false);
});

test("NHTSA mapping retains safety facts and discards VIN, city, phone, ZIP, and operator", () => {
  const result = normalizeNhtsaComplaint(nhtsa("1001"), NOW);
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.signal.source, "nhtsa");
  assert.equal(result.signal.geographyEvidence, "explicit_us");
  const serialized = JSON.stringify(result.signal);
  for (const privateValue of ["Private City", "PRIVATEVIN", "555-555-1212", "90210", "Private Person"]) {
    assert.equal(serialized.includes(privateValue), false);
  }
  assert.equal((result.signal.metadata as Record<string, unknown>).vehicleTowed, true);
});

test("NHTSA skips empty, malformed, and contact-bearing narratives", () => {
  assert.equal(normalizeNhtsaComplaint(nhtsa("1", ""), NOW).accepted, false);
  assert.equal(normalizeNhtsaComplaint(nhtsa("bad"), NOW).accepted, false);
  assert.deepEqual(normalizeNhtsaComplaint(nhtsa("2", "Email me at person@example.com about this brake failure."), NOW),
    { accepted: false, reason: "privacy_filter" });
});

test("official bulk collector is exact, dry-run safe, and reruns continue past duplicates", async () => {
  const fake = new FakeResearchDb();
  const repository = new ResearchRepository(fake.asDb());
  const specification = (items: Array<Record<string, string>>) => ({
    source: "nhtsa" as const, collectorName: "test_nhtsa", downloadUrl: "https://example.test/data.zip",
    rows: () => rows(items), normalize: normalizeNhtsaComplaint,
  });
  const dependencies = { database: fake.asDb(), repository, config: config(), now: () => NOW, ensureIndexes: false };
  const first = await collectOfficialBulkRows({ maximumRecords: 2, maximumRowsScanned: 10, batchSize: 2, dryRun: false },
    specification([nhtsa("1"), nhtsa("2"), nhtsa("3")]), dependencies);
  const rerun = await collectOfficialBulkRows({ maximumRecords: 1, maximumRowsScanned: 10, batchSize: 1, dryRun: false },
    specification([nhtsa("1"), nhtsa("2"), nhtsa("3")]), dependencies);
  const dryRun = await collectOfficialBulkRows({ maximumRecords: 1, maximumRowsScanned: 10, batchSize: 1, dryRun: true },
    specification([nhtsa("4")]), dependencies);
  assert.equal(first.recordsInserted, 2);
  assert.equal(rerun.recordsInserted, 1);
  assert.equal(rerun.duplicates, 2);
  assert.equal(rerun.rowsScanned, 3);
  assert.equal(dryRun.wouldInsert, 1);
  assert.equal(fake.rawSignals.documents.length, 3);
});
