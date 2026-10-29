import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "mongodb";
import { ResearchRepository } from "../../lib/research/repository.ts";
import { FakeResearchDb } from "./fake-db.ts";

function signal(sourceId: string, body = `Problem described by ${sourceId}`) {
  return {
    source: "manual_import",
    sourceId,
    sourceUrl: `https://example.com/${sourceId}`,
    body,
    targetCountry: "united_states",
    geographyEvidence: "us_context",
  };
}

test("duplicate detection covers source ID and normalized content hash", async () => {
  const fake = new FakeResearchDb();
  const repository = new ResearchRepository(fake.asDb());
  assert.equal((await repository.insertRawSignal(signal("one"))).status, "inserted");
  assert.equal((await repository.insertRawSignal(signal("one", "Different body"))).status, "duplicate");
  assert.equal((await repository.insertRawSignal(signal("two", "Problem described by one"))).status, "duplicate");
});

test("batch insertion is idempotent and skips invalid records independently", async () => {
  const fake = new FakeResearchDb();
  const repository = new ResearchRepository(fake.asDb());
  const input = [signal("one"), signal("two"), signal("invalid", "!!!")];
  const first = await repository.insertRawSignalsBatch(input);
  assert.deepEqual(
    { inserted: first.inserted, duplicate: first.duplicate, skipped: first.skipped, failed: first.failed },
    { inserted: 2, duplicate: 0, skipped: 1, failed: 0 },
  );
  const second = await repository.insertRawSignalsBatch(input);
  assert.deepEqual(
    { inserted: second.inserted, duplicate: second.duplicate, skipped: second.skipped, failed: second.failed },
    { inserted: 0, duplicate: 2, skipped: 1, failed: 0 },
  );
});

test("batch insertion records collection run counters", async () => {
  const fake = new FakeResearchDb();
  const repository = new ResearchRepository(fake.asDb());
  const run = await repository.createCollectionRun({
    source: "manual_import",
    collectorName: "test",
  });
  await repository.insertRawSignalsBatch([signal("one"), signal("bad", "---")], {
    collectionRunId: run._id,
  });
  const storedRun = fake.collectionRuns.documents[0];
  assert.equal(storedRun.fetchedCount, 2);
  assert.equal(storedRun.insertedCount, 1);
  assert.equal(storedRun.skippedCount, 1);
  await repository.completeCollectionRun(run._id as ObjectId, "partially_completed");
  assert.equal(storedRun.status, "partially_completed");
  assert.ok(storedRun.completedAt instanceof Date);
});

test("database failure does not crash the rest of a batch", async () => {
  const fake = new FakeResearchDb();
  fake.rawSignals.failSourceId = "db-fail";
  const repository = new ResearchRepository(fake.asDb());
  const result = await repository.insertRawSignalsBatch([signal("db-fail"), signal("survives")]);
  assert.equal(result.failed, 1);
  assert.equal(result.inserted, 1);
  assert.match(result.errors[0]?.message || "", /simulated database failure/);
});

test("dry run reports would-insert without writing signals", async () => {
  const fake = new FakeResearchDb();
  const repository = new ResearchRepository(fake.asDb());
  const result = await repository.insertRawSignalsBatch([signal("dry")], { dryRun: true });
  assert.equal(result.wouldInsert, 1);
  assert.equal(fake.rawSignals.documents.length, 0);
});
