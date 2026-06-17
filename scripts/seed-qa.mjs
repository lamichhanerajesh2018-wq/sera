// scripts/seed-qa.mjs
// Re-seed ONLY the anonymous Q&A with a more vulnerable, honest tone (less
// interview-style). Clears existing seed questions and regenerates them, leaving
// posts, chats, comments and users untouched.
//
// Run with:  node scripts/seed-qa.mjs
// Needs MONGODB_URI and OPENAI_API_KEY in .env.local.

import { MongoClient, ObjectId } from "mongodb";
import { readFileSync } from "fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
function readEnv(key) {
  const line = env.split("\n").find((l) => l.startsWith(`${key}=`));
  return line?.replace(`${key}=`, "").trim().replace(/^["']|["']$/g, "");
}
const MONGODB_URI = readEnv("MONGODB_URI");
const OPENAI_API_KEY = readEnv("OPENAI_API_KEY");
if (!MONGODB_URI) { console.error("❌ MONGODB_URI missing"); process.exit(1); }
if (!OPENAI_API_KEY) { console.error("❌ OPENAI_API_KEY missing"); process.exit(1); }

const QA_TARGET = Number(process.env.QA_TARGET || 200);
const client = new MongoClient(MONGODB_URI);
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

async function genQA(count) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 1.05,
      messages: [
        {
          role: "system",
          content:
            "You write anonymous Q&A for a raw, mental-health-friendly anonymous app (like NGL but deeper). A stranger sends a short, vulnerable or curious QUESTION; the recipient writes a short, HONEST, emotionally real ANSWER (1-2 sentences). Tone is intimate and human — confessional, not corporate or interview-like. Avoid generic job/hobby chatter. Lean into feelings, fears, growth, loneliness, healing, late-night honesty. No emojis, no quotation marks. Return strict JSON.",
        },
        {
          role: "user",
          content: `Write ${count} DISTINCT pairs. Vary the emotional register (some heavy, some tender, some hopeful). Return JSON: {"qa": [{"q":"...","a":"..."}, ...]}.`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const out = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  return Array.isArray(out.qa) ? out.qa : [];
}

async function run() {
  await client.connect();
  const db = client.db();
  console.log("🌱 Re-seeding Q&A in:", db.databaseName);

  const users = db.collection("user");
  const questions = db.collection("questions");

  // Need seed authors to attribute Q&A to.
  const authors = await users.find({ seed: true }).toArray();
  if (authors.length === 0) {
    console.error("❌ No seed authors found. Run the main seed first.");
    process.exit(1);
  }
  const A = authors.length;
  const ids = authors.map((u) => u._id.toString());
  const names = authors.map((u) => u.username);

  // Clear existing seed Q&A only.
  const del = await questions.deleteMany({ seed: true });
  console.log(`🧹 Cleared ${del.deletedCount} old seed Q&A`);

  const now = Date.now();
  let total = 0;
  while (total < QA_TARGET) {
    const batch = Math.min(25, QA_TARGET - total);
    let pairs = [];
    try { pairs = await genQA(batch); }
    catch (e) { console.warn("  ⚠️ batch failed, retrying:", e.message); try { pairs = await genQA(batch); } catch { pairs = []; } }
    for (const p of pairs) {
      if (!p?.q) continue;
      const r = rand(A);
      let s = rand(A);
      while (s === r && A > 1) s = rand(A);
      const answered = !!p.a && Math.random() > 0.2;
      const reactions = {};
      if (answered && Math.random() > 0.5) reactions[pick(["❤️", "👀", "🙏", "😢"])] = 1 + rand(5);
      await questions.insertOne({
        recipientId: ids[r], recipientUsername: names[r],
        senderId: ids[s], content: String(p.q).trim(),
        answer: answered ? String(p.a).trim() : null,
        answeredAt: answered ? new Date(now - rand(60) * 3600000) : null,
        isPublic: answered, reactions, seed: true,
        createdAt: new Date(now - rand(QA_TARGET) * 3600000),
      });
      total++;
    }
    process.stdout.write(`\r❓ qa: ${total}/${QA_TARGET}`);
  }
  console.log(`\n✅ Inserted ${total} Q&A.`);
  await client.close();
}

run().catch((e) => { console.error("\n❌", e); process.exit(1); });
