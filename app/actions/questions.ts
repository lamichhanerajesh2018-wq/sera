// app/actions/questions.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { logSafetyEvent } from "@/lib/safety-log";
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
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
  };
}

// Send an anonymous question to a user (by username). Requires being signed in,
// but the recipient never learns who asked — only the safety log records it.
export async function askQuestion(recipientUsername: string, content: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "You must be signed in to ask." };

  const handle = recipientUsername.trim().toLowerCase();
  const text = content.trim();

  if (!handle) return { error: "Missing recipient." };
  if (text.length < 1) return { error: "Write a question first." };
  if (text.length > 1000) return { error: "Question is too long (max 1000)." };

  // Anonymous questions are a common abuse vector — moderate before delivery.
  const mod = await moderateText(text);
  if (!mod.allowed) return { error: mod.reason };

  const recipient = await db.collection("user").findOne({ username: handle });
  if (!recipient) return { error: "No one here goes by that name." };

  if (recipient._id.toString() === me.id) {
    return { error: "You can't ask yourself a question." };
  }

  await db.collection("questions").insertOne({
    recipientId: recipient._id.toString(),
    recipientUsername: recipient.username,
    // Sender recorded for safety/abuse handling — NEVER exposed to recipient.
    askedById: me.id,
    content: text,
    answer: null,
    answeredAt: null,
    createdAt: new Date(),
  });

  // Disclosed safety log (hashed IP) tied to this action.
  await logSafetyEvent(me.id, "question");

  // Notify the recipient (without revealing who asked).
  await notify(
    recipient._id.toString(),
    "question",
    "Someone asked you a question anonymously.",
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

// Answer one of your questions. The answer is private — only you ever see it
// alongside the question in your inbox.
export async function answerQuestion(questionId: string, answer: string) {
  const me = await getCurrentUser();
  if (!me || !ObjectId.isValid(questionId)) return { error: "Invalid request." };

  const text = answer.trim();
  if (text.length < 1) return { error: "Write an answer first." };
  if (text.length > 2000) return { error: "Answer is too long." };

  const q = await db
    .collection("questions")
    .findOne({ _id: new ObjectId(questionId), recipientId: me.id });
  if (!q) return { error: "Question not found." };

  await db.collection("questions").updateOne(
    { _id: new ObjectId(questionId) },
    { $set: { answer: text, answeredAt: new Date() } }
  );

  revalidatePath("/inbox");
  return { ok: true };
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
