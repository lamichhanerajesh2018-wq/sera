import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function limitArgument() {
  const index = process.argv.indexOf("--limit");
  const inline = process.argv.find((argument) => argument.startsWith("--limit="));
  const value = Number(inline?.slice(8) ?? (index >= 0 ? process.argv[index + 1] : "10"));
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) throw new Error("--limit must be between 1 and 50");
  return value;
}

async function main() {
  const { client, db } = await import("../lib/mongodb.ts");
  try {
    const { DeduplicationRepository } = await import("../lib/research/deduplication/repository.ts");
    const rows = await new DeduplicationRepository(db).inspectUniqueProblems(limitArgument());
    console.log(JSON.stringify({ totalShown: rows.length, sample: rows.map(({ problem, evidencePreviews }) => ({
      canonicalProblem: problem.canonicalProblem,
      affectedUsers: problem.affectedUsers,
      industry: problem.industry,
      workflows: problem.workflows,
      problemTypes: problem.problemTypes,
      mentionCount: problem.mentionCount,
      sourceCount: problem.sourceCount,
      geography: problem.geography,
      firstSeenAt: problem.firstSeenAt,
      lastSeenAt: problem.lastSeenAt,
      averageConfidence: problem.averageConfidence,
      evidencePreviews,
    })) }, null, 2));
  } finally { await client.close(); }
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "unique_problem_inspection_error", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
