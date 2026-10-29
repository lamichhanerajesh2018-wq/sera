import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const HELP = `Usage: npm run research:collect:cfpb -- [options]

Options:
  --date-min YYYY-MM-DD       Inclusive received-date lower bound
  --date-max YYYY-MM-DD       Exclusive received-date upper bound
  --product NAME              Repeatable CFPB product filter
  --limit NUMBER              Maximum records (absolute pilot ceiling: 500)
  --page-size NUMBER          API page size (maximum 100)
  --max-requests NUMBER       Hard request-attempt ceiling
  --dry-run                   Validate and deduplicate without inserting signals
  --help                      Show this help`;

function parseArgs() {
  const values = new Map<string, string[]>();
  const flags = new Set<string>();
  const valueFlags = new Set(["date-min", "date-max", "product", "limit", "page-size", "max-requests"]);
  const booleanFlags = new Set(["dry-run", "help", "safe-test"]);
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const equals = argument.indexOf("=");
    const name = argument.slice(2, equals >= 0 ? equals : undefined);
    const inline = equals >= 0 ? argument.slice(equals + 1) : undefined;
    if (booleanFlags.has(name)) { flags.add(name); continue; }
    if (!valueFlags.has(name)) throw new Error(`Unknown option: --${name}`);
    const value = inline ?? process.argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, [...(values.get(name) || []), value]);
  }
  return { values, flags };
}

function numeric(values: Map<string, string[]>, name: string) {
  const raw = values.get(name)?.at(-1);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`--${name} must be an integer`);
  return value;
}

async function main() {
  const { values, flags } = parseArgs();
  if (flags.has("help")) { console.log(HELP); return; }
  const { getCfpbConfig } = await import("../lib/research/config.ts");
  const config = getCfpbConfig();
  const safeTest = flags.has("safe-test");
  const { collectCfpbComplaints } = await import("../lib/research/collectors/cfpbCollector.ts");
  const { client } = await import("../lib/mongodb.ts");
  try {
    const report = await collectCfpbComplaints({
      dateReceivedMin: values.get("date-min")?.at(-1),
      dateReceivedMax: values.get("date-max")?.at(-1),
      products: values.get("product") || [],
      maximumRecords: safeTest ? 5 : numeric(values, "limit"),
      pageSize: safeTest ? 5 : numeric(values, "page-size"),
      maximumRequests: safeTest ? Math.min(config.maximumRequestsPerRun, config.retryLimit + 1) : numeric(values, "max-requests"),
      dryRun: safeTest || flags.has("dry-run") || config.dryRun,
      includePreviews: safeTest,
    });
    console.log(JSON.stringify({ event: "cfpb_collection_report", ...report }, null, 2));
    if (report.failures) process.exitCode = 1;
  } finally { await client.close(); }
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "cfpb_collection_error", error: error instanceof Error ? error.message : String(error) }));
  console.error(HELP);
  process.exitCode = 1;
});
