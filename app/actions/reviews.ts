// app/actions/reviews.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { moderateText } from "@/lib/moderation";
import { revalidatePath } from "next/cache";

export interface Review {
  _id: string;
  content: string;
  authorUsername: string;
  createdAt: string;
}

function toReview(doc: any): Review {
  return {
    _id: doc._id.toString(),
    content: doc.content,
    authorUsername: doc.authorUsername,
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
  };
}

export async function submitReview(
  _prev: { error?: string; success?: boolean },
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to leave a review." };

  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Review cannot be empty." };
  if (content.length > 280) return { error: "Review must be 280 characters or less." };

  // One review per user
  const coll = db.collection("reviews");
  const existing = await coll.findOne({ authorId: user.id });
  if (existing) return { error: "You've already left a review. Thank you!" };

  // AI moderation
  const mod = await moderateText(content);
  if (!mod.ok) return { error: mod.reason ?? "Your review was flagged by our safety system." };

  await coll.insertOne({
    content,
    authorId: user.id,
    authorUsername: (user as any).username ?? "anonymous",
    createdAt: new Date(),
  });

  revalidatePath("/");
  return { success: true };
}

export async function getReviews(): Promise<Review[]> {
  const coll = db.collection("reviews");
  const docs = await coll
    .find({})
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
  return docs.map(toReview);
}
