// app/actions/communities.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import type { Community } from "@/lib/types";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

// Serialize a raw Mongo doc into the client-safe Community shape.
function toCommunity(doc: any): Community {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    description: doc.description ?? "",
    creatorId: doc.creatorId,
    memberCount: doc.memberCount ?? 0,
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
  };
}

export async function createCommunity(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (name.length < 3 || name.length > 30) {
    return { error: "Community name must be 3–30 characters." };
  }

  const slug = slugify(name);
  if (!slug) return { error: "Invalid community name." };

  const communities = db.collection("communities");

  // Slug must be unique.
  const existing = await communities.findOne({ slug });
  if (existing) return { error: "A community with this name already exists." };

  const now = new Date();
  const result = await communities.insertOne({
    name,
    slug,
    description,
    creatorId: user.id,
    memberCount: 1,
    createdAt: now,
  });

  // Creator auto-joins.
  await db.collection("memberships").insertOne({
    communityId: result.insertedId.toString(),
    userId: user.id,
    joinedAt: now,
  });

  revalidatePath("/communities");
  return { ok: true, slug };
}

export async function joinCommunity(communityId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const memberships = db.collection("memberships");
  const already = await memberships.findOne({ communityId, userId: user.id });

  if (already) {
    // Toggle: leave.
    await memberships.deleteOne({ _id: already._id });
    await db.collection("communities").updateOne(
      { _id: new ObjectId(communityId) },
      { $inc: { memberCount: -1 } }
    );
    revalidatePath("/communities");
    return { ok: true, joined: false };
  }

  await memberships.insertOne({
    communityId,
    userId: user.id,
    joinedAt: new Date(),
  });
  await db.collection("communities").updateOne(
    { _id: new ObjectId(communityId) },
    { $inc: { memberCount: 1 } }
  );
  revalidatePath("/communities");
  return { ok: true, joined: true };
}

export async function listCommunities(): Promise<Community[]> {
  const user = await getCurrentUser();
  const docs = await db
    .collection("communities")
    .find({})
    .sort({ memberCount: -1, createdAt: -1 })
    .limit(100)
    .toArray();

  // Mark which ones the viewer has joined.
  let joinedIds = new Set<string>();
  if (user && docs.length > 0) {
    const rows = await db
      .collection("memberships")
      .find({ userId: user.id, communityId: { $in: docs.map((d) => d._id.toString()) } })
      .toArray();
    joinedIds = new Set(rows.map((r) => r.communityId));
  }

  return docs.map((d) => ({
    ...toCommunity(d),
    isMember: joinedIds.has(d._id.toString()),
  }));
}

export async function getCommunityBySlug(slug: string): Promise<Community | null> {
  const user = await getCurrentUser();
  const doc = await db.collection("communities").findOne({ slug });
  if (!doc) return null;

  let isMember = false;
  if (user) {
    const m = await db
      .collection("memberships")
      .findOne({ userId: user.id, communityId: doc._id.toString() });
    isMember = !!m;
  }

  return { ...toCommunity(doc), isMember };
}
