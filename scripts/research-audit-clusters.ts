import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const index = process.argv.indexOf("--limit");
  const limit = Number(index >= 0 ? process.argv[index + 1] : 10);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new Error("--limit must be between 1 and 50");
  const { client, db } = await import("../lib/mongodb.ts");
  try {
    const { auditClusters } = await import("../lib/research/quality/audit.ts");
    console.log(JSON.stringify(await auditClusters(db, limit), null, 2));
  } finally { await client.close(); }
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "cluster_audit_error", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
