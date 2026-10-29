import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { client, db } = await import("../lib/mongodb.ts");
  try {
    const { ensureResearchIndexes } = await import("../lib/research/models.ts");
    await ensureResearchIndexes(db);
    console.log(JSON.stringify({ event: "research_indexes_ready", database: db.databaseName }));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: "research_indexes_error",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
