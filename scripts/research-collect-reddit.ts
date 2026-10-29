import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const HELP = `Usage:
  npm run research:collect:reddit -- --community Parenting --query "struggling with" [options]

Options:
  --community NAME            Add one community
  --communities A,B,C         Add comma-separated communities
  --communities-file FILE     Load a JSON array or grouped object
  --query TEXT                Add one search query
  --queries-file FILE         Load a JSON string array
  --industry TEXT             Attach an industry seed
  --audience TEXT             Attach an audience seed
  --sort MODE                 relevance, hot, top, new, or comments
  --time FILTER               hour, day, week, month, year, or all
  --limit NUMBER              Posts requested per community/query
  --max-age-days NUMBER       Maximum post age
  --max-requests NUMBER       Hard request ceiling, including OAuth
  --dry-run                   Validate/deduplicate without inserting signals
  --help                      Show this help
`;

const valueFlags = new Set([
  "community", "communities", "communities-file", "query", "queries-file", "industry",
  "audience", "sort", "time", "limit", "max-age-days", "max-requests",
]);
const booleanFlags = new Set(["dry-run", "help", "safe-test"]);

function parseArguments() {
  const values = new Map<string, string[]>();
  const booleans = new Set<string>();
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const equalsIndex = argument.indexOf("=");
    const name = argument.slice(2, equalsIndex >= 0 ? equalsIndex : undefined);
    const inlineValue = equalsIndex >= 0 ? argument.slice(equalsIndex + 1) : undefined;
    if (booleanFlags.has(name)) {
      if (inlineValue !== undefined) throw new Error(`--${name} does not accept a value`);
      booleans.add(name);
      continue;
    }
    if (!valueFlags.has(name)) throw new Error(`Unknown option: --${name}`);
    const value = inlineValue ?? process.argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, [...(values.get(name) || []), value]);
  }
  return { values, booleans };
}

async function loadJson(file: string): Promise<unknown> {
  const path = resolve(file);
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read JSON from ${path}: ${error instanceof Error ? error.message : error}`);
  }
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${label} must be a JSON array of strings`);
  }
  return value;
}

function communitiesFromJson(value: unknown): string[] {
  if (Array.isArray(value)) return stringArray(value, "Communities file");
  if (!value || typeof value !== "object") {
    throw new Error("Communities file must be an array or an object of string arrays");
  }
  return Object.values(value).flatMap((group) => stringArray(group, "Community group"));
}

function optionalNumber(values: Map<string, string[]>, name: string): number | undefined {
  const raw = values.get(name)?.at(-1);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`--${name} must be an integer`);
  return value;
}

async function main() {
  const parsed = parseArguments();
  if (parsed.booleans.has("help")) {
    console.log(HELP);
    return;
  }
  const { getRedditConfig, requireRedditCredentials } = await import("../lib/research/config.ts");
  const config = getRedditConfig();
  if (!config.enabled) {
    throw new Error("Reddit collection is disabled. Set RESEARCH_COLLECTOR_REDDIT_ENABLED=true.");
  }
  requireRedditCredentials(config);

  const safeTest = parsed.booleans.has("safe-test");
  const communities = safeTest ? ["Parenting"] : [
    ...(parsed.values.get("community") || []),
    ...(parsed.values.get("communities") || []).flatMap((value) => value.split(",")),
  ];
  const queries = safeTest ? ["struggling with"] : [...(parsed.values.get("query") || [])];
  for (const file of parsed.values.get("communities-file") || []) {
    communities.push(...communitiesFromJson(await loadJson(file)));
  }
  for (const file of parsed.values.get("queries-file") || []) {
    queries.push(...stringArray(await loadJson(file), "Queries file"));
  }
  if (!communities.length || !queries.length) throw new Error("At least one community and one query are required");

  const { collectRedditPosts } = await import("../lib/research/collectors/redditCollector.ts");
  const { client } = await import("../lib/mongodb.ts");
  try {
    const report = await collectRedditPosts({
      communities,
      queries,
      industrySeed: parsed.values.get("industry")?.at(-1),
      audienceSeed: parsed.values.get("audience")?.at(-1),
      sort: parsed.values.get("sort")?.at(-1),
      timeFilter: parsed.values.get("time")?.at(-1),
      postsPerQuery: safeTest ? Math.min(5, config.postsPerQuery) : optionalNumber(parsed.values, "limit"),
      maximumPostAgeDays: optionalNumber(parsed.values, "max-age-days"),
      maximumRequests: safeTest ? 2 : optionalNumber(parsed.values, "max-requests"),
      dryRun: safeTest || parsed.booleans.has("dry-run") || config.dryRun,
      includePreviews: safeTest,
    });
    console.log(JSON.stringify({ event: "reddit_collection_report", ...report }, null, 2));
    if (report.failures) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: "reddit_collection_error",
    error: error instanceof Error ? error.message : String(error),
  }));
  console.error(HELP);
  process.exitCode = 1;
});
