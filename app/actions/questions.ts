// app/actions/questions.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { logSafetyEvent } from "@/lib/safety-log";
import { checkAskRateLimit } from "@/lib/rate-limit";
import { isBlocked } from "@/app/actions/blocks";
import { moderateText } from "@/lib/moderation";
import { notify } from "@/app/actions/notifications";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import type { AnonQuestion } from "@/lib/types";

function toQuestion(doc: any): AnonQuestion {
  return {
    _id: doc._id.toString(),
    recipientId: doc.recipientId,
    recipientUsername: doc.recipientUsername,
    content: doc.content,
    answer: doc.answer ?? null,
    answeredAt: doc.answeredAt
      ? (doc.answeredAt instanceof Date ? doc.answeredAt : new Date(doc.answeredAt)).toISOString()
      : null,
    isPublic: !!doc.isPublic,
    reactions: doc.reactions ?? {},
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
  };
}

// Send an anonymous message/question to a user (by username). No login is
// required — anyone can send. Abuse is contained by IP-hash rate limiting and
// AI moderation. The recipient never learns who sent it.
export async function askQuestion(recipientUsername: string, content: string) {
  // Sender MAY be signed in, but it's not required. If they are, we record it
  // in the safety log (never shown to the recipient); if not, only the IP hash
  // is used, for rate limiting.
  const me = await getCurrentUser();

  const handle = recipientUsername.trim().toLowerCase();
  const text = content.trim();

  if (!handle) return { error: "Missing recipient." };
  if (text.length < 1) return { error: "Write a message first." };
  if (text.length > 1000) return { error: "Message is too long (max 1000)." };

  const recipient = await db.collection("user").findOne({ username: handle });
  if (!recipient) return { error: "No one here goes by that name." };

  if (me && recipient._id.toString() === me.id) {
    return { error: "You can't message yourself." };
  }

  // If the sender is signed in and the recipient has blocked them, silently
  // stop the message. (We return a soft, non-revealing message.)
  if (me && (await isBlocked(recipient._id.toString(), me.id))) {
    return { error: "You can't send a message to this person." };
  }

  // Rate limit by hashed IP (per recipient + overall) before doing more work.
  const rl = await checkAskRateLimit(recipient._id.toString());
  if (!rl.ok) return { error: rl.reason };

  // Anonymous messages are a common abuse vector — moderate before delivery.
  const mod = await moderateText(text);
  if (!mod.allowed) return { error: mod.reason };

  await db.collection("questions").insertOne({
    recipientId: recipient._id.toString(),
    recipientUsername: recipient.username,
    // Sender recorded for safety/abuse handling ONLY if signed in — NEVER exposed
    // to the recipient. Anonymous senders have no id here.
    askedById: me?.id ?? null,
    content: text,
    answer: null,
    answeredAt: null,
    isPublic: false,
    reactions: {},
    createdAt: new Date(),
  });

  // Disclosed safety log (hashed IP). Only ties to a user when signed in.
  if (me) await logSafetyEvent(me.id, "question");

  // Notify the recipient (without revealing who asked).
  await notify(
    recipient._id.toString(),
    "question",
    "You received an anonymous message.",
    "/inbox"
  );

  return { ok: true };
}

// The signed-in user's received questions, newest first.
export async function listInbox(): Promise<AnonQuestion[]> {
  const me = await getCurrentUser();
  if (!me) return [];

  const docs = await db
    .collection("questions")
    .find({ recipientId: me.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  return docs.map(toQuestion);
}

// Count of unanswered questions — used for an inbox badge.
export async function inboxUnreadCount(): Promise<number> {
  const me = await getCurrentUser();
  if (!me) return 0;
  return db.collection("questions").countDocuments({ recipientId: me.id, answer: null });
}

// Answer one of your questions. `isPublic` decides whether the answer shows on
// your public profile wall, or stays private in your inbox only.
export async function answerQuestion(
  questionId: string,
  answer: string,
  isPublic = false
) {
  const me = await getCurrentUser();
  if (!me || !ObjectId.isValid(questionId)) return { error: "Invalid request." };

  const text = answer.trim();
  if (text.length < 1) return { error: "Write an answer first." };
  if (text.length > 2000) return { error: "Answer is too long." };

  // Moderate the answer too — a public answer is visible content.
  const mod = await moderateText(text);
  if (!mod.allowed) return { error: mod.reason };

  const q = await db
    .collection("questions")
    .findOne({ _id: new ObjectId(questionId), recipientId: me.id });
  if (!q) return { error: "Question not found." };

  await db.collection("questions").updateOne(
    { _id: new ObjectId(questionId) },
    { $set: { answer: text, answeredAt: new Date(), isPublic: !!isPublic } }
  );

  revalidatePath("/inbox");
  // If public, the recipient's profile wall changes too.
  const handle = (me as any).username || (me as any).displayUsername;
  if (isPublic && handle) revalidatePath(`/u/${handle}`);
  return { ok: true };
}

// Flip an already-answered question between public and private.
export async function setAnswerVisibility(questionId: string, isPublic: boolean) {
  const me = await getCurrentUser();
  if (!me || !ObjectId.isValid(questionId)) return { error: "Invalid request." };

  const q = await db
    .collection("questions")
    .findOne({ _id: new ObjectId(questionId), recipientId: me.id });
  if (!q) return { error: "Question not found." };
  if (!q.answer) return { error: "Answer it first." };

  await db.collection("questions").updateOne(
    { _id: new ObjectId(questionId) },
    { $set: { isPublic: !!isPublic } }
  );

  revalidatePath("/inbox");
  const handle = (me as any).username || (me as any).displayUsername;
  if (handle) revalidatePath(`/u/${handle}`);
  return { ok: true };
}

// Public answered questions for a user's profile wall (by username). Only
// answers the recipient explicitly made public are returned, newest first.
// The asker is always anonymous.
export async function listPublicAnswers(username: string): Promise<AnonQuestion[]> {
  const handle = username.trim().toLowerCase();
  if (!handle) return [];

  const docs = await db
    .collection("questions")
    .find({
      recipientUsername: handle,
      isPublic: true,
      answer: { $ne: null },
    })
    .sort({ answeredAt: -1 })
    .limit(50)
    .toArray();

  return docs.map(toQuestion);
}

// Recipient reacts to a message they received (toggle). Allowed emojis only.
// Reactions are private to the recipient's inbox (used for fun + screenshots).
const ALLOWED_REACTIONS = ["❤️", "👍", "👀"];

export async function reactToQuestion(questionId: string, emoji: string) {
  const me = await getCurrentUser();
  if (!me || !ObjectId.isValid(questionId)) return { error: "Invalid request." };
  if (!ALLOWED_REACTIONS.includes(emoji)) return { error: "Invalid reaction." };

  const q = await db
    .collection("questions")
    .findOne({ _id: new ObjectId(questionId), recipientId: me.id });
  if (!q) return { error: "Message not found." };

  const current = (q.reactions ?? {})[emoji] ?? 0;
  // Toggle: if already reacted (count > 0), remove it; else add.
  const update = current > 0
    ? { $unset: { [`reactions.${emoji}`]: "" } }
    : { $set: { [`reactions.${emoji}`]: 1 } };

  await db.collection("questions").updateOne({ _id: new ObjectId(questionId) }, update);

  revalidatePath("/inbox");
  return { ok: true, reacted: current === 0 };
}

// Delete a question from your inbox.
export async function deleteQuestion(questionId: string) {
  const me = await getCurrentUser();
  if (!me || !ObjectId.isValid(questionId)) return { error: "Invalid request." };

  await db
    .collection("questions")
    .deleteOne({ _id: new ObjectId(questionId), recipientId: me.id });

  revalidatePath("/inbox");
  return { ok: true };
}
