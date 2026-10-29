import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function argument(name: string): string | undefined {
  const direct = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const file = argument("file");
if (!file) {
  console.error("Usage: npm run research:import -- --file ./data/research/sample-signals.json [--dry-run] [--batch-size 100]");
  process.exit(1);
}
const importFile = file;

const batchSizeValue = argument("batch-size");
const batchSize = batchSizeValue === undefined ? undefined : Number(batchSizeValue);

async function main() {
  const { importManualJson } = await import("../lib/research/collectors/manual-import.ts");
  const { client } = await import("../lib/mongodb.ts");
  try {
    const result = await importManualJson({ file: importFile, dryRun: hasFlag("dry-run"), batchSize });
    console.log(JSON.stringify({ event: "manual_import_summary", ...result }, null, 2));
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: "manual_import_error",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
