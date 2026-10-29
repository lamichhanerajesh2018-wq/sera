import { readFile, writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function parseArgs() {
  const command = process.argv[2];
  if (!command) throw new Error("Review command is required");
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 3; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const equals = argument.indexOf("=");
    const name = argument.slice(2, equals >= 0 ? equals : undefined);
    const inline = equals >= 0 ? argument.slice(equals + 1) : undefined;
    if (["dry-run", "stratified", "confirm"].includes(name)) { flags.add(name); continue; }
    const value = inline ?? process.argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, value);
  }
  return { command, values, flags };
}

function numeric(values: Map<string, string>, key: string) {
  const value = values.get(key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${key} must be numeric`);
  return parsed;
}

async function main() {
  const { command, values, flags } = parseArgs();
  const { client, db } = await import("../lib/mongodb.ts");
  const { QualityRepository } = await import("../lib/research/quality/repository.ts");
  const { exportReviews, generateReviewQueue, parseObjectId, reviewStats, rowsToCsv, safeReviewView } =
    await import("../lib/research/quality/service.ts");
  const repository = new QualityRepository(db);
  try {
    if (command === "generate") {
      const targetType = values.get("target-type");
      const result = await generateReviewQueue({
        ...(targetType && { targetType: targetType as never }),
        sampleSize: numeric(values, "sample-size") || 10,
        source: values.get("source"), industry: values.get("industry"), status: values.get("status"),
        minimumConfidence: numeric(values, "min-confidence"), maximumConfidence: numeric(values, "max-confidence"),
        decision: values.get("decision"), stratified: flags.has("stratified"),
        seed: values.get("seed") || "review-v1", dryRun: flags.has("dry-run"),
        reviewRound: numeric(values, "review-round"),
      }, db);
      console.log(JSON.stringify({ selected: result.selected.length, created: result.created, existing: result.existing, dryRun: flags.has("dry-run") }, null, 2));
    } else if (command === "next") {
      const review = await repository.claimNextReview(values.get("reviewer-id"));
      console.log(JSON.stringify(review ? {
        reviewAssignmentId: review._id?.toString(),
        ...await safeReviewView(review, db),
      } : { message: "No pending reviews" }, null, 2));
    } else if (command === "submit") {
      const reviewId = parseObjectId(values.get("review-id") || "", "review-id");
      const input = JSON.parse(await readFile(values.get("file") || "", "utf8"));
      await repository.submitReview(reviewId, input);
      console.log(JSON.stringify({ event: "review_completed" }));
    } else if (command === "skip") {
      await repository.skipReview(parseObjectId(values.get("review-id") || "", "review-id"), values.get("notes"));
      console.log(JSON.stringify({ event: "review_skipped" }));
    } else if (command === "stats") {
      console.log(JSON.stringify(await reviewStats(db), null, 2));
    } else if (command === "export") {
      const rows = await exportReviews(db, values.get("status"));
      const format = values.get("format") || "json";
      const output = format === "csv" ? rowsToCsv(rows) : JSON.stringify(rows, null, 2);
      if (values.get("file")) await writeFile(values.get("file")!, output, { encoding: "utf8", flag: "wx" });
      else console.log(output);
    } else if (command === "import") {
      const items = JSON.parse(await readFile(values.get("file") || "", "utf8"));
      if (!Array.isArray(items)) throw new Error("Import file must contain a JSON array");
      console.log(JSON.stringify(await repository.importReviews(items, flags.has("dry-run")), null, 2));
    } else if (command === "apply-corrections") {
      if (!flags.has("confirm")) throw new Error("--confirm is required to apply corrections");
      const audit = await repository.applyCorrections(
        parseObjectId(values.get("review-id") || "", "review-id"), values.get("applied-by"),
      );
      console.log(JSON.stringify({ event: "corrections_applied", meaningChanged: audit.meaningChanged }));
    } else throw new Error(`Unsupported review command: ${command}`);
  } finally { await client.close(); }
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "review_command_error", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
