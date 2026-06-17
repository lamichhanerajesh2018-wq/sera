// scripts/inspect.mjs
// Read-only quality check of seeded content. Prints counts, a few random
// samples from each collection, and flags obvious issues (empty/very short
// content, duplicates, missing fields). Touches nothing — safe to run anytime.
//
// Run with:  node scripts/inspect.mjs

import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const uriLine = env.split("\n").find((l) => l.startsWith("MONGODB_URI="));
const MONGODB_URI = uriLine?.replace("MONGODB_URI=", "").trim().replace(/^["']|["']$/g, "");
if (!MONGODB_URI) { console.error("❌ MONGODB_URI missing"); process.exit(1); }

const client = new MongoClient(MONGODB_URI);
const line = "─".repeat(60);

function sample(arr, n) {
  const out = [];
  const copy = [...arr];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

async function run() {
  await client.connect();
  const db = client.db();
  console.log(`\n📊 Inspecting: ${db.databaseName}\n${line}`);

  const users = db.collection("user");
  const posts = db.collection("posts");
  const comments = db.collection("comments");
  const questions = db.collection("questions");
  const conversations = db.collection("conversations");
  const messages = db.collection("messages");
  const communities = db.collection("communities");

  // ---- counts ----
  const [
    totalUsers, seedUsers, realUsers,
    totalPosts, seedPosts,
    totalComments, totalQA, publicQA,
    totalConvos, totalMsgs, totalCommunities,
  ] = await Promise.all([
    users.countDocuments({}),
    users.countDocuments({ seed: true }),
    users.countDocuments({ seed: { $ne: true } }),
    posts.countDocuments({}),
    posts.countDocuments({ seed: true }),
    comments.countDocuments({}),
    questions.countDocuments({}),
    questions.countDocuments({ isPublic: true }),
    conversations.countDocuments({}),
    messages.countDocuments({}),
    communities.countDocuments({}),
  ]);

  console.log("COUNTS");
  console.log(`  users:        ${totalUsers}  (seed ${seedUsers}, real ${realUsers})`);
  console.log(`  posts:        ${totalPosts}  (seed ${seedPosts})`);
  console.log(`  comments:     ${totalComments}`);
  console.log(`  Q&A:          ${totalQA}  (public ${publicQA})`);
  console.log(`  conversations:${totalConvos}`);
  console.log(`  messages:     ${totalMsgs}`);
  console.log(`  communities:  ${totalCommunities}`);
  console.log(line);

  // ---- quality flags ----
  const shortPosts = await posts.countDocuments({
    $expr: { $lt: [{ $strLenCP: { $ifNull: ["$content", ""] } }, 15] },
  });
  const emptyPosts = await posts.countDocuments({
    $or: [{ content: { $exists: false } }, { content: "" }, { content: null }],
  });
  const noAuthor = await posts.countDocuments({
    $or: [{ authorUsername: { $exists: false } }, { authorUsername: "" }],
  });
  // duplicate content (same text more than once)
  const dupAgg = await posts.aggregate([
    { $group: { _id: "$content", n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: "dups" },
  ]).toArray();
  const dupCount = dupAgg[0]?.dups ?? 0;

  // old hush- handles still around?
  const hushUsers = await users.countDocuments({ username: { $regex: /^hush-/ } });
  const hushPosts = await posts.countDocuments({ authorUsername: { $regex: /^hush-/ } });

  console.log("QUALITY FLAGS");
  console.log(`  very short posts (<15 chars): ${shortPosts}`);
  console.log(`  empty posts:                  ${emptyPosts}`);
  console.log(`  posts missing author:         ${noAuthor}`);
  console.log(`  duplicate post texts:         ${dupCount}`);
  console.log(`  leftover hush- users:         ${hushUsers}`);
  console.log(`  leftover hush- posts:         ${hushPosts}`);
  console.log(line);

  // ---- samples ----
  const postDocs = await posts.find({}).limit(400).toArray();
  console.log("SAMPLE POSTS");
  for (const p of sample(postDocs, 8)) {
    const where = p.communitySlug ? `#${p.communitySlug}` : "feed";
    console.log(`  [@${p.authorUsername} · ${where}] ${p.content}`);
  }
  console.log(line);

  const qaDocs = await questions.find({ isPublic: true }).limit(200).toArray();
  console.log("SAMPLE Q&A (public)");
  for (const q of sample(qaDocs, 5)) {
    console.log(`  Q: ${q.content}`);
    console.log(`  A: ${q.answer}`);
    console.log("");
  }
  console.log(line);

  const convoDocs = await conversations.find({}).limit(100).toArray();
  console.log("SAMPLE CHAT");
  const c = sample(convoDocs, 1)[0];
  if (c) {
    console.log(`  ${c.participantUsernames?.join("  ↔  ")}`);
    const msgs = await messages.find({ conversationId: c._id.toString() }).sort({ createdAt: 1 }).toArray();
    for (const m of msgs) console.log(`    @${m.senderUsername}: ${m.content}`);
  }
  console.log(line);

  console.log("✅ Inspect done.\n");
  await client.close();
}

run().catch((e) => { console.error("❌", e); process.exit(1); });
