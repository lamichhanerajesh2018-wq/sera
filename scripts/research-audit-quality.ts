import { writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { client, db } = await import("../lib/mongodb.ts");
  try {
    const { auditQuality } = await import("../lib/research/quality/audit.ts");
    const { rowsToCsv } = await import("../lib/research/quality/service.ts");
    const report = await auditQuality(db);
    const formatIndex = process.argv.indexOf("--format");
    const format = formatIndex >= 0 ? process.argv[formatIndex + 1] : "json";
    const output = format === "csv"
      ? rowsToCsv(report.findings.map((finding) => ({ ...finding }) as Record<string, unknown>))
      : JSON.stringify(report, null, 2);
    const fileIndex = process.argv.indexOf("--file");
    if (fileIndex >= 0) await writeFile(process.argv[fileIndex + 1], output, { encoding: "utf8", flag: "wx" });
    else console.log(output);
    if (process.argv.includes("--strict") && report.totals.critical) process.exitCode = 1;
  } finally { await client.close(); }
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "quality_audit_error", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
