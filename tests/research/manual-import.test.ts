import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { importManualJson } from "../../lib/research/collectors/manual-import.ts";
import { FakeResearchDb } from "./fake-db.ts";

test("manual import is idempotent and preserves run summaries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hush-research-"));
  const file = join(directory, "signals.json");
  await writeFile(
    file,
    JSON.stringify([
      {
        source: "manual_import",
        sourceId: "import-001",
        sourceUrl: "https://example.com/import-001",
        body: "A public problem signal for importer testing.",
        geographyEvidence: "us_context",
      },
    ]),
  );
  const fake = new FakeResearchDb();
  const first = await importManualJson({ file, batchSize: 1 }, fake.asDb());
  const second = await importManualJson({ file, batchSize: 1 }, fake.asDb());
  assert.equal(first.inserted, 1);
  assert.equal(second.duplicate, 1);
  assert.equal(fake.rawSignals.documents.length, 1);
  assert.equal(fake.collectionRuns.documents.length, 2);
  assert.equal(fake.collectionRuns.documents[1]?.duplicateCount, 1);
});
