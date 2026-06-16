// app/actions/profile.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import type { Post } from "@/lib/types";

export interface PublicProfile {
  username: string;
  joinedAt: string | null;
  postCount: number;
  isMe: boolean;
}

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

// Look up a public profile by username. Only the handle, join date and posts
// are exposed — never the email or anything tying it to a real identity.
export async function getProfile(username: string): Promise<PublicProfile | null> {
  const handle = username.trim().toLowerCase();
  if (!handle) return null;

  // Better Auth stores users in the "user" collection. The username plugin
  // saves a normalized `username` field.
  const userDoc = await db
    .collection("user")
    .findOne({ username: handle });

  if (!userDoc) return null;

  const me = await getCurrentUser();
  const myUsername = me ? ((me as any).username || "").toLowerCase() : "";

  const postCount = await db
    .collection("posts")
    .countDocuments({ authorUsername: userDoc.username });

  return {
    username: userDoc.username,
    joinedAt: userDoc.createdAt
      ? (userDoc.createdAt instanceof Date
          ? userDoc.createdAt
          : new Date(userDoc.createdAt)
        ).toISOString()
      : null,
    postCount,
    isMe: myUsername === userDoc.username,
  };
}

// Posts authored by a given username, newest first.
export async function getProfilePosts(username: string): Promise<Post[]> {
  const handle = username.trim();
  if (!handle) return [];

  const me = await getCurrentUser();

  const docs = await db
    .collection("posts")
    .find({ authorUsername: handle })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  let likedIds = new Set<string>();
  if (me && docs.length > 0) {
    const rows = await db
      .collection("reactions")
      .find({
        userId: me.id,
        type: "like",
        postId: { $in: docs.map((d) => d._id.toString()) },
      })
      .toArray();
    likedIds = new Set(rows.map((r) => r.postId));
  }

  return docs.map((d) => toPost(d, likedIds.has(d._id.toString())));
}
