import type { Db, ObjectId } from "mongodb";
import { db as defaultDb } from "../../mongodb.ts";
import {
  getRedditConfig,
  getResearchConfig,
  type RedditConfig,
} from "../config.ts";
import { logResearchEvent } from "../logger.ts";
import { ensureResearchIndexes } from "../models.ts";
import { normalizeWhitespace } from "../normalization.ts";
import { ResearchRepository } from "../repository.ts";
import type { CollectionRunStatus, GeographyEvidence } from "../types.ts";
import { RedditApiClient, RedditApiError } from "../reddit/client.ts";
import {
  isSafeRedditCommunityName,
  normalizeRedditPost,
  type RedditSkipReason,
} from "../reddit/normalization.ts";

export interface RedditCollectorOptions {
  communities: string[];
  queries: string[];
  industrySeed?: string;
  audienceSeed?: string;
  sort?: string;
  timeFilter?: string;
  postsPerQuery?: number;
  maximumPostAgeDays?: number;
  dryRun?: boolean;
  maximumRequests?: number;
  includePreviews?: boolean;
}

export interface RedditCollectorReport {
  communitiesAttempted: string[];
  communitiesSuccessfullyAccessed: string[];
  communitiesUnavailable: string[];
  queriesAttempted: number;
  apiRequestsMade: number;
  postsFetched: number;
  postsAccepted: number;
  postsInserted: number;
  wouldInsert: number;
  duplicates: number;
  skippedByReason: Partial<Record<RedditSkipReason, number>>;
  failures: number;
  geographyEvidence: Partial<Record<GeographyEvidence, number>>;
  dryRun: boolean;
  runStatus: CollectionRunStatus;
  durationMs: number;
  previews: Array<{
    sourceId: string;
    community: string;
    title?: string;
    bodyPreview: string;
    geographyEvidence: GeographyEvidence;
  }>;
}

interface CollectorDependencies {
  database?: Db;
  repository?: ResearchRepository;
  client?: RedditApiClient;
  redditConfig?: RedditConfig;
  now?: () => Date;
  ensureIndexes?: boolean;
}

interface ValidatedOptions {
  communities: string[];
  queries: string[];
  industrySeed?: string;
  audienceSeed?: string;
  sort: string;
  timeFilter: string;
  postsPerQuery: number;
  maximumPostAgeDays: number;
  dryRun: boolean;
  maximumRequests: number;
  includePreviews: boolean;
}

function incrementCounter<T extends string>(record: Partial<Record<T, number>>, key: T, amount = 1) {
  record[key] = (record[key] || 0) + amount;
}

export function validateRedditCollectorOptions(
  options: RedditCollectorOptions,
  config: RedditConfig = getRedditConfig(),
): ValidatedOptions {
  if (!config.enabled) {
    throw new Error("Reddit collection is disabled. Set RESEARCH_COLLECTOR_REDDIT_ENABLED=true.");
  }
  const communities = [...new Set(options.communities.map((value) => value.trim().replace(/^r\//i, "")))]
    .filter(Boolean);
  const queries = [...new Set(options.queries.map(normalizeWhitespace))].filter(Boolean);
  if (!communities.length) throw new Error("At least one Reddit community is required");
  if (!queries.length) throw new Error("At least one Reddit query is required");
  const invalidCommunity = communities.find((value) => !isSafeRedditCommunityName(value));
  if (invalidCommunity) throw new Error(`Unsafe Reddit community name: ${invalidCommunity}`);
  if (communities.length > config.maximumCommunitiesPerRun) {
    throw new Error(`At most ${config.maximumCommunitiesPerRun} communities are allowed per run`);
  }
  if (queries.length > config.maximumQueriesPerCommunity) {
    throw new Error(`At most ${config.maximumQueriesPerCommunity} queries are allowed per community`);
  }
  const sort = options.sort || config.defaultSort;
  const timeFilter = options.timeFilter || config.defaultTimeFilter;
  if (!config.allowedSortModes.includes(sort as never)) {
    throw new Error(`Unsupported Reddit sort mode: ${sort}`);
  }
  if (!config.allowedTimeFilters.includes(timeFilter as never)) {
    throw new Error(`Unsupported Reddit time filter: ${timeFilter}`);
  }
  const postsPerQuery = options.postsPerQuery ?? config.postsPerQuery;
  if (!Number.isSafeInteger(postsPerQuery) || postsPerQuery < 1 || postsPerQuery > config.postsPerQuery) {
    throw new Error(`postsPerQuery must be between 1 and ${config.postsPerQuery}`);
  }
  const maximumPostAgeDays = options.maximumPostAgeDays ?? config.maximumPostAgeDays;
  if (
    !Number.isSafeInteger(maximumPostAgeDays) ||
    maximumPostAgeDays < 1 ||
    maximumPostAgeDays > config.maximumPostAgeDays
  ) {
    throw new Error(`maximumPostAgeDays must be between 1 and ${config.maximumPostAgeDays}`);
  }
  const maximumRequests = options.maximumRequests ?? config.maximumRequestsPerRun;
  if (!Number.isSafeInteger(maximumRequests) || maximumRequests < 2 || maximumRequests > config.maximumRequestsPerRun) {
    throw new Error(`maximumRequests must be between 2 and ${config.maximumRequestsPerRun}`);
  }
  if (communities.length * queries.length + 1 > maximumRequests) {
    throw new Error("Community/query combinations exceed the safe request limit (including authentication)");
  }
  return {
    communities,
    queries,
    ...(options.industrySeed?.trim() && { industrySeed: options.industrySeed.trim() }),
    ...(options.audienceSeed?.trim() && { audienceSeed: options.audienceSeed.trim() }),
    sort,
    timeFilter,
    postsPerQuery,
    maximumPostAgeDays,
    dryRun: options.dryRun ?? config.dryRun,
    maximumRequests,
    includePreviews: Boolean(options.includePreviews),
  };
}

export async function collectRedditPosts(
  input: RedditCollectorOptions,
  dependencies: CollectorDependencies = {},
): Promise<RedditCollectorReport> {
  const startedAt = Date.now();
  const redditConfig = dependencies.redditConfig || getRedditConfig();
  const options = validateRedditCollectorOptions(input, redditConfig);
  const database = dependencies.database || defaultDb;
  if (dependencies.ensureIndexes !== false) await ensureResearchIndexes(database);
  const repository = dependencies.repository || new ResearchRepository(database, getResearchConfig());
  const client = dependencies.client || new RedditApiClient(redditConfig, options.maximumRequests);
  const now = dependencies.now || (() => new Date());
  const run = await repository.createCollectionRun({
    source: "reddit",
    collectorName: "reddit_authenticated_search",
    ...(options.communities.length === 1 && { sourceCommunity: options.communities[0] }),
    ...(options.queries.length === 1 && { query: options.queries[0] }),
    ...(options.industrySeed && { industrySeed: options.industrySeed }),
    ...(options.audienceSeed && { audienceSeed: options.audienceSeed }),
    dryRun: options.dryRun,
    configurationSnapshot: {
      communities: options.communities,
      queries: options.queries,
      sort: options.sort,
      timeFilter: options.timeFilter,
      postsPerQuery: options.postsPerQuery,
      maximumPostAgeDays: options.maximumPostAgeDays,
      maximumRequests: options.maximumRequests,
      includeSelfTextOnly: redditConfig.includeSelfTextOnly,
      excludeNsfw: redditConfig.excludeNsfw,
    },
  });
  if (!run._id) throw new Error("Reddit collection run was created without an identifier");
  const runId = run._id as ObjectId;
  const successfulCommunities = new Set<string>();
  const unavailableCommunities = new Set<string>();
  const skippedByReason: Partial<Record<RedditSkipReason, number>> = {};
  const geographyEvidence: Partial<Record<GeographyEvidence, number>> = {};
  const previews: RedditCollectorReport["previews"] = [];
  let queriesAttempted = 0;
  let postsFetched = 0;
  let postsAccepted = 0;
  let postsInserted = 0;
  let wouldInsert = 0;
  let duplicates = 0;
  let failures = 0;

  logResearchEvent("info", "reddit_collection_started", {
    communities: options.communities,
    queryCount: options.queries.length,
    dryRun: options.dryRun,
    maximumRequests: options.maximumRequests,
  });

  try {
    const pairs = options.communities.flatMap((community) =>
      options.queries.map((query) => ({ community, query })),
    );
    let cursor = 0;
    let fatalError: unknown;
    const worker = async () => {
      while (cursor < pairs.length && !fatalError) {
        const pair = pairs[cursor++];
        queriesAttempted += 1;
        try {
          const posts = await client.searchPosts({
            community: pair.community,
            query: pair.query,
            sort: options.sort,
            timeFilter: options.timeFilter,
            limit: options.postsPerQuery,
          });
          successfulCommunities.add(pair.community);
          postsFetched += posts.length;
          const signals: Record<string, unknown>[] = [];
          let prefiltered = 0;
          for (const post of posts) {
            const normalized = normalizeRedditPost(post, {
              query: pair.query,
              industrySeed: options.industrySeed,
              audienceSeed: options.audienceSeed,
              minimumPostBodyLength: redditConfig.minimumPostBodyLength,
              maximumPostAgeDays: options.maximumPostAgeDays,
              includeSelfTextOnly: redditConfig.includeSelfTextOnly,
              excludeNsfw: redditConfig.excludeNsfw,
              now: now(),
            });
            if (!normalized.accepted) {
              incrementCounter(skippedByReason, normalized.reason);
              prefiltered += 1;
              logResearchEvent("info", "reddit_post_skipped", {
                community: pair.community,
                sourceId: post.id,
                reason: normalized.reason,
              });
              continue;
            }
            postsAccepted += 1;
            incrementCounter(geographyEvidence, normalized.geographyEvidence);
            signals.push(normalized.signal);
            if (options.includePreviews && previews.length < 5) {
              previews.push({
                sourceId: String(normalized.signal.sourceId),
                community: String(normalized.signal.sourceCommunity),
                title: normalized.signal.title
                  ? String(normalized.signal.title).slice(0, 160)
                  : undefined,
                bodyPreview: String(normalized.signal.body).slice(0, 120),
                geographyEvidence: normalized.geographyEvidence,
              });
            }
          }
          if (prefiltered) {
            await repository.incrementCollectionRunCounters(runId, {
              fetchedCount: prefiltered,
              skippedCount: prefiltered,
            });
          }
          if (signals.length) {
            const batch = await repository.insertRawSignalsBatch(signals, {
              collectionRunId: runId,
              dryRun: options.dryRun,
              concurrency: redditConfig.collectionConcurrency,
            });
            postsInserted += batch.inserted;
            wouldInsert += batch.wouldInsert;
            duplicates += batch.duplicate;
            failures += batch.failed;
            if (batch.skipped) incrementCounter(skippedByReason, "validation", batch.skipped);
          }
        } catch (error) {
          if (error instanceof RedditApiError && error.category === "authentication") {
            fatalError = error;
            return;
          }
          failures += 1;
          await repository.incrementCollectionRunCounters(runId, { failedCount: 1 });
          if (
            error instanceof RedditApiError &&
            ((error.category === "authorization" && error.status === 403) ||
              (error.category === "validation" && error.status === 404))
          ) {
            unavailableCommunities.add(pair.community);
            logResearchEvent("warn", "reddit_community_unavailable", {
              community: pair.community,
              category: error.category,
              status: error.status,
            });
          } else {
            logResearchEvent("error", "reddit_query_failed", {
              community: pair.community,
              category: error instanceof RedditApiError ? error.category : "unknown",
              status: error instanceof RedditApiError ? error.status : undefined,
            });
          }
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(redditConfig.collectionConcurrency, pairs.length) }, worker),
    );
    if (fatalError) throw fatalError;
    const runStatus: CollectionRunStatus = failures || unavailableCommunities.size
      ? "partially_completed"
      : "completed";
    await repository.completeCollectionRun(runId, runStatus);
    const report: RedditCollectorReport = {
      communitiesAttempted: options.communities,
      communitiesSuccessfullyAccessed: [...successfulCommunities],
      communitiesUnavailable: [...unavailableCommunities],
      queriesAttempted,
      apiRequestsMade: client.requestCount,
      postsFetched,
      postsAccepted,
      postsInserted,
      wouldInsert,
      duplicates,
      skippedByReason,
      failures,
      geographyEvidence,
      dryRun: options.dryRun,
      runStatus,
      durationMs: Date.now() - startedAt,
      previews,
    };
    logResearchEvent("info", "reddit_collection_completed", {
      ...report,
      previews: undefined,
    });
    return report;
  } catch (error) {
    await repository.failCollectionRun(runId, error);
    logResearchEvent("error", "reddit_collection_failed", {
      category: error instanceof RedditApiError ? error.category : "unknown",
      status: error instanceof RedditApiError ? error.status : undefined,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}
