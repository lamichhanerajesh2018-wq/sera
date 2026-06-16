// app/actions/comments.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { moderateText } from "@/lib/moderation";
import { notify } from "@/app/actions/notifications";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import type { Comment } from "@/lib/types";

function toComment(doc: any): Comment {
  return {
    _id: doc._id.toString(),
    postId: doc.postId,
    content: doc.content,
    authorId: doc.authorId,
    authorUsername: doc.authorUsername,
    parentId: doc.parentId ?? null,
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
  };
}

export async function addComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const postId = String(formData.get("postId") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim() || null;

  if (!postId) return { error: "Missing post." };
  if (content.length < 1) return { error: "Comment can't be empty." };
  if (content.length > 1000) return { error: "Comment is too long (max 1000)." };

  const mod = await moderateText(content);
  if (!mod.allowed) return { error: mod.reason };

  // Confirm the post exists.
  const post = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
  if (!post) return { error: "Post not found." };

  const username = (user as any).username || (user as any).displayUsername || "anon";

  await db.collection("comments").insertOne({
    postId,
    content,
    authorId: user.id,
    authorUsername: username,
    parentId,
    createdAt: new Date(),
  });

  await db.collection("posts").updateOne(
    { _id: new ObjectId(postId) },
    { $inc: { commentCount: 1 } }
  );

  // Notify the post's author that someone replied (unless they replied to
  // their own post).
  if (post.authorId && post.authorId !== user.id) {
    await notify(
      post.authorId,
      "reply",
      "Someone replied to your post.",
      `/post/${postId}`
    );
  }

  revalidatePath("/");
  return { ok: true };
}

export async function listComments(postId: string): Promise<Comment[]> {
  const docs = await db
    .collection("comments")
    .find({ postId })
    .sort({ createdAt: 1 })
    .limit(500)
    .toArray();
  return docs.map(toComment);
}
