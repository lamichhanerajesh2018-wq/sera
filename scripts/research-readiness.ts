import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { client, db } = await import("../lib/mongodb.ts");
  try {
    const { generateReadinessReport } = await import("../lib/research/quality/readiness.ts");
    const save = process.argv.includes("--save");
    const report = await generateReadinessReport(db, save);
    console.log(JSON.stringify(report, null, 2));
    if (report.status === "NOT_READY") process.exitCode = 1;
  } finally { await client.close(); }
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "readiness_error", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
