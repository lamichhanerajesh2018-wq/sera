// scripts/seed.mjs
// One-off seed script: inserts starter communities, anonymous author handles,
// realistic confession-style posts, comments/replies, reactions, anonymous Q&A
// (some answered + public), and 1-on-1 conversations with messages. Safe to run
// multiple times — it clears prior seed data first (only docs marked seed: true)
// so it won't touch real user content.
//
// Run with:  node scripts/seed.mjs
// Needs MONGODB_URI in .env.local.

import { MongoClient, ObjectId } from "mongodb";
import { readFileSync } from "fs";

// --- load MONGODB_URI from .env.local ---
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const uriLine = env.split("\n").find((l) => l.startsWith("MONGODB_URI="));
const MONGODB_URI = uriLine
  ?.replace("MONGODB_URI=", "")
  .trim()
  .replace(/^["']|["']$/g, "");

if (!MONGODB_URI) {
  console.error("❌ Could not find MONGODB_URI in .env.local");
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI);

// --- anonymous seed authors (15) — Sera branding ---
const AUTHORS = [
  "sera-2847", "sera-5102", "sera-7391", "sera-1664", "sera-9028",
  "sera-4475", "sera-3310", "sera-8856", "sera-6203", "sera-1129",
  "sera-7740", "sera-5598", "sera-2061", "sera-9417", "sera-3852",
];

const rand = (n) => Math.floor(Math.random() * n);
const pickAuthor = () => rand(AUTHORS.length);
const pick = (arr) => arr[rand(arr.length)];

// --- communities (12) ---
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

// --- posts: [communitySlug | null (general feed), text] ---
const POSTS = [
  // ---- general feed ----
  [null, "I smile at work every day and no one knows I cried in my car before walking in."],
  [null, "I think I've outgrown my closest friends and I don't know how to say it without hurting them."],
  [null, "Everyone keeps saying I'm doing great. I don't have the heart to tell them I'm barely holding on."],
  [null, "I'm 28 and I still have no idea what I'm doing with my life. Everyone else seems to."],
  [null, "I moved to a new city for a fresh start and somehow brought all the same problems with me."],
  [null, "I haven't told anyone, but I think I'm finally happy. It feels fragile, like I might break it by saying it out loud."],
  [null, "Today a stranger held the door and said 'you've got this.' I cried for ten minutes. I think I needed to hear it."],

  // ---- confessions ----
  ["confessions", "I told everyone I was fine after the breakup. I still check if they're online every single night."],
  ["confessions", "I pretend to be busy so I don't have to admit how lonely I actually am."],
  ["confessions", "I gave advice today that I can't follow myself."],
  ["confessions", "I act like I don't care what people think but I replay every conversation for hours."],
  ["confessions", "I'm the 'strong friend' and I have no one to call when it's my turn to fall apart."],

  // ---- late night thoughts ----
  ["late-night-thoughts", "It's 2am and I'm wondering if anyone would even notice if I went quiet for a week."],
  ["late-night-thoughts", "Sometimes the quietest part of the night is the only time I feel like myself."],
  ["late-night-thoughts", "Why do all the things I should've said come to me at midnight and never in the moment?"],
  ["late-night-thoughts", "The city's asleep and for once my mind is too loud to join it."],

  // ---- mental health ----
  ["mental-health", "Therapy is helping but some days getting out of bed still feels like winning a war."],
  ["mental-health", "I'm learning that asking for help isn't weakness. It's taken me years to believe that."],
  ["mental-health", "Took my meds, drank water, went outside for ten minutes. Small, but it's more than yesterday."],
  ["mental-health", "I'm tired of being told to 'just think positive.' Some days surviving is the positive."],

  // ---- relationships ----
  ["relationships", "We text every day but I think we're already strangers. Neither of us will say it first."],
  ["relationships", "I love them. I'm just not sure I'm in love anymore, and the guilt is eating me alive."],
  ["relationships", "I keep choosing people who can't choose me back. I think I'm scared of the ones who would."],
  ["relationships", "He remembered my coffee order after one mention. It's such a small thing and I haven't stopped thinking about it."],

  // ---- work & burnout ----
  ["work-burnout", "I used to love this job. Now I count the hours until I can go home and feel nothing."],
  ["work-burnout", "I got the promotion everyone wanted and I've never felt emptier."],
  ["work-burnout", "I answered emails on my day off again. I don't even know who I'm trying to impress anymore."],
  ["work-burnout", "Quit the job that was killing me. Terrified and broke and somehow breathing for the first time in years."],

  // ---- student life ----
  ["student-life", "Failed an exam I studied two weeks for. Told my parents I aced it. The pressure is crushing."],
  ["student-life", "Got a small win today — first time in months I actually understood the lecture. Holding onto that."],
  ["student-life", "Everyone in my class seems to have it figured out and I'm just really good at faking it."],
  ["student-life", "Pulled my grades up after a brutal semester. Nobody clapped but I'm proud of me."],

  // ---- family ----
  ["family", "I love my parents but I had to go low-contact to finally feel like myself. The guilt never fully leaves."],
  ["family", "My sibling and I haven't spoken in a year over something neither of us even remembers clearly now."],
  ["family", "Called my mom just to talk today. We laughed about nothing for an hour. I'll miss this someday."],

  // ---- anxiety ----
  ["anxiety", "Sent one text and now I've read it 40 times wondering if it sounded weird."],
  ["anxiety", "My chest is tight for no reason I can point to. I wish I could just turn my brain down."],
  ["anxiety", "Made the phone call I'd been dreading for weeks. It took 4 minutes. The fear took 4 weeks."],

  // ---- small wins ----
  ["small-wins", "Cooked a real meal instead of skipping dinner again. Tiny, but it counts."],
  ["small-wins", "Said no to plans that would've drained me. Guilt-free, for once."],
  ["small-wins", "Went a whole day without checking their profile. Day one, but still."],

  // ---- lonely hearts ----
  ["lonely-hearts", "I have hundreds of contacts and no one I could call at 3am. How does that happen?"],
  ["lonely-hearts", "Eating alone again. I've gotten good at pretending I prefer it."],

  // ---- unsent letters ----
  ["unsent-letters", "I hope you're happy. I also hope, just a little, that you think of me when that song plays."],
  ["unsent-letters", "You never said sorry, and I think I've finally stopped waiting for it. Mostly."],
  ["unsent-letters", "Thank you for leaving. I'd never have found myself if you'd stayed."],

  // ---- starting over ----
  ["starting-over", "New city, no friends, empty apartment. Terrifying. But it's mine, and that's everything."],
  ["starting-over", "Deleted every old photo today. Not out of anger — just ready to stop living in a chapter that ended."],
];

// --- comment templates ---
const COMMENTS = [
  "this hit harder than i expected. you're not alone in it.",
  "i could've written this myself.",
  "sending you quiet strength tonight.",
  "thank you for saying the thing out loud.",
  "i needed to read this today.",
  "you're braver than you think for posting this.",
  "same. every single word.",
  "i hope it gets lighter for you soon.",
  "this is so real it stings.",
  "rooting for you, stranger.",
  "the fact that you're still here matters.",
  "i felt this one in my chest.",
];

// --- anonymous Q&A: [question, answer]. Some get answered + made public. ---
const QA = [
  ["what's something you're proud of but never say out loud?", "i rebuilt my whole life after a breakup that gutted me. no one saw the work. i did."],
  ["if you could tell your past self one thing, what would it be?", "the people who left were making room. i didn't understand that for years."],
  ["what keeps you going on the hard days?", "honestly? small things. coffee, one good song, knowing tomorrow is a clean page."],
  ["do you believe people really change?", "yes. slowly, and only when they want to. i'm proof."],
  ["what's a fear you've never told anyone?", "that i'll wake up at 40 and realize i played it too safe my whole life."],
  ["what do you wish more people understood about you?", "that 'i'm fine' is sometimes the bravest lie i tell."],
  ["best advice you've ever gotten?", "you can be a good person and still be someone's lesson in what to walk away from."],
  ["what does happiness look like for you now?", "quieter than i expected. less applause, more peace."],
];

// --- DM openers + replies for seeded conversations ---
const DM_OPENERS = [
  "hey, your last post really resonated with me. just wanted you to know you're not alone.",
  "i don't usually message strangers but that confession felt like mine. thank you for writing it.",
  "your words got me through a rough night. sending good energy your way.",
  "saw your post in the anxiety group — i've been there. it does get quieter, i promise.",
];
const DM_REPLIES = [
  "this means a lot, honestly. thank you for reaching out.",
  "wow. i didn't expect anyone to say that. you made my day.",
  "right back at you. we're all just figuring it out.",
  "thank you, stranger. i needed this more than you know.",
];

async function run() {
  await client.connect();
  const db = client.db();
  console.log("🌱 Seeding database:", db.databaseName);

  const users = db.collection("user");
  const communities = db.collection("communities");
  const posts = db.collection("posts");
  const comments = db.collection("comments");
  const memberships = db.collection("memberships");
  const questions = db.collection("questions");
  const conversations = db.collection("conversations");
  const messages = db.collection("messages");

  // --- clear previous seed data only ---
  await Promise.all([
    users.deleteMany({ seed: true }),
    communities.deleteMany({ seed: true }),
    posts.deleteMany({ seed: true }),
    comments.deleteMany({ seed: true }),
    memberships.deleteMany({ seed: true }),
    questions.deleteMany({ seed: true }),
    conversations.deleteMany({ seed: true }),
    messages.deleteMany({ seed: true }),
  ]);
  console.log("🧹 Cleared previous seed data");

  const now = Date.now();
  const EMOJIS = ["🔥", "😂", "😮", "💜", "😢"];

  // --- authors ---
  const authorIds = {};
  for (let i = 0; i < AUTHORS.length; i++) {
    const username = AUTHORS[i];
    const id = new ObjectId();
    authorIds[i] = id;
    await users.insertOne({
      _id: id,
      name: username,
      username,
      displayUsername: username,
      email: `${username}@seed.sera`,
      emailVerified: false,
      seed: true,
      createdAt: new Date(now - (i + 1) * 86400000),
      updatedAt: new Date(),
    });
  }
  console.log(`👤 Inserted ${AUTHORS.length} anonymous authors`);

  // --- communities ---
  const slugify = (s) =>
    s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
  const communityBySlug = {};
  for (let i = 0; i < COMMUNITIES.length; i++) {
    const c = COMMUNITIES[i];
    const slug = slugify(c.name);
    const id = new ObjectId();
    communityBySlug[slug] = id;
    await communities.insertOne({
      _id: id,
      name: c.name,
      slug,
      description: c.description,
      creatorId: authorIds[i % AUTHORS.length].toString(),
      memberCount: 8 + rand(120),
      seed: true,
      createdAt: new Date(now - (i + 1) * 172800000),
    });
  }
  console.log(`🌐 Inserted ${COMMUNITIES.length} communities`);

  // --- posts (with reactions) ---
  const postIds = [];
  for (let i = 0; i < POSTS.length; i++) {
    const [communitySlug, text] = POSTS[i];
    const slug = communitySlug ? slugify(communitySlug) : "";
    const communityId = slug ? communityBySlug[slug]?.toString() ?? "" : "";
    const id = new ObjectId();
    postIds.push(id);

    const reactions = {};
    if (Math.random() > 0.4) {
      const n = 1 + rand(3);
      for (let r = 0; r < n; r++) {
        const e = EMOJIS[rand(EMOJIS.length)];
        reactions[e] = (reactions[e] || 0) + 1 + rand(8);
      }
    }

    await posts.insertOne({
      _id: id,
      content: text,
      authorId: authorIds[pickAuthor()].toString(),
      authorUsername: AUTHORS[pickAuthor()],
      communityId,
      communitySlug: slug,
      likeCount: rand(40),
      reactions,
      commentCount: 0,
      seed: true,
      createdAt: new Date(now - (POSTS.length - i) * 2400000),
    });
  }
  console.log(`📝 Inserted ${POSTS.length} posts`);

  // --- comments (spread across ~60% of posts) ---
  let commentCount = 0;
  for (let i = 0; i < postIds.length; i++) {
    if (Math.random() > 0.6) continue;
    const howMany = 1 + rand(3);
    for (let c = 0; c < howMany; c++) {
      const ai = pickAuthor();
      await comments.insertOne({
        postId: postIds[i].toString(),
        content: COMMENTS[rand(COMMENTS.length)],
        authorId: authorIds[ai].toString(),
        authorUsername: AUTHORS[ai],
        parentId: null,
        seed: true,
        createdAt: new Date(now - rand(POSTS.length) * 2400000),
      });
      commentCount++;
    }
    await posts.updateOne({ _id: postIds[i] }, { $set: { commentCount: howMany } });
  }
  console.log(`💬 Inserted ${commentCount} comments`);

  // --- anonymous Q&A (answered + public, so profile walls have content) ---
  let qaCount = 0;
  for (let i = 0; i < QA.length; i++) {
    const [q, a] = QA[i];
    // recipient is a rotating author; sender stays anonymous (recorded, never shown)
    const recipientIdx = i % AUTHORS.length;
    const senderIdx = (i + 5) % AUTHORS.length;
    const answered = Math.random() > 0.25; // ~75% answered

    const reactions = {};
    if (answered && Math.random() > 0.5) {
      const e = pick(["❤️", "👀", "😂", "🙏"]);
      reactions[e] = 1 + rand(4);
    }

    await questions.insertOne({
      recipientId: authorIds[recipientIdx].toString(),
      recipientUsername: AUTHORS[recipientIdx],
      senderId: authorIds[senderIdx].toString(),
      content: q,
      answer: answered ? a : null,
      answeredAt: answered ? new Date(now - rand(40) * 3600000) : null,
      isPublic: answered, // answered ones show on the public profile wall
      reactions,
      seed: true,
      createdAt: new Date(now - (QA.length - i) * 7200000),
    });
    qaCount++;
  }
  console.log(`❓ Inserted ${qaCount} Q&A questions`);

  // --- conversations + messages (so the Conversations stat is real) ---
  // Pair up authors into a handful of threads, each with a short exchange.
  const PAIRS = [
    [0, 3], [1, 7], [2, 9], [4, 11], [5, 13], [6, 8], [10, 14], [12, 1],
  ];
  let convoCount = 0;
  let msgCount = 0;
  for (let i = 0; i < PAIRS.length; i++) {
    const [a, b] = PAIRS[i];
    const idA = authorIds[a].toString();
    const idB = authorIds[b].toString();
    const pair = [idA, idB].sort();
    const usernames =
      pair[0] === idA ? [AUTHORS[a], AUTHORS[b]] : [AUTHORS[b], AUTHORS[a]];

    const convoId = new ObjectId();
    const base = now - (PAIRS.length - i) * 5400000;

    // a opens, b replies, a closes — accepted thread
    const exchange = [
      { sender: a, text: pick(DM_OPENERS) },
      { sender: b, text: pick(DM_REPLIES) },
      { sender: a, text: pick(["that genuinely helped. take care of yourself.", "anytime. we look out for each other here.", "glad i reached out. talk soon?"]) },
    ];

    let last = "";
    let lastAt = base;
    for (let m = 0; m < exchange.length; m++) {
      const senderIdx = exchange[m].sender;
      const at = new Date(base + m * 600000);
      await messages.insertOne({
        conversationId: convoId.toString(),
        senderId: authorIds[senderIdx].toString(),
        senderUsername: AUTHORS[senderIdx],
        content: exchange[m].text,
        seed: true,
        createdAt: at,
      });
      last = exchange[m].text;
      lastAt = at;
      msgCount++;
    }

    await conversations.insertOne({
      _id: convoId,
      participantIds: pair,
      participantUsernames: usernames,
      lastMessage: last,
      lastMessageAt: lastAt,
      status: "accepted",
      requestedBy: idA,
      seed: true,
      createdAt: new Date(base),
    });
    convoCount++;
  }
  console.log(`💌 Inserted ${convoCount} conversations with ${msgCount} messages`);

  console.log("✅ Done seeding.");
  await client.close();
}

run().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
