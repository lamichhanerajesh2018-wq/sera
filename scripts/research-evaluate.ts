import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const type = process.argv[2] as "extraction" | "deduplication" | "geography" | "all" | "compare" | "calibrate";
  const fileIndex = process.argv.indexOf("--file");
  const file = fileIndex >= 0 ? process.argv[fileIndex + 1] : "data/research/evaluation-fixtures.json";
  const parsed = JSON.parse(await readFile(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("Evaluation file must be a JSON array");
  const { evaluationItemSchema } = await import("../lib/research/quality/schema.ts");
  const now = new Date();
  const pairs = parsed.map((row) => ({
    item: { ...evaluationItemSchema.parse(row.item), createdAt: now, updatedAt: now },
    prediction: row.prediction || {},
  }));
  if (type === "compare") {
    const previousIndex = process.argv.indexOf("--previous");
    if (previousIndex < 0) throw new Error("--previous metrics JSON file is required");
    const previous = JSON.parse(await readFile(process.argv[previousIndex + 1], "utf8"));
    const { compareEvaluations, runFixtureEvaluation } = await import("../lib/research/quality/evaluation.ts");
    console.log(JSON.stringify(compareEvaluations(await runFixtureEvaluation(pairs, "all", undefined, false), previous), null, 2));
    return;
  }
  if (type === "calibrate") {
    const { thresholdCalibration } = await import("../lib/research/quality/metrics.ts");
    const observations = pairs.filter(({ item, prediction }) =>
      item.expectedDeduplicationDecision && prediction.similarity !== undefined).map(({ item, prediction }) => ({
      score: prediction.similarity!, expectedPositive: item.expectedDeduplicationDecision === "same_problem",
    }));
    console.log(JSON.stringify(thresholdCalibration(observations, 0.7), null, 2));
    return;
  }
  if (!(["extraction", "deduplication", "geography", "all"] as string[]).includes(type)) {
    throw new Error("Evaluation type must be extraction, deduplication, geography, all, compare, or calibrate");
  }
  const { runFixtureEvaluation } = await import("../lib/research/quality/evaluation.ts");
  console.log(JSON.stringify(await runFixtureEvaluation(pairs, type, undefined, false), null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "evaluation_error", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
