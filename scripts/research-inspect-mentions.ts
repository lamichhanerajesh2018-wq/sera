import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function limitArgument(): number {
  const index = process.argv.indexOf("--limit");
  const inline = process.argv.find((argument) => argument.startsWith("--limit="));
  const raw = inline?.slice(8) ?? (index >= 0 ? process.argv[index + 1] : "10");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) throw new Error("--limit must be between 1 and 50");
  return value;
}

async function main() {
  const limit = limitArgument();
  const { client, db } = await import("../lib/mongodb.ts");
  try {
    const { ExtractionRepository } = await import("../lib/research/extraction/repository.ts");
    const rows = await new ExtractionRepository(db).inspectMentions(limit);
    const sample = rows.map(({ mention, signal }) => ({
      source: mention.source,
      community: mention.sourceCommunity || null,
      sourcePreview: signal
        ? `${signal.title ? `${signal.title}\n` : ""}${signal.body}`.slice(0, 240)
        : null,
      canonicalProblem: mention.canonicalProblem,
      affectedUser: mention.affectedUser,
      industry: mention.industry,
      problemType: mention.problemType,
      evidence: mention.evidenceText,
      geography: mention.geography,
      confidence: mention.extractionConfidence,
      status: mention.status,
      rejectionReason: mention.rejectionReason,
    }));
    console.log(JSON.stringify({ totalShown: sample.length, sample }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: "mention_inspection_error",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
