// app/actions/posts.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { logSafetyEvent } from "@/lib/safety-log";
import { moderateText } from "@/lib/moderation";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import type { Post } from "@/lib/types";

function toPost(doc: any, likedByMe = false): Post {
  return {
    _id: doc._id.toString(),
    content: doc.content,
    authorId: doc.authorId,
    authorUsername: doc.authorUsername,
    communityId: doc.communityId ?? "",
    communitySlug: doc.communitySlug ?? "",
    likeCount: doc.likeCount ?? 0,
    reactions: doc.reactions ?? {},
    commentCount: doc.commentCount ?? 0,
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
    likedByMe,
  };
}

export async function createPost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const content = String(formData.get("content") ?? "").trim();
  const communitySlug = String(formData.get("communitySlug") ?? "").trim();

  if (content.length < 1) return { error: "Post can't be empty." };
  if (content.length > 2000) return { error: "Post is too long (max 2000)." };

  // AI moderation — blocks content that targets/harms others; lets confessions
  // (including expressions of personal struggle) through.
  const mod = await moderateText(content);
  if (!mod.allowed) return { error: mod.reason };

  let communityId = "";
  let resolvedSlug = "";
  if (communitySlug) {
    const community = await db.collection("communities").findOne({ slug: communitySlug });
    if (!community) return { error: "Community not found." };
    communityId = community._id.toString();
    resolvedSlug = community.slug;
  }

  // The username is the only public identity. Better Auth stores it on the user.
  const username = (user as any).username || (user as any).displayUsername || "anon";

  await db.collection("posts").insertOne({
    content,
    authorId: user.id,
    authorUsername: username,
    communityId,
    communitySlug: resolvedSlug,
    likeCount: 0,
    reactions: {},
    commentCount: 0,
    createdAt: new Date(),
  });

  // Disclosed safety log (hashed IP) tied to this action.
  await logSafetyEvent(user.id, "post");

  revalidatePath("/");
  if (resolvedSlug) revalidatePath(`/c/${resolvedSlug}`);
  return { ok: true };
}

// Which posts has the current user liked? Returns a Set of postIds.
async function likedPostIds(userId: string, postIds: ObjectId[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const rows = await db
    .collection("reactions")
    .find({ userId, type: "like", postId: { $in: postIds.map((id) => id.toString()) } })
    .toArray();
  return new Set(rows.map((r) => r.postId as string));
}

export async function listFeed(): Promise<Post[]> {
  const user = await getCurrentUser();
  const docs = await db
    .collection("posts")
    .find({})
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const liked = user ? await likedPostIds(user.id, docs.map((d) => d._id)) : new Set<string>();
  return docs.map((d) => toPost(d, liked.has(d._id.toString())));
}

export async function listCommunityPosts(communitySlug: string): Promise<Post[]> {
  const user = await getCurrentUser();
  const docs = await db
    .collection("posts")
    .find({ communitySlug })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const liked = user ? await likedPostIds(user.id, docs.map((d) => d._id)) : new Set<string>();
  return docs.map((d) => toPost(d, liked.has(d._id.toString())));
}

export async function toggleLike(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const reactions = db.collection("reactions");
  const existing = await reactions.findOne({ postId, userId: user.id, type: "like" });

  if (existing) {
    await reactions.deleteOne({ _id: existing._id });
    await db.collection("posts").updateOne(
      { _id: new ObjectId(postId) },
      { $inc: { likeCount: -1 } }
    );
    return { ok: true, liked: false };
  }

  await reactions.insertOne({ postId, userId: user.id, type: "like" });
  await db.collection("posts").updateOne(
    { _id: new ObjectId(postId) },
    { $inc: { likeCount: 1 } }
  );
  return { ok: true, liked: true };
}

// Emoji reaction — one of each emoji per user per post (toggle).
export async function toggleReaction(postId: string, emoji: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const reactions = db.collection("reactions");
  const existing = await reactions.findOne({ postId, userId: user.id, type: emoji });

  if (existing) {
    await reactions.deleteOne({ _id: existing._id });
    await db.collection("posts").updateOne(
      { _id: new ObjectId(postId) },
      { $inc: { [`reactions.${emoji}`]: -1 } }
    );
    return { ok: true, reacted: false };
  }

  await reactions.insertOne({ postId, userId: user.id, type: emoji });
  await db.collection("posts").updateOne(
    { _id: new ObjectId(postId) },
    { $inc: { [`reactions.${emoji}`]: 1 } }
  );
  return { ok: true, reacted: true };
}

// Fetch a single post by id (for the post detail / comments page).
export async function getPost(postId: string): Promise<Post | null> {
  if (!ObjectId.isValid(postId)) return null;
  const user = await getCurrentUser();
  const doc = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
  if (!doc) return null;

  let likedByMe = false;
  if (user) {
    const r = await db
      .collection("reactions")
      .findOne({ postId, userId: user.id, type: "like" });
    likedByMe = !!r;
  }
  return toPost(doc, likedByMe);
}
