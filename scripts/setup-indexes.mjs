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

  console.log("\n🎉 All indexes created successfully.\n");
  await client.close();
}

run().catch((err) => {
  console.error("❌ Index setup failed:", err);
  process.exit(1);
});
