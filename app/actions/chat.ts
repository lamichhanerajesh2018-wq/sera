// app/actions/chat.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { pusherServer } from "@/lib/pusher";
import { moderateText } from "@/lib/moderation";
import { notify } from "@/app/actions/notifications";
import { isBlockedEitherWay } from "@/app/actions/blocks";
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
    status: doc.status ?? "accepted",
    requestedBy: doc.requestedBy ?? null,
    // True when the conversation is pending AND the viewer is the recipient
    // (i.e. it's an incoming request awaiting their accept/decline).
    isIncomingRequest: (doc.status ?? "accepted") === "pending" && doc.requestedBy !== viewerId,
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

  // If either user has blocked the other, don't allow starting a chat.
  if (await isBlockedEitherWay(me.id, otherId)) {
    return { error: "You can't start a chat with this person." };
  }

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
    // New conversations start as a request from the initiator. The recipient
    // accepts explicitly, or it auto-accepts when they reply.
    status: "pending",
    requestedBy: me.id,
  });

  return { ok: true, conversationId: result.insertedId.toString() };
}

// All ACCEPTED conversations the current user is part of, most recent first.
// Pending requests are surfaced separately via listMessageRequests().
export async function listConversations(): Promise<Conversation[]> {
  const me = await getCurrentUser();
  if (!me) return [];

  const docs = await db
    .collection("conversations")
    .find({
      participantIds: me.id,
      // Show accepted threads, plus pending ones I started (so the sender can
      // see their own outgoing request and its replies).
      $or: [{ status: "accepted" }, { status: { $exists: false } }, { requestedBy: me.id }],
    })
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .toArray();

  return docs.map((d) => toConversation(d, me.id));
}

// Incoming message requests: pending conversations where someone messaged ME
// and I haven't accepted/replied yet. Newest first.
export async function listMessageRequests(): Promise<Conversation[]> {
  const me = await getCurrentUser();
  if (!me) return [];

  const docs = await db
    .collection("conversations")
    .find({
      participantIds: me.id,
      status: "pending",
      requestedBy: { $ne: me.id },
    })
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .toArray();

  return docs.map((d) => toConversation(d, me.id));
}

// Accept an incoming request: flip it to accepted so both sides can chat freely.
export async function acceptConversation(conversationId: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "You must be signed in." };
  if (!ObjectId.isValid(conversationId)) return { error: "Invalid conversation." };

  const convo = await db.collection("conversations").findOne({
    _id: new ObjectId(conversationId),
    participantIds: me.id,
  });
  if (!convo) return { error: "Conversation not found." };
  // Only the recipient (not the requester) may accept.
  if (convo.requestedBy === me.id) return { error: "You can't accept your own request." };

  await db.collection("conversations").updateOne(
    { _id: new ObjectId(conversationId) },
    { $set: { status: "accepted" } }
  );

  revalidatePath("/chat");
  revalidatePath(`/chat/${conversationId}`);
  return { ok: true };
}

// Decline an incoming request: delete the conversation and its messages.
export async function declineConversation(conversationId: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "You must be signed in." };
  if (!ObjectId.isValid(conversationId)) return { error: "Invalid conversation." };

  const convo = await db.collection("conversations").findOne({
    _id: new ObjectId(conversationId),
    participantIds: me.id,
  });
  if (!convo) return { error: "Conversation not found." };
  if (convo.requestedBy === me.id) return { error: "You can't decline your own request." };

  await db.collection("messages").deleteMany({ conversationId });
  await db.collection("conversations").deleteOne({ _id: new ObjectId(conversationId) });

  revalidatePath("/chat");
  return { ok: true };
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

  // Block check: if the other participant has blocked me (or vice versa), stop.
  const otherId = convo.participantIds.find((id: string) => id !== me.id);
  if (otherId && (await isBlockedEitherWay(me.id, otherId))) {
    return { error: "You can no longer message this person." };
  }

  // ---- message-request gating ------------------------------------------
  const status = convo.status ?? "accepted";
  if (status === "pending") {
    const iAmRequester = convo.requestedBy === me.id;
    if (iAmRequester) {
      // Sender may send up to 3 messages before the recipient accepts, to
      // prevent using a request as a spam channel.
      const REQUEST_LIMIT = 3;
      const sentSoFar = await db
        .collection("messages")
        .countDocuments({ conversationId, senderId: me.id });
      if (sentSoFar >= REQUEST_LIMIT) {
        return {
          error: "You've reached the message-request limit. Wait for them to accept before sending more.",
        };
      }
    } else {
      // The recipient is replying — that acceptance opens the conversation.
      await db.collection("conversations").updateOne(
        { _id: new ObjectId(conversationId) },
        { $set: { status: "accepted" } }
      );
    }
  }

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

  // Notify the other participant (otherId computed above).
  if (otherId) {
    const isRequest = (convo.status ?? "accepted") === "pending" && convo.requestedBy === me.id;
    await notify(
      otherId,
      "message",
      isRequest ? "You have a new message request." : "You have a new anonymous message.",
      `/chat/${conversationId}`
    );
  }

  revalidatePath("/chat");
  return { ok: true, message };
}
