// app/actions/notifications.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import type { Notification, NotificationType } from "@/lib/types";

function toNotification(doc: any): Notification {
  return {
    _id: doc._id.toString(),
    userId: doc.userId,
    type: doc.type,
    text: doc.text,
    link: doc.link,
    read: !!doc.read,
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
  };
}

// Internal helper — create a notification for a user. Called from other actions
// (e.g. when someone asks a question or replies). Not exported to the client.
export async function notify(
  userId: string,
  type: NotificationType,
  text: string,
  link: string
) {
  try {
    await db.collection("notifications").insertOne({
      userId,
      type,
      text,
      link,
      read: false,
      createdAt: new Date(),
    });
  } catch {
    // Notifications are best-effort — never block the triggering action.
  }
}

export async function listNotifications(): Promise<Notification[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  const docs = await db
    .collection("notifications")
    .find({ userId: me.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  return docs.map(toNotification);
}

export async function unreadNotificationCount(): Promise<number> {
  const me = await getCurrentUser();
  if (!me) return 0;
  return db.collection("notifications").countDocuments({ userId: me.id, read: false });
}

export async function markAllRead() {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  await db
    .collection("notifications")
    .updateMany({ userId: me.id, read: false }, { $set: { read: true } });
  revalidatePath("/notifications");
  return { ok: true };
}
