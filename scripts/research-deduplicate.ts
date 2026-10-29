import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const HELP = `Usage: npm run research:deduplicate -- [options]

Options:
  --limit NUMBER
  --batch-size NUMBER
  --concurrency NUMBER
  --source SOURCE
  --community NAME
  --industry NAME
  --min-confidence NUMBER
  --candidate-limit NUMBER
  --min-similarity NUMBER
  --max-cost NUMBER
  --dry-run
  --help`;

const valueFlags = new Set([
  "limit", "batch-size", "concurrency", "source", "community", "industry",
  "min-confidence", "candidate-limit", "min-similarity", "max-cost",
]);
const booleanFlags = new Set(["dry-run", "help", "safe-test", "retry-failed"]);

function parseArgs() {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const equals = argument.indexOf("=");
    const name = argument.slice(2, equals >= 0 ? equals : undefined);
    const inline = equals >= 0 ? argument.slice(equals + 1) : undefined;
    if (booleanFlags.has(name)) {
      if (inline !== undefined) throw new Error(`--${name} does not accept a value`);
      flags.add(name);
      continue;
    }
    if (!valueFlags.has(name)) throw new Error(`Unknown option: --${name}`);
    const value = inline ?? process.argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, value);
  }
  return { values, flags };
}

function numberValue(values: Map<string, string>, name: string) {
  const raw = values.get(name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`--${name} must be numeric`);
  return value;
}

async function main() {
  const parsed = parseArgs();
  if (parsed.flags.has("help")) { console.log(HELP); return; }
  const { getDeduplicationConfig, requireDeduplicationConfiguration } = await import("../lib/research/config.ts");
  const config = getDeduplicationConfig();
  requireDeduplicationConfiguration(config);
  const safeTest = parsed.flags.has("safe-test");
  const { RESEARCH_SOURCES } = await import("../lib/research/types.ts");
  const source = parsed.values.get("source");
  if (source && !RESEARCH_SOURCES.includes(source as never)) throw new Error(`Unsupported source: ${source}`);
  const { runDeduplicationPipeline } = await import("../lib/research/deduplication/service.ts");
  const { client } = await import("../lib/mongodb.ts");
  try {
    const report = await runDeduplicationPipeline({
      limit: safeTest ? Math.min(3, config.maximumRecordsPerRun) : numberValue(parsed.values, "limit"),
      batchSize: numberValue(parsed.values, "batch-size"),
      concurrency: safeTest ? 1 : numberValue(parsed.values, "concurrency"),
      source: source as (typeof RESEARCH_SOURCES)[number] | undefined,
      community: parsed.values.get("community"),
      industry: parsed.values.get("industry"),
      minimumConfidence: numberValue(parsed.values, "min-confidence"),
      candidateLimit: numberValue(parsed.values, "candidate-limit"),
      minimumSimilarity: numberValue(parsed.values, "min-similarity"),
      maximumCost: numberValue(parsed.values, "max-cost"),
      dryRun: safeTest || parsed.flags.has("dry-run") || config.dryRun,
      retryFailed: parsed.flags.has("retry-failed"),
    });
    const safeReport = { ...report };
    delete safeReport.runId;
    console.log(JSON.stringify({ event: "deduplication_report", ...safeReport }, null, 2));
    if (report.failed) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: "deduplication_error", error: error instanceof Error ? error.message : String(error),
  }));
  console.error(HELP);
  process.exitCode = 1;
});
