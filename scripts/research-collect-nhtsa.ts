import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const values = new Map<string, string>();
const flags = new Set<string>();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index]!;
  if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
  const name = argument.slice(2);
  if (["dry-run", "safe-test"].includes(name)) { flags.add(name); continue; }
  if (!["limit", "max-rows", "batch-size"].includes(name)) throw new Error(`Unknown option: --${name}`);
  const value = process.argv[++index];
  if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
  values.set(name, value);
}
const numeric = (name: string) => values.has(name) ? Number(values.get(name)) : undefined;

async function main() {
  const { getBulkCollectorConfig } = await import("../lib/research/config.ts");
  const config = getBulkCollectorConfig();
  const safeTest = flags.has("safe-test");
  const { collectNhtsaComplaints } = await import("../lib/research/collectors/nhtsaCollector.ts");
  const { client } = await import("../lib/mongodb.ts");
  try {
    const report = await collectNhtsaComplaints({
      maximumRecords: safeTest ? 5 : numeric("limit") || config.maximumRecordsPerRun,
      maximumRowsScanned: safeTest ? 500 : numeric("max-rows"),
      batchSize: safeTest ? 5 : numeric("batch-size"),
      dryRun: safeTest || flags.has("dry-run") || config.nhtsaDryRun,
      includePreviews: safeTest,
    });
    console.log(JSON.stringify({ event: "nhtsa_collection_report", ...report }, null, 2));
    if (report.failures) process.exitCode = 1;
  } finally { await client.close(); }
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "nhtsa_collection_error", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
