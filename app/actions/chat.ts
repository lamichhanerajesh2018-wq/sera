// app/actions/chat.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { pusherServer } from "@/lib/pusher";
import { moderateText } from "@/lib/moderation";
import { notify } from "@/app/actions/notifications";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import type { Conversation, Message } from "@/lib/types";

function toConversation(doc: any, viewerId: string): Conversation {
  const otherIdx = doc.participantIds[0] === viewerId ? 1 : 0;
  return {
    _id: doc._id.toString(),
    participantIds: doc.participantIds,
    participantUsernames: doc.participantUsernames,
    lastMessage: doc.lastMessage ?? "",
    lastMessageAt: (doc.lastMessageAt instanceof Date ? doc.lastMessageAt : new Date(doc.lastMessageAt)).toISOString(),
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
    otherUsername: doc.participantUsernames[otherIdx],
  };
}

function toMessage(doc: any): Message {
  return {
    _id: doc._id.toString(),
    conversationId: doc.conversationId,
    senderId: doc.senderId,
    senderUsername: doc.senderUsername,
    content: doc.content,
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
  };
}

// Start (or reuse) a 1-on-1 conversation with another user by their username.
export async function startConversation(otherUsername: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "You must be signed in." };

  const handle = otherUsername.trim().toLowerCase();
  if (!handle) return { error: "Enter a username." };

  const myUsername = ((me as any).username || "").toLowerCase();
  if (handle === myUsername) return { error: "You can't message yourself." };

  // Find the other user.
  const other = await db.collection("user").findOne({ username: handle });
  if (!other) return { error: "No one here goes by that name." };

  const otherId = other._id.toString();

  // A sorted pair of ids uniquely identifies a conversation.
  const pair = [me.id, otherId].sort();

  const existing = await db.collection("conversations").findOne({
    participantIds: pair,
  });

  if (existing) {
    return { ok: true, conversationId: existing._id.toString() };
  }

  const now = new Date();
  const usernames =
    pair[0] === me.id ? [myUsername, other.username] : [other.username, myUsername];

  const result = await db.collection("conversations").insertOne({
    participantIds: pair,
    participantUsernames: usernames,
    lastMessage: "",
    lastMessageAt: now,
    createdAt: now,
  });

  return { ok: true, conversationId: result.insertedId.toString() };
}

// All conversations the current user is part of, most recent first.
export async function listConversations(): Promise<Conversation[]> {
  const me = await getCurrentUser();
  if (!me) return [];

  const docs = await db
    .collection("conversations")
    .find({ participantIds: me.id })
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .toArray();

  return docs.map((d) => toConversation(d, me.id));
}

// Verify the viewer belongs to a conversation, and return it.
export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const me = await getCurrentUser();
  if (!me || !ObjectId.isValid(conversationId)) return null;

  const doc = await db
    .collection("conversations")
    .findOne({ _id: new ObjectId(conversationId), participantIds: me.id });

  return doc ? toConversation(doc, me.id) : null;
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const me = await getCurrentUser();
  if (!me || !ObjectId.isValid(conversationId)) return [];

  // Only participants can read.
  const convo = await db
    .collection("conversations")
    .findOne({ _id: new ObjectId(conversationId), participantIds: me.id });
  if (!convo) return [];

  const docs = await db
    .collection("messages")
    .find({ conversationId })
    .sort({ createdAt: 1 })
    .limit(500)
    .toArray();

  return docs.map(toMessage);
}

// Send a message: save to DB, then push it to the other participant in realtime.
export async function sendMessage(conversationId: string, content: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "You must be signed in." };
  if (!ObjectId.isValid(conversationId)) return { error: "Invalid conversation." };

  const text = content.trim();
  if (!text) return { error: "Message can't be empty." };
  if (text.length > 2000) return { error: "Message is too long." };

  const mod = await moderateText(text);
  if (!mod.allowed) return { error: mod.reason };

  const convo = await db
    .collection("conversations")
    .findOne({ _id: new ObjectId(conversationId), participantIds: me.id });
  if (!convo) return { error: "Conversation not found." };

  const myUsername = (me as any).username || (me as any).displayUsername || "anon";
  const now = new Date();

  const result = await db.collection("messages").insertOne({
    conversationId,
    senderId: me.id,
    senderUsername: myUsername,
    content: text,
    createdAt: now,
  });

  await db.collection("conversations").updateOne(
    { _id: new ObjectId(conversationId) },
    { $set: { lastMessage: text, lastMessageAt: now } }
  );

  const message: Message = {
    _id: result.insertedId.toString(),
    conversationId,
    senderId: me.id,
    senderUsername: myUsername,
    content: text,
    createdAt: now.toISOString(),
  };

  // Realtime: broadcast to everyone subscribed to this conversation's channel.
  await pusherServer.trigger(`conversation-${conversationId}`, "new-message", message);

  // Notify the other participant.
  const otherId = convo.participantIds.find((id) => id !== me.id);
  if (otherId) {
    await notify(otherId, "message", "You have a new anonymous message.", `/chat/${conversationId}`);
  }

  revalidatePath("/chat");
  return { ok: true, message };
}
