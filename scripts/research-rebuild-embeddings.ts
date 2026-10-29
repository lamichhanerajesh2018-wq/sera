import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const HELP = `Usage: npm run research:rebuild-embeddings -- --model MODEL --version VERSION [options]

Options:
  --model MODEL              Required explicit target model
  --version VERSION          Required explicit embedding-text version
  --limit NUMBER             Default 10
  --dry-run                  Report only; no API calls or writes
  --confirm-replace          Required for any replacement write
  --help`;

function parseArgs() {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    const equals = argument.indexOf("=");
    const name = argument.slice(2, equals >= 0 ? equals : undefined);
    const inline = equals >= 0 ? argument.slice(equals + 1) : undefined;
    if (["dry-run", "confirm-replace", "help"].includes(name)) { flags.add(name); continue; }
    if (!["model", "version", "limit"].includes(name)) throw new Error(`Unknown option: --${name}`);
    const value = inline ?? process.argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, value);
  }
  return { values, flags };
}

async function main() {
  const parsed = parseArgs();
  if (parsed.flags.has("help")) { console.log(HELP); return; }
  const model = parsed.values.get("model")?.trim();
  const version = parsed.values.get("version")?.trim();
  if (!model || !version) throw new Error("Both --model and --version are required");
  const limit = Number(parsed.values.get("limit") || "10");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) throw new Error("--limit must be between 1 and 1000");
  const dryRun = parsed.flags.has("dry-run") || !parsed.flags.has("confirm-replace");
  const { getDeduplicationConfig, requireEmbeddingConfiguration } = await import("../lib/research/config.ts");
  const config = { ...getDeduplicationConfig(), embeddingModel: model, embeddingVersion: version };
  const { client, db } = await import("../lib/mongodb.ts");
  try {
    const { DeduplicationRepository } = await import("../lib/research/deduplication/repository.ts");
    const repository = new DeduplicationRepository(db);
    const mentionRequiresRebuild = await repository.countEmbeddingsNeedingRebuild(model, version);
    const uniqueProblemRequiresRebuild = await repository.countUniqueEmbeddingsNeedingRebuild(model, version);
    const requiresRebuild = mentionRequiresRebuild + uniqueProblemRequiresRebuild;
    if (dryRun) {
      console.log(JSON.stringify({
        event: "embedding_rebuild_report", model, version, requiresRebuild,
        mentionRequiresRebuild, uniqueProblemRequiresRebuild,
        selectedLimit: Math.min(limit, requiresRebuild), replaced: 0, dryRun: true,
        note: "Use --confirm-replace for a bounded non-destructive per-record replacement.",
      }, null, 2));
      return;
    }
    requireEmbeddingConfiguration(config);
    const mentions = await repository.listEmbeddingsNeedingRebuild(model, version, limit);
    const remainingLimit = Math.max(0, limit - mentions.length);
    const uniqueProblems = await repository.listUniqueEmbeddingsNeedingRebuild(model, version, remainingLimit);
    const { OpenRouterEmbeddingClient } = await import("../lib/research/deduplication/clients.ts");
    const { buildEmbeddingText, buildUniqueProblemEmbeddingText } = await import("../lib/research/deduplication/text.ts");
    const embeddingClient = new OpenRouterEmbeddingClient(config);
    let replaced = 0;
    let totalTokens = 0;
    let estimatedCost = 0;
    for (let offset = 0; offset < mentions.length; offset += config.embeddingBatchSize) {
      const batch = mentions.slice(offset, offset + config.embeddingBatchSize);
      const result = await embeddingClient.embed(batch.map(buildEmbeddingText));
      for (let index = 0; index < batch.length; index += 1) {
        if (!batch[index]._id) continue;
        await repository.replaceMentionEmbedding(batch[index]._id!, result.embeddings[index], model, version);
        replaced += 1;
      }
      totalTokens += result.usage.totalTokens;
      estimatedCost += result.usage.estimatedCost;
    }
    for (let offset = 0; offset < uniqueProblems.length; offset += config.embeddingBatchSize) {
      const batch = uniqueProblems.slice(offset, offset + config.embeddingBatchSize);
      const result = await embeddingClient.embed(batch.map(buildUniqueProblemEmbeddingText));
      for (let index = 0; index < batch.length; index += 1) {
        if (!batch[index]._id) continue;
        await repository.replaceUniqueProblemEmbedding(batch[index]._id!, result.embeddings[index], model, version);
        replaced += 1;
      }
      totalTokens += result.usage.totalTokens;
      estimatedCost += result.usage.estimatedCost;
    }
    console.log(JSON.stringify({
      event: "embedding_rebuild_report", model, version, requiresRebuild,
      mentionRequiresRebuild, uniqueProblemRequiresRebuild,
      selectedLimit: mentions.length + uniqueProblems.length, replaced, dryRun: false, totalTokens, estimatedCost,
      note: "Only the explicitly selected model/version is written; incompatible vectors are never compared.",
    }, null, 2));
  } finally { await client.close(); }
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "embedding_rebuild_error", error: error instanceof Error ? error.message : String(error) }));
  console.error(HELP);
  process.exitCode = 1;
});
