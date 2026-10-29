// scripts/setup-indexes.mjs
// Run once (or on every deploy) to ensure all MongoDB indexes exist.
// Safe to re-run — createIndex is idempotent.
//
//   node scripts/setup-indexes.mjs

import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const uriLine = env.split("\n").find((l) => l.startsWith("MONGODB_URI="));
const MONGODB_URI = uriLine?.replace("MONGODB_URI=", "").trim().replace(/^["']|["']$/g, "");
if (!MONGODB_URI) { console.error("❌ MONGODB_URI missing"); process.exit(1); }

const client = new MongoClient(MONGODB_URI);

async function run() {
  await client.connect();
  const db = client.db();
  console.log(`\n📦 Setting up indexes on: ${db.databaseName}\n`);

  // ── posts ───────────────────────────────────────────────────────────
  await db.collection("posts").createIndex({ createdAt: -1 });
  await db.collection("posts").createIndex({ communitySlug: 1, createdAt: -1 });
  await db.collection("posts").createIndex({ authorUsername: 1, createdAt: -1 });
  console.log("✅ posts");

  // ── comments ────────────────────────────────────────────────────────
  await db.collection("comments").createIndex({ postId: 1, createdAt: 1 });
  console.log("✅ comments");

  // ── reactions ───────────────────────────────────────────────────────
  // Unique: one reaction per (postId, userId, type)
  await db.collection("reactions").createIndex(
    { postId: 1, userId: 1, type: 1 },
    { unique: true }
  );
  console.log("✅ reactions");

  // ── questions (anonymous inbox) ─────────────────────────────────────
  await db.collection("questions").createIndex({ recipientId: 1, createdAt: -1 });
  await db.collection("questions").createIndex({ askedById: 1 }); // safety lookups
  console.log("✅ questions");

  // ── conversations ───────────────────────────────────────────────────
  // Multikey index on participantIds array
  await db.collection("conversations").createIndex({ participantIds: 1, lastMessageAt: -1 });
  await db.collection("conversations").createIndex({ participantIds: 1, status: 1 });
  console.log("✅ conversations");

  // ── messages ────────────────────────────────────────────────────────
  await db.collection("messages").createIndex({ conversationId: 1, createdAt: 1 });
  console.log("✅ messages");

  // ── communities ─────────────────────────────────────────────────────
  await db.collection("communities").createIndex({ slug: 1 }, { unique: true });
  await db.collection("communities").createIndex({ memberCount: -1 });
  console.log("✅ communities");

  // ── memberships ─────────────────────────────────────────────────────
  await db.collection("memberships").createIndex(
    { communityId: 1, userId: 1 },
    { unique: true }
  );
  console.log("✅ memberships");

  // ── user ────────────────────────────────────────────────────────────
  // Better Auth creates its own indexes, but ensure username lookup is fast.
  await db.collection("user").createIndex({ username: 1 }, { unique: true, sparse: true });
  console.log("✅ user");

  // ── notifications ───────────────────────────────────────────────────
  await db.collection("notifications").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("notifications").createIndex({ userId: 1, read: 1 });
  console.log("✅ notifications");

  // ── reports ─────────────────────────────────────────────────────────
  await db.collection("reports").createIndex({ status: 1, createdAt: -1 });
  await db.collection("reports").createIndex({ reporterId: 1, targetType: 1, targetId: 1 });
  console.log("✅ reports");

  // ── blocks ──────────────────────────────────────────────────────────
  await db.collection("blocks").createIndex({ blockerId: 1, blockedId: 1 }, { unique: true });
  await db.collection("blocks").createIndex({ blockerId: 1, blockedUsername: 1 });
  console.log("✅ blocks");

  // ── presence ────────────────────────────────────────────────────────
  await db.collection("presence").createIndex({ username: 1 }, { unique: true });
  // TTL: expire presence records after 24 hours of inactivity
  await db.collection("presence").createIndex(
    { lastSeen: 1 },
    { expireAfterSeconds: 60 * 60 * 24 }
  );
  console.log("✅ presence (+ 24h TTL)");

  // ── rate-limit collections (TTL to auto-expire old records) ─────────
  // ask_rate: 10 minutes
  await db.collection("ask_rate").createIndex({ ipHash: 1, createdAt: 1 });
  await db.collection("ask_rate").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 60 * 10 }
  );
  console.log("✅ ask_rate (+ 10min TTL)");

  // contact_rate: 10 minutes
  await db.collection("contact_rate").createIndex({ ipHash: 1, createdAt: 1 });
  await db.collection("contact_rate").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 60 * 10 }
  );
  console.log("✅ contact_rate (+ 10min TTL)");

  // translate_rate: 10 minutes
  await db.collection("translate_rate").createIndex({ ipHash: 1, createdAt: 1 });
  await db.collection("translate_rate").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 60 * 10 }
  );
  console.log("✅ translate_rate (+ 10min TTL)");

  // safety_logs: keep for 90 days
  await db.collection("safety_logs").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("safety_logs").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 60 * 60 * 24 * 90 }
  );
  console.log("✅ safety_logs (+ 90d TTL)");

  // ── research (isolated Phases 1-4 module) ──────────────────────────
  const rawSignals = db.collection("research_raw_signals");
  await rawSignals.createIndex(
    { source: 1, sourceId: 1 },
    { unique: true, name: "source_sourceId_unique" }
  );
  await rawSignals.createIndex({ contentHash: 1 }, { unique: true, name: "contentHash_unique" });
  await rawSignals.createIndex({ processingStatus: 1 }, { name: "processingStatus" });
  await rawSignals.createIndex({ source: 1 }, { name: "source" });
  await rawSignals.createIndex({ sourceCommunity: 1 }, { sparse: true, name: "sourceCommunity" });
  await rawSignals.createIndex({ collectedAt: -1 }, { name: "collectedAt" });
  await rawSignals.createIndex({ publishedAt: -1 }, { sparse: true, name: "publishedAt" });
  await rawSignals.createIndex({ geographyEvidence: 1 }, { name: "geographyEvidence" });
  await rawSignals.createIndex({ industrySeed: 1 }, { sparse: true, name: "industrySeed" });
  await rawSignals.createIndex({ collectionRunId: 1 }, { sparse: true, name: "collectionRunId" });
  await rawSignals.createIndex({ source: 1, "metadata.product": 1 }, { sparse: true, name: "source_cfpb_product" });
  await rawSignals.createIndex({ source: 1, "metadata.issue": 1 }, { sparse: true, name: "source_cfpb_issue" });
  await rawSignals.createIndex({ source: 1, "metadata.state": 1 }, { sparse: true, name: "source_cfpb_state" });
  await rawSignals.createIndex({ title: "text", body: "text", sourceId: "text" }, { name: "admin_signal_text", default_language: "none", language_override: "researchTextLanguage" });
  await rawSignals.createIndex({ source: 1, processingStatus: 1, createdAt: -1, _id: -1 }, { name: "admin_signal_filters" });

  const collectionRuns = db.collection("research_collection_runs");
  await collectionRuns.createIndex({ source: 1 }, { name: "source" });
  await collectionRuns.createIndex({ status: 1 }, { name: "status" });
  await collectionRuns.createIndex({ startedAt: -1 }, { name: "startedAt" });
  await collectionRuns.createIndex({ completedAt: -1 }, { sparse: true, name: "completedAt" });
  console.log("✅ research_raw_signals + research_collection_runs");

  const problemMentions = db.collection("research_problem_mentions");
  await problemMentions.createIndex({ rawSignalId: 1 }, { unique: true, name: "rawSignalId_unique" });
  await problemMentions.createIndex({ extractionRunId: 1 }, { name: "extractionRunId" });
  await problemMentions.createIndex({ status: 1 }, { name: "status" });
  await problemMentions.createIndex({ industry: 1 }, { sparse: true, name: "industry" });
  await problemMentions.createIndex({ affectedUser: 1 }, { sparse: true, name: "affectedUser" });
  await problemMentions.createIndex({ problemType: 1 }, { name: "problemType" });
  await problemMentions.createIndex({ geography: 1 }, { name: "geography" });
  await problemMentions.createIndex({ source: 1 }, { name: "source" });
  await problemMentions.createIndex({ createdAt: -1 }, { name: "createdAt" });
  await problemMentions.createIndex({ uniqueProblemId: 1 }, { sparse: true, name: "uniqueProblemId" });
  await problemMentions.createIndex({ deduplicationStatus: 1 }, { sparse: true, name: "deduplicationStatus" });
  await problemMentions.createIndex({ deduplicationRunId: 1 }, { sparse: true, name: "deduplicationRunId" });
  await problemMentions.createIndex({ canonicalProblem: "text", shortLabel: "text" }, { name: "admin_mention_text", default_language: "none", language_override: "researchTextLanguage" });
  await problemMentions.createIndex({ status: 1, source: 1, createdAt: -1, _id: -1 }, { name: "admin_mention_filters" });

  const extractionRuns = db.collection("research_extraction_runs");
  await extractionRuns.createIndex({ status: 1 }, { name: "status" });
  await extractionRuns.createIndex({ model: 1 }, { name: "model" });
  await extractionRuns.createIndex({ startedAt: -1 }, { name: "startedAt" });
  await extractionRuns.createIndex({ completedAt: -1 }, { sparse: true, name: "completedAt" });
  console.log("✅ research_problem_mentions + research_extraction_runs");

  const uniqueProblems = db.collection("research_unique_problems");
  await uniqueProblems.createIndex({ normalizedKey: 1 }, { unique: true, name: "normalizedKey_unique" });
  await uniqueProblems.createIndex({ industry: 1 }, { name: "industry" });
  await uniqueProblems.createIndex({ subIndustries: 1 }, { name: "subIndustries" });
  await uniqueProblems.createIndex({ affectedUsers: 1 }, { name: "affectedUsers" });
  await uniqueProblems.createIndex({ problemTypes: 1 }, { name: "problemTypes" });
  await uniqueProblems.createIndex({ geography: 1 }, { name: "geography" });
  await uniqueProblems.createIndex({ mentionCount: -1 }, { name: "mentionCount" });
  await uniqueProblems.createIndex({ sourceCount: -1 }, { name: "sourceCount" });
  await uniqueProblems.createIndex({ firstSeenAt: -1 }, { name: "firstSeenAt" });
  await uniqueProblems.createIndex({ lastSeenAt: -1 }, { name: "lastSeenAt" });
  await uniqueProblems.createIndex({ status: 1 }, { name: "status" });
  await uniqueProblems.createIndex(
    { embeddingModel: 1, embeddingDimensions: 1, embeddingVersion: 1 },
    { name: "embedding_compatibility" }
  );
  await uniqueProblems.createIndex({ canonicalProblem: "text", shortLabel: "text" }, { name: "admin_unique_text", default_language: "none", language_override: "researchTextLanguage" });
  await uniqueProblems.createIndex({ status: 1, mentionCount: -1, _id: -1 }, { name: "admin_unique_filters" });

  const deduplicationDecisions = db.collection("research_deduplication_decisions");
  await deduplicationDecisions.createIndex({ mentionId: 1 }, { name: "mentionId" });
  await deduplicationDecisions.createIndex({ candidateUniqueProblemId: 1 }, { sparse: true, name: "candidateUniqueProblemId" });
  await deduplicationDecisions.createIndex({ deduplicationRunId: 1 }, { name: "deduplicationRunId" });
  await deduplicationDecisions.createIndex({ decision: 1 }, { name: "decision" });
  await deduplicationDecisions.createIndex({ processedAt: -1 }, { name: "processedAt" });

  const deduplicationRuns = db.collection("research_deduplication_runs");
  await deduplicationRuns.createIndex({ status: 1 }, { name: "status" });
  await deduplicationRuns.createIndex(
    { embeddingModel: 1, embeddingVersion: 1 },
    { name: "embedding_model_version" }
  );
  await deduplicationRuns.createIndex({ startedAt: -1 }, { name: "startedAt" });
  await deduplicationRuns.createIndex({ completedAt: -1 }, { sparse: true, name: "completedAt" });
  console.log("✅ research_unique_problems + Phase 4 audit/run indexes");

  const humanReviews = db.collection("research_human_reviews");
  await humanReviews.createIndex({ targetType: 1, targetId: 1, reviewRound: 1 }, { unique: true, name: "target_round_unique" });
  await humanReviews.createIndex({ reviewStatus: 1 }, { name: "reviewStatus" });
  await humanReviews.createIndex({ reviewerDecision: 1 }, { sparse: true, name: "reviewerDecision" });
  await humanReviews.createIndex({ reviewedAt: -1 }, { sparse: true, name: "reviewedAt" });
  await humanReviews.createIndex({ sourceModel: 1 }, { sparse: true, name: "sourceModel" });
  await humanReviews.createIndex({ sourcePromptVersion: 1 }, { sparse: true, name: "sourcePromptVersion" });
  await humanReviews.createIndex({ sourceEmbeddingVersion: 1 }, { sparse: true, name: "sourceEmbeddingVersion" });
  await humanReviews.createIndex({ sourceJudgePromptVersion: 1 }, { sparse: true, name: "sourceJudgePromptVersion" });
  await humanReviews.createIndex({ riskScore: -1, createdAt: 1 }, { name: "review_priority" });

  const correctionAudits = db.collection("research_correction_audits");
  await correctionAudits.createIndex({ reviewId: 1 }, { unique: true, name: "reviewId_unique" });
  await correctionAudits.createIndex({ targetType: 1, targetId: 1 }, { name: "target" });
  await correctionAudits.createIndex({ appliedAt: -1 }, { name: "appliedAt" });

  const evaluationItems = db.collection("research_evaluation_items");
  await evaluationItems.createIndex({ datasetVersion: 1 }, { name: "datasetVersion" });
  await evaluationItems.createIndex(
    { datasetVersion: 1, targetType: 1, safeSourceExcerpt: 1 },
    { unique: true, name: "dataset_item_unique" }
  );
  await evaluationItems.createIndex({ sourceCategory: 1 }, { name: "sourceCategory" });
  await evaluationItems.createIndex({ difficulty: 1 }, { name: "difficulty" });

  const evaluationRuns = db.collection("research_evaluation_runs");
  await evaluationRuns.createIndex({ evaluationType: 1 }, { name: "evaluationType" });
  await evaluationRuns.createIndex({ completedAt: -1 }, { name: "completedAt" });

  const readinessReports = db.collection("research_readiness_reports");
  await readinessReports.createIndex({ status: 1 }, { name: "status" });
  await readinessReports.createIndex({ generatedAt: -1 }, { name: "generatedAt" });
  console.log("✅ research Phase 5 review/evaluation/readiness indexes");

  console.log("\n🎉 All indexes created successfully.\n");
  await client.close();
}

run().catch((err) => {
  console.error("❌ Index setup failed:", err);
  process.exit(1);
});
