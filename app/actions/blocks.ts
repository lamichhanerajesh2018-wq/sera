// app/actions/blocks.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import type { Block } from "@/lib/types";

function toBlock(doc: any): Block {
  return {
    _id: doc._id.toString(),
    blockerId: doc.blockerId,
    blockedId: doc.blockedId,
    blockedUsername: doc.blockedUsername,
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
  };
}

// Block another user by username. They'll no longer be able to message, ask, or
// chat with the blocker.
export async function blockUser(username: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "You must be signed in." };

  const handle = username.trim().toLowerCase();
  if (!handle) return { error: "Missing user." };

  const myUsername = ((me as any).username || "").toLowerCase();
  if (handle === myUsername) return { error: "You can't block yourself." };

  const target = await db.collection("user").findOne({ username: handle });
  if (!target) return { error: "No one here goes by that name." };

  const blockedId = target._id.toString();

  // Idempotent: don't create duplicate blocks.
  const existing = await db
    .collection("blocks")
    .findOne({ blockerId: me.id, blockedId });
  if (existing) return { ok: true, already: true };

  await db.collection("blocks").insertOne({
    blockerId: me.id,
    blockedId,
    blockedUsername: target.username,
    createdAt: new Date(),
  });

  revalidatePath(`/u/${target.username}`);
  revalidatePath("/settings/blocks");
  return { ok: true };
}

export async function unblockUser(username: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "You must be signed in." };

  const handle = username.trim().toLowerCase();
  if (!handle) return { error: "Missing user." };

  await db.collection("blocks").deleteOne({
    blockerId: me.id,
    blockedUsername: handle,
  });

  revalidatePath(`/u/${handle}`);
  revalidatePath("/settings/blocks");
  return { ok: true };
}

// Everyone the current user has blocked, newest first.
export async function listBlocks(): Promise<Block[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  const docs = await db
    .collection("blocks")
    .find({ blockerId: me.id })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return docs.map(toBlock);
}

// Does the current user block this username? (For showing block/unblock state.)
export async function amIBlocking(username: string): Promise<boolean> {
  const me = await getCurrentUser();
  if (!me) return false;
  const handle = username.trim().toLowerCase();
  const doc = await db
    .collection("blocks")
    .findOne({ blockerId: me.id, blockedUsername: handle });
  return !!doc;
}

// ---- internal helpers used by other actions (chat/questions) -------------

// Has `recipientId` blocked the user with id `senderId`? Used to silently stop
// blocked users from reaching the recipient. Exported for server-action use.
export async function isBlocked(recipientId: string, senderId: string): Promise<boolean> {
  if (!recipientId || !senderId) return false;
  const doc = await db
    .collection("blocks")
    .findOne({ blockerId: recipientId, blockedId: senderId });
  return !!doc;
}

// Either direction blocked? (A blocked B, or B blocked A.) Used for chat, where
// a block should sever the conversation both ways.
export async function isBlockedEitherWay(userA: string, userB: string): Promise<boolean> {
  if (!userA || !userB) return false;
  const doc = await db.collection("blocks").findOne({
    $or: [
      { blockerId: userA, blockedId: userB },
      { blockerId: userB, blockedId: userA },
    ],
  });
  return !!doc;
}
