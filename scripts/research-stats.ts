import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { client, db } = await import("../lib/mongodb.ts");
  try {
    const { ResearchRepository } = await import("../lib/research/repository.ts");
    const stats = await new ResearchRepository(db).getResearchStats();
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: "research_stats_error",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
