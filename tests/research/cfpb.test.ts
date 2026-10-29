import assert from "node:assert/strict";
import test from "node:test";
import { CfpbApiClient, type CfpbComplaint, type CfpbPage } from "../../lib/research/cfpb/client.ts";
import { normalizeCfpbComplaint } from "../../lib/research/cfpb/normalization.ts";
import { collectCfpbComplaints, validateCfpbCollectorOptions } from "../../lib/research/collectors/cfpbCollector.ts";
import { getCfpbConfig } from "../../lib/research/config.ts";
import { ResearchRepository } from "../../lib/research/repository.ts";
import { FakeResearchDb } from "./fake-db.ts";

const NOW = new Date("2026-07-13T00:00:00.000Z");

function config() {
  return getCfpbConfig({
    RESEARCH_COLLECTOR_CFPB_ENABLED: "true",
    CFPB_PAGE_SIZE: "2",
    CFPB_MAX_RECORDS_PER_RUN: "10",
    CFPB_MAX_REQUESTS_PER_RUN: "10",
    CFPB_RETRY_LIMIT: "1",
    CFPB_RETRY_BASE_DELAY_MS: "1",
  });
}

function complaint(overrides: CfpbComplaint = {}): CfpbComplaint {
  return {
    complaint_id: 123456,
    complaint_what_happened: "The lender repeatedly charged a fee after confirming that the account was closed.",
    date_received: "2026-07-01",
    product: "Checking or savings account",
    sub_product: "Checking account",
    issue: "Managing an account",
    sub_issue: "Fee problem",
    company: "Example Financial Company",
    state: "CA",
    submitted_via: "Web",
    company_response: "Closed with explanation",
    company_public_response: "Company believes it acted appropriately",
    zip_code: "90210",
    ...overrides,
  };
}

function mockClient(handler: (offset: number, size: number) => Promise<CfpbPage>) {
  let requests = 0;
  return {
    get requestCount() { return requests; },
    async fetchPage({ offset, size }: { offset: number; size: number }) {
      requests += 1;
      return handler(offset, size);
    },
  } as CfpbApiClient;
}

function dependencies(fake: FakeResearchDb, client: CfpbApiClient) {
  return {
    database: fake.asDb(), repository: new ResearchRepository(fake.asDb()), client,
    cfpbConfig: config(), now: () => NOW, ensureIndexes: false,
  };
}

test("CFPB option validation enforces strict pilot, page, request, date, and product limits", () => {
  const valid = validateCfpbCollectorOptions({ maximumRecords: 5, pageSize: 5, maximumRequests: 1 }, config());
  assert.equal(valid.maximumRecords, 5);
  assert.throws(() => validateCfpbCollectorOptions({ maximumRecords: 501 }, config()), /maximumRecords/);
  assert.throws(() => validateCfpbCollectorOptions({ maximumRecords: 10, pageSize: 2, maximumRequests: 4 }, config()), /request ceiling/);
  assert.throws(() => validateCfpbCollectorOptions({ dateReceivedMin: "2026-08-01", dateReceivedMax: "2026-07-01" }, config()), /earlier/);
});

test("CFPB field mapping is explicit-US, omits ZIP and authors, and retains only approved metadata", () => {
  const result = normalizeCfpbComplaint(complaint(), NOW);
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.signal.source, "cfpb");
  assert.equal(result.signal.sourceId, "123456");
  assert.equal(result.signal.title, "Checking or savings account — Managing an account");
  assert.equal(result.signal.publishedAt, "2026-07-01T00:00:00.000Z");
  assert.equal(result.signal.geographyEvidence, "explicit_us");
  assert.equal((result.signal.metadata as Record<string, unknown>).state, "CA");
  assert.equal("zipCode" in (result.signal.metadata as Record<string, unknown>), false);
  assert.equal("zip_code" in (result.signal.metadata as Record<string, unknown>), false);
  assert.equal("authorName" in result.signal, false);
});

test("CFPB mapping uses US context without a valid state", () => {
  const result = normalizeCfpbComplaint(complaint({ state: "" }), NOW);
  assert.equal(result.accepted && result.geographyEvidence, "us_context");
});

test("CFPB mapping accepts the API's ISO date_received representation", () => {
  const result = normalizeCfpbComplaint(complaint({ date_received: "2026-06-23T01:35:23.000Z" }), NOW);
  assert.equal(result.accepted && result.signal.publishedAt, "2026-06-23T01:35:23.000Z");
});

test("missing narratives, malformed records, and residual contact information are filtered", () => {
  assert.deepEqual(normalizeCfpbComplaint(complaint({ complaint_what_happened: "  " }), NOW), { accepted: false, reason: "missing_narrative" });
  assert.deepEqual(normalizeCfpbComplaint(complaint({ complaint_id: "not-an-id" }), NOW), { accepted: false, reason: "malformed_record" });
  assert.deepEqual(normalizeCfpbComplaint(complaint({ complaint_what_happened: "Contact me at person@example.com about this fee." }), NOW), { accepted: false, reason: "privacy_filter" });
});

test("CFPB collector paginates up to the bounded record limit", async () => {
  const fake = new FakeResearchDb();
  const requestedSizes: number[] = [];
  const client = mockClient(async (offset, size) => {
    requestedSizes.push(size);
    return ({
    records: offset === 0
      ? [complaint(), complaint({ complaint_id: 123457, complaint_what_happened: "The bank delayed a transfer for several weeks without explaining the hold." })]
      : [complaint({ complaint_id: 123458, complaint_what_happened: "The company continued collection attempts after confirming that the debt was disputed." })],
    total: 3, dataStale: false, narrativeStale: false, lastUpdated: "2026-07-12T00:00:00Z",
    ...(offset === 0 && { nextSearchAfter: "cursor-for-page-2" }),
    });
  });
  const report = await collectCfpbComplaints({ maximumRecords: 3, pageSize: 2, maximumRequests: 2, dryRun: false }, dependencies(fake, client));
  assert.equal(report.pagesFetched, 2);
  assert.equal(report.recordsFetched, 3);
  assert.equal(report.recordsInserted, 3);
  assert.deepEqual(requestedSizes, [2, 2]);
  assert.equal(fake.rawSignals.documents.length, 3);
  assert.equal(fake.collectionRuns.documents[0]?.fetchedCount, 3);
});

test("CFPB collector reports malformed and private rows independently", async () => {
  const fake = new FakeResearchDb();
  const client = mockClient(async () => ({
    records: [
      complaint({ complaint_what_happened: "" }),
      complaint({ complaint_id: undefined }),
      complaint({ complaint_id: 99, complaint_what_happened: "Please call 415-555-1212 about the account." }),
      complaint(),
    ],
    total: 4, dataStale: true, narrativeStale: true,
  }));
  const report = await collectCfpbComplaints({ maximumRecords: 4, pageSize: 4, maximumRequests: 1, dryRun: false }, dependencies(fake, client));
  assert.deepEqual(report.skippedByReason, { missing_narrative: 1, malformed_record: 1, privacy_filter: 1 });
  assert.equal(report.recordsInserted, 1);
  assert.equal(report.dataStale, true);
  assert.equal(report.narrativeStale, true);
});

test("CFPB dry run returns safe previews without writing raw signals", async () => {
  const fake = new FakeResearchDb();
  const client = mockClient(async () => ({ records: [complaint()], total: 1, dataStale: false, narrativeStale: false }));
  const report = await collectCfpbComplaints({ maximumRecords: 1, pageSize: 1, maximumRequests: 1, dryRun: true, includePreviews: true }, dependencies(fake, client));
  assert.equal(report.wouldInsert, 1);
  assert.equal(report.recordsInserted, 0);
  assert.equal(fake.rawSignals.documents.length, 0);
  assert.equal("company" in report.previews[0]!, false);
  assert.ok(report.previews[0]!.bodyPreview.length <= 120);
});

test("CFPB duplicates and idempotent reruns reuse repository safeguards", async () => {
  const fake = new FakeResearchDb();
  const first = await collectCfpbComplaints({ maximumRecords: 1, pageSize: 1, maximumRequests: 1, dryRun: false }, dependencies(fake,
    mockClient(async () => ({ records: [complaint()], total: 1, dataStale: false, narrativeStale: false }))));
  const second = await collectCfpbComplaints({ maximumRecords: 1, pageSize: 1, maximumRequests: 1, dryRun: false }, dependencies(fake,
    mockClient(async () => ({ records: [complaint()], total: 1, dataStale: false, narrativeStale: false }))));
  const contentDuplicate = await collectCfpbComplaints({ maximumRecords: 1, pageSize: 1, maximumRequests: 1, dryRun: false }, dependencies(fake,
    mockClient(async () => ({ records: [complaint({ complaint_id: 999999 })], total: 1, dataStale: false, narrativeStale: false }))));
  assert.equal(first.recordsInserted, 1);
  assert.equal(second.duplicates, 1);
  assert.equal(contentDuplicate.duplicates, 1);
  assert.equal(fake.rawSignals.documents.length, 1);
});

test("CFPB API client builds official pagination/filter parameters and retries transient failures", async () => {
  const urls: string[] = [];
  let calls = 0;
  const client = new CfpbApiClient(config(), 2, {
    sleep: async () => undefined,
    fetch: async (input) => {
      urls.push(String(input));
      calls += 1;
      if (calls === 1) return new Response("temporary", { status: 503 });
      return new Response(JSON.stringify({
        _meta: { is_data_stale: false, is_narrative_stale: false, break_points: { "3": [12345, "67890"] } },
        hits: { total: { value: 1, relation: "eq" }, hits: [{ _source: complaint() }] },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const page = await client.fetchPage({ offset: 2, size: 1, page: 2, searchAfter: "111_222", dateReceivedMin: "2026-01-01", products: ["Mortgage", "Debt collection"] });
  const url = new URL(urls.at(-1)!);
  assert.equal(url.searchParams.get("frm"), "2");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("search_after"), "111_222");
  assert.equal(url.searchParams.get("has_narrative"), "true");
  assert.deepEqual(url.searchParams.getAll("product"), ["Mortgage", "Debt collection"]);
  assert.equal(page.records.length, 1);
  assert.equal(page.nextSearchAfter, "12345_67890");
  assert.equal(client.requestCount, 2);
});
