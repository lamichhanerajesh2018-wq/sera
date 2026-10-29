import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function limitArgument() {
  const inline = process.argv.find((argument) => argument.startsWith("--limit="));
  const index = process.argv.indexOf("--limit");
  const value = Number(inline?.slice(8) ?? (index >= 0 ? process.argv[index + 1] : "10"));
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) throw new Error("--limit must be between 1 and 50");
  return value;
}

async function main() {
  const { client, db } = await import("../lib/mongodb.ts");
  try {
    const { DeduplicationRepository } = await import("../lib/research/deduplication/repository.ts");
    const rows = await new DeduplicationRepository(db).inspectDecisions(limitArgument());
    console.log(JSON.stringify({ totalShown: rows.length, sample: rows.map(({ decision, mention, candidate }) => ({
      incomingCanonicalProblem: mention?.canonicalProblem || null,
      candidateCanonicalProblem: candidate?.canonicalProblem || null,
      similarity: decision.similarity ?? null,
      decision: decision.decision,
      confidence: decision.decisionConfidence ?? null,
      reason: decision.reason,
      finalAction: decision.finalAction,
    })) }, null, 2));
  } finally { await client.close(); }
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "dedup_decision_inspection_error", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
