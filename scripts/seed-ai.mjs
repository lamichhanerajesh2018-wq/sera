// scripts/seed-ai.mjs
// AI-powered seed: generates a large volume of realistic, varied content using
// OpenAI (gpt-4o-mini), then inserts it. Produces ~500 confession posts,
// ~200 anonymous Q&A, and ~100 short DM conversations, all attributed to
// anonymous sera-XXXX authors. Safe to re-run — clears prior seed (seed: true).
//
// Run with:  node scripts/seed-ai.mjs
// Needs MONGODB_URI and OPENAI_API_KEY in .env.local.
//
// Tuning (env or edit below):
//   POSTS_TARGET (default 500), QA_TARGET (200), CHATS_TARGET (100)

import { MongoClient, ObjectId } from "mongodb";
import { readFileSync } from "fs";

// ---------- env ----------
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
function readEnv(key) {
  const line = env.split("\n").find((l) => l.startsWith(`${key}=`));
  return line?.replace(`${key}=`, "").trim().replace(/^["']|["']$/g, "");
}
const MONGODB_URI = readEnv("MONGODB_URI");
const OPENAI_API_KEY = readEnv("OPENAI_API_KEY");

if (!MONGODB_URI) { console.error("❌ MONGODB_URI missing in .env.local"); process.exit(1); }
if (!OPENAI_API_KEY) { console.error("❌ OPENAI_API_KEY missing in .env.local"); process.exit(1); }

const POSTS_TARGET = Number(process.env.POSTS_TARGET || 500);
const QA_TARGET = Number(process.env.QA_TARGET || 200);
const CHATS_TARGET = Number(process.env.CHATS_TARGET || 100);

const client = new MongoClient(MONGODB_URI);

// ---------- authors ----------
const AUTHORS = Array.from({ length: 40 }, () => {
  const n = 1000 + Math.floor(Math.random() * 9000);
  return `sera-${n}`;
});
// de-dupe
const UNIQUE_AUTHORS = [...new Set(AUTHORS)];

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

// ---------- communities ----------
const COMMUNITIES = [
  { name: "confessions", description: "Say the thing you can't say anywhere else." },
  { name: "late night thoughts", description: "For the words that only come after midnight." },
  { name: "mental health", description: "A quiet, judgment-free space to be honest about how you're doing." },
  { name: "relationships", description: "Love, heartbreak, and everything tangled in between." },
  { name: "work & burnout", description: "The stuff you can't tell your coworkers." },
  { name: "student life", description: "Exams, doubt, pressure, and the occasional small win." },
  { name: "family", description: "The complicated people we don't get to choose." },
  { name: "anxiety", description: "For the spirals, the what-ifs, and the 3am worries." },
  { name: "small wins", description: "Celebrate the little things. They count more than you think." },
  { name: "lonely hearts", description: "When you just need to feel a little less alone." },
  { name: "unsent letters", description: "Things you'd say if you ever had the courage." },
  { name: "starting over", description: "New cities, new selves, fresh starts of every kind." },
];

// Topic prompts paired to communities (and a "general" bucket) so AI output is
// varied and on-theme. null slug = general feed.
const TOPICS = [
  { slug: null, theme: "general life confessions, everyday honesty, quiet realizations" },
  { slug: "confessions", theme: "secrets and admissions people can't say out loud" },
  { slug: "late-night-thoughts", theme: "2am thoughts, insomnia musings, things that surface in the dark" },
  { slug: "mental-health", theme: "honest mental health check-ins, therapy, small recoveries, hard days" },
  { slug: "relationships", theme: "love, heartbreak, situationships, longing, quiet relationship truths" },
  { slug: "work-burnout", theme: "job burnout, quitting, career doubt, workplace exhaustion" },
  { slug: "student-life", theme: "exams, academic pressure, imposter feelings, small student wins" },
  { slug: "family", theme: "complicated family dynamics, distance, love and guilt with parents/siblings" },
  { slug: "anxiety", theme: "anxiety spirals, overthinking, social fears, brave small steps" },
  { slug: "small-wins", theme: "tiny everyday victories worth celebrating" },
  { slug: "lonely-hearts", theme: "loneliness, isolation, wishing for connection" },
  { slug: "unsent-letters", theme: "letters never sent to exes, friends, family, past selves" },
  { slug: "starting-over", theme: "fresh starts, new cities, leaving things behind, reinvention" },
];

// ---------- OpenAI helper ----------
async function chatJSON(system, user) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 1.0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

// Generate a batch of confession lines for one topic.
async function genPosts(theme, count) {
  const out = await chatJSON(
    "You write short, raw, anonymous confession-style social posts for a mental-health-friendly anonymous app. Each is 1-3 sentences, first person, emotionally honest, varied in tone (some hopeful, some heavy, some hopeful-after-pain, a few light). No hashtags, no emojis, no quotation marks. Never harmful to others. Return strict JSON.",
    `Theme: ${theme}. Write ${count} DISTINCT posts. Return JSON: {"posts": ["...", "..."]}.`
  );
  return Array.isArray(out.posts) ? out.posts : [];
}

// Generate Q&A pairs (anonymous question + the recipient's answer).
async function genQA(count) {
  const out = await chatJSON(
    "You generate anonymous Q&A for an NGL-style app: a short anonymous QUESTION someone sends, and a warm, real ANSWER the recipient writes back. Questions are curious, kind, or vulnerable. Answers are 1-2 sentences, honest, human. No emojis, no quotes. Return strict JSON.",
    `Write ${count} DISTINCT pairs. Return JSON: {"qa": [{"q":"...","a":"..."}, ...]}.`
  );
  return Array.isArray(out.qa) ? out.qa : [];
}

// Generate short DM exchanges (3-4 lines, alternating speakers).
async function genChats(count) {
  const out = await chatJSON(
    "You generate short, kind anonymous DM exchanges between two strangers on a supportive anonymous app. Each exchange is 3-4 messages, alternating speakers (A, B, A, B), warm and human, reacting to someone's post or just connecting. No emojis, no quotes. Return strict JSON.",
    `Write ${count} DISTINCT exchanges. Return JSON: {"chats": [["A line","B line","A line"], ...]}.`
  );
  return Array.isArray(out.chats) ? out.chats : [];
}

async function run() {
  console.log("🤖 AI seed starting…");
  await client.connect();
  const db = client.db();
  console.log("🌱 DB:", db.databaseName);

  const users = db.collection("user");
  const communities = db.collection("communities");
  const posts = db.collection("posts");
  const comments = db.collection("comments");
  const questions = db.collection("questions");
  const conversations = db.collection("conversations");
  const messages = db.collection("messages");

  // clear prior seed
  await Promise.all([
    users.deleteMany({ seed: true }),
    communities.deleteMany({ seed: true }),
    posts.deleteMany({ seed: true }),
    comments.deleteMany({ seed: true }),
    questions.deleteMany({ seed: true }),
    conversations.deleteMany({ seed: true }),
    messages.deleteMany({ seed: true }),
  ]);
  console.log("🧹 Cleared previous seed data");

  const now = Date.now();
  const EMOJIS = ["🔥", "😂", "😮", "💜", "😢"];

  // authors
  const authorIds = {};
  for (let i = 0; i < UNIQUE_AUTHORS.length; i++) {
    const username = UNIQUE_AUTHORS[i];
    const id = new ObjectId();
    authorIds[i] = id;
    await users.insertOne({
      _id: id, name: username, username, displayUsername: username,
      email: `${username}@seed.sera`, emailVerified: false, seed: true,
      createdAt: new Date(now - rand(60) * 86400000), updatedAt: new Date(),
    });
  }
  const A = UNIQUE_AUTHORS.length;
  console.log(`👤 ${A} authors`);

  // communities
  const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
  const communityBySlug = {};
  for (let i = 0; i < COMMUNITIES.length; i++) {
    const c = COMMUNITIES[i];
    const slug = slugify(c.name);
    const id = new ObjectId();
    communityBySlug[slug] = id;
    await communities.insertOne({
      _id: id, name: c.name, slug, description: c.description,
      creatorId: authorIds[i % A].toString(), memberCount: 20 + rand(400),
      seed: true, createdAt: new Date(now - (i + 1) * 172800000),
    });
  }
  console.log(`🌐 ${COMMUNITIES.length} communities`);

  // ---------- POSTS ----------
  // Spread POSTS_TARGET across topics; generate in batches of ~25 per call.
  const perTopic = Math.ceil(POSTS_TARGET / TOPICS.length);
  let postTotal = 0;
  const postIds = [];
  for (const topic of TOPICS) {
    let remaining = perTopic;
    while (remaining > 0 && postTotal < POSTS_TARGET) {
      const batch = Math.min(25, remaining, POSTS_TARGET - postTotal);
      let lines = [];
      try {
        lines = await genPosts(topic.theme, batch);
      } catch (e) {
        console.warn("  ⚠️ post batch failed, retrying once:", e.message);
        try { lines = await genPosts(topic.theme, batch); } catch { lines = []; }
      }
      for (const text of lines) {
        if (!text || typeof text !== "string") continue;
        const slug = topic.slug || "";
        const communityId = slug ? communityBySlug[slug]?.toString() ?? "" : "";
        const id = new ObjectId();
        postIds.push(id);
        const reactions = {};
        if (Math.random() > 0.4) {
          const e = EMOJIS[rand(EMOJIS.length)];
          reactions[e] = 1 + rand(12);
        }
        await posts.insertOne({
          _id: id, content: text.trim(),
          authorId: authorIds[rand(A)].toString(),
          authorUsername: UNIQUE_AUTHORS[rand(A)],
          communityId, communitySlug: slug,
          likeCount: rand(80), reactions, commentCount: 0,
          seed: true,
          createdAt: new Date(now - rand(POSTS_TARGET) * 1200000),
        });
        postTotal++;
      }
      remaining -= batch;
      process.stdout.write(`\r📝 posts: ${postTotal}/${POSTS_TARGET}`);
    }
  }
  console.log(`\n📝 ${postTotal} posts`);

  // ---------- COMMENTS (light: ~40% of posts get 1-2) ----------
  const COMMENTS = [
    "this hit harder than i expected.", "i could've written this myself.",
    "sending you strength tonight.", "thank you for saying it out loud.",
    "i needed to read this today.", "you're braver than you think.",
    "same. every word.", "i hope it gets lighter soon.",
    "rooting for you, stranger.", "the fact that you're still here matters.",
  ];
  let cCount = 0;
  for (const pid of postIds) {
    if (Math.random() > 0.4) continue;
    const howMany = 1 + rand(2);
    for (let c = 0; c < howMany; c++) {
      const ai = rand(A);
      await comments.insertOne({
        postId: pid.toString(), content: pick(COMMENTS),
        authorId: authorIds[ai].toString(), authorUsername: UNIQUE_AUTHORS[ai],
        parentId: null, seed: true,
        createdAt: new Date(now - rand(POSTS_TARGET) * 1200000),
      });
      cCount++;
    }
    await posts.updateOne({ _id: pid }, { $set: { commentCount: howMany } });
  }
  console.log(`💬 ${cCount} comments`);

  // ---------- Q&A ----------
  let qaTotal = 0;
  while (qaTotal < QA_TARGET) {
    const batch = Math.min(25, QA_TARGET - qaTotal);
    let pairs = [];
    try { pairs = await genQA(batch); }
    catch (e) { console.warn("  ⚠️ qa batch failed:", e.message); }
    for (const p of pairs) {
      if (!p?.q) continue;
      const recipientIdx = rand(A);
      const senderIdx = (recipientIdx + 1 + rand(A - 1)) % A;
      const answered = !!p.a && Math.random() > 0.2;
      const reactions = {};
      if (answered && Math.random() > 0.5) reactions[pick(["❤️", "👀", "🙏", "😂"])] = 1 + rand(5);
      await questions.insertOne({
        recipientId: authorIds[recipientIdx].toString(),
        recipientUsername: UNIQUE_AUTHORS[recipientIdx],
        senderId: authorIds[senderIdx].toString(),
        content: String(p.q).trim(),
        answer: answered ? String(p.a).trim() : null,
        answeredAt: answered ? new Date(now - rand(60) * 3600000) : null,
        isPublic: answered, reactions, seed: true,
        createdAt: new Date(now - rand(QA_TARGET) * 3600000),
      });
      qaTotal++;
    }
    process.stdout.write(`\r❓ qa: ${qaTotal}/${QA_TARGET}`);
  }
  console.log(`\n❓ ${qaTotal} Q&A`);

  // ---------- CHATS ----------
  let chatTotal = 0;
  let msgTotal = 0;
  while (chatTotal < CHATS_TARGET) {
    const batch = Math.min(20, CHATS_TARGET - chatTotal);
    let exchanges = [];
    try { exchanges = await genChats(batch); }
    catch (e) { console.warn("  ⚠️ chat batch failed:", e.message); }
    for (const ex of exchanges) {
      if (!Array.isArray(ex) || ex.length < 2) continue;
      const a = rand(A);
      let b = rand(A);
      while (b === a) b = rand(A);
      const idA = authorIds[a].toString();
      const idB = authorIds[b].toString();
      const pair = [idA, idB].sort();
      const usernames = pair[0] === idA ? [UNIQUE_AUTHORS[a], UNIQUE_AUTHORS[b]] : [UNIQUE_AUTHORS[b], UNIQUE_AUTHORS[a]];
      const convoId = new ObjectId();
      const base = now - rand(CHATS_TARGET) * 3600000;
      let last = "", lastAt = base;
      for (let m = 0; m < ex.length; m++) {
        const senderIdx = m % 2 === 0 ? a : b;
        const at = new Date(base + m * 300000);
        await messages.insertOne({
          conversationId: convoId.toString(),
          senderId: authorIds[senderIdx].toString(),
          senderUsername: UNIQUE_AUTHORS[senderIdx],
          content: String(ex[m]).trim(), seed: true, createdAt: at,
        });
        last = String(ex[m]).trim(); lastAt = at; msgTotal++;
      }
      await conversations.insertOne({
        _id: convoId, participantIds: pair, participantUsernames: usernames,
        lastMessage: last, lastMessageAt: lastAt,
        status: "accepted", requestedBy: idA, seed: true,
        createdAt: new Date(base),
      });
      chatTotal++;
    }
    process.stdout.write(`\r💌 chats: ${chatTotal}/${CHATS_TARGET}`);
  }
  console.log(`\n💌 ${chatTotal} conversations, ${msgTotal} messages`);

  console.log("✅ AI seed complete.");
  await client.close();
}

run().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
