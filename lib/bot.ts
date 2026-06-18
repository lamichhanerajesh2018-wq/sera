// lib/bot.ts
// Sera AI Bot — internal server-only module. NEVER import from client components.
// The bot has three jobs:
//   1. Send a warm welcome + feature tour to every new user's inbox.
//   2. Leave genuine AI-generated comments on recent feed posts.
//   3. Teach users about features via follow-up nudges.

import { db } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { notify } from "@/app/actions/notifications";

// ---------------------------------------------------------------------------
// Bot identity
// ---------------------------------------------------------------------------

const BOT_USERNAME = "sera-ai";
const BOT_DISPLAY = "Sera AI";

// Lazy-cache the bot user's DB _id across requests in the same process.
let _botId: string | null = null;

export async function getBotUserId(): Promise<string> {
  if (_botId) return _botId;

  let bot = await db.collection("user").findOne({ username: BOT_USERNAME });

  if (!bot) {
    const res = await db.collection("user").insertOne({
      username: BOT_USERNAME,
      name: BOT_DISPLAY,
      email: "ai@sera.local",
      emailVerified: true,
      isBot: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    _botId = res.insertedId.toString();
  } else {
    _botId = bot._id.toString();
  }

  return _botId;
}

// ---------------------------------------------------------------------------
// OpenAI helper (lightweight — no SDK needed for a single fetch call)
// ---------------------------------------------------------------------------

async function chatComplete(
  system: string,
  user: string,
  maxTokens = 150
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return (data.choices?.[0]?.message?.content as string) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Welcome message — sent to new user's inbox right after signup
// ---------------------------------------------------------------------------

const WELCOME_SYSTEM = `You are Sera's friendly AI guide. Write a warm, short welcome message (under 120 words) to a brand-new anonymous user.

Explain these features naturally:
- 📬 Inbox link (sera.social/ask/YOUR-HANDLE) — share it to receive anonymous messages
- 💭 Confessions feed — post anything anonymously
- 🌐 Communities — join topic-based anonymous spaces
- 💬 Private chat — talk one-on-one without revealing identity

Tone: warm, excited, encouraging. Sound like a helpful community member, not a robot.
Do NOT say "Welcome to Sera!" as the first words — be more creative.
End with one specific tip they can do right now.`;

export async function sendWelcomeMessage(username: string): Promise<void> {
  try {
    const user = await db.collection("user").findOne({ username });
    if (!user) return;

    const generated = await chatComplete(
      WELCOME_SYSTEM,
      `New user just joined. Their anonymous handle is ${username}. Write their welcome message.`,
      200
    );

    const content =
      generated ??
      `Hey there! 👋 You're now anonymous on Sera — no names, no traces, just honest words.\n\n📬 Share your link (sera.social/ask/${username}) in your bio to receive anonymous messages.\n💭 Head to the Confessions feed to share something you can't say publicly.\n🌐 Explore Communities to find your people.\n💬 Use private Chat to talk one-on-one anonymously.\n\nFirst tip: drop your link in your Instagram story right now and see what people really think! 🚀`;

    // Insert into questions collection (the inbox)
    await db.collection("questions").insertOne({
      recipientId: user._id.toString(),
      recipientUsername: user.username,
      askedById: null,          // anonymous sender
      content,
      answer: null,
      answeredAt: null,
      isPublic: false,
      reactions: {},
      isFromBot: true,
      createdAt: new Date(),
    });

    // Push a notification so the user sees the inbox badge
    await notify(
      user._id.toString(),
      "question",
      "You have a welcome message in your inbox 👋",
      "/inbox"
    );
  } catch (err) {
    // Best-effort — never block signup
    console.error("[bot] sendWelcomeMessage failed:", err);
  }
}

// ---------------------------------------------------------------------------
// 2. Feed commenter — called by /api/bot/comment (cron or manual trigger)
// ---------------------------------------------------------------------------

const COMMENT_SYSTEM = `You are a thoughtful, empathetic community member on Sera — an anonymous confession/social platform.

Leave a short, genuine comment (under 60 words) on the confession below.
Rules:
- Be specific to what they said — no generic "Thanks for sharing!"
- Be supportive, curious, or gently thought-provoking
- Sometimes ask a short follow-up question
- Sound human, not like an AI
- Match the emotional tone of the post`;

export async function botCommentOnRecentPosts(limit = 5): Promise<number> {
  try {
    const botId = await getBotUserId();

    // Fetch recent posts that the bot hasn't commented on yet
    const recentPosts = await db
      .collection("posts")
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Filter out posts already commented on by bot
    const alreadyCommented = await db
      .collection("comments")
      .find({ authorUsername: BOT_USERNAME })
      .project({ postId: 1 })
      .toArray();

    const commentedIds = new Set(alreadyCommented.map((c) => c.postId));
    const targets = recentPosts
      .filter((p) => !commentedIds.has(p._id.toString()))
      .slice(0, limit);

    let count = 0;
    for (const post of targets) {
      const comment = await chatComplete(
        COMMENT_SYSTEM,
        `Anonymous confession: "${post.content}"`,
        80
      );

      if (!comment) continue;

      const postId = post._id.toString();

      await db.collection("comments").insertOne({
        postId,
        content: comment,
        authorId: botId,
        authorUsername: BOT_USERNAME,
        parentId: null,
        isFromBot: true,
        createdAt: new Date(),
      });

      await db.collection("posts").updateOne(
        { _id: new ObjectId(postId) },
        { $inc: { commentCount: 1 } }
      );

      // Notify post author
      if (post.authorId) {
        await notify(
          post.authorId,
          "comment",
          "Someone commented on your confession.",
          `/post/${postId}`
        );
      }

      count++;

      // Small delay between GPT calls to avoid rate limits
      await new Promise((r) => setTimeout(r, 800));
    }

    return count;
  } catch (err) {
    console.error("[bot] botCommentOnRecentPosts failed:", err);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// 3. Feature tip nudge — sent a few hours after signup as a follow-up
// ---------------------------------------------------------------------------

const TIP_SYSTEM = `You are Sera's AI guide. Send a short, friendly follow-up tip (under 80 words) to a user who joined Sera recently.

Pick ONE specific feature tip from this list and explain it concisely:
- How to share their /ask link on Instagram stories
- How to post a confession to the public feed
- How to find and join a Community that matches their interests
- How to start a private anonymous chat with someone

Be casual and encouraging. Start with an emoji.`;

export async function sendFeatureTip(username: string): Promise<void> {
  try {
    const user = await db.collection("user").findOne({ username });
    if (!user) return;

    // Only send if they haven't received a tip yet
    const existing = await db
      .collection("questions")
      .findOne({ recipientId: user._id.toString(), isFromBot: true, isTip: true });
    if (existing) return;

    const tip = await chatComplete(
      TIP_SYSTEM,
      `User handle: ${username}. Send them one feature tip.`,
      120
    );

    if (!tip) return;

    await db.collection("questions").insertOne({
      recipientId: user._id.toString(),
      recipientUsername: user.username,
      askedById: null,
      content: tip,
      answer: null,
      answeredAt: null,
      isPublic: false,
      reactions: {},
      isFromBot: true,
      isTip: true,
      createdAt: new Date(),
    });

    await notify(
      user._id.toString(),
      "question",
      "A quick tip for you in your inbox 💡",
      "/inbox"
    );
  } catch (err) {
    console.error("[bot] sendFeatureTip failed:", err);
  }
}
