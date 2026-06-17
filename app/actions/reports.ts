// app/actions/reports.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin-auth";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import type { Report, ReportTarget } from "@/lib/types";

const COLLECTION_FOR: Record<ReportTarget, string> = {
  post: "posts",
  comment: "comments",
  message: "messages",
  question: "questions",
};

function toReport(doc: any): Report {
  return {
    _id: doc._id.toString(),
    reporterId: doc.reporterId,
    targetType: doc.targetType,
    targetId: doc.targetId,
    contentSnapshot: doc.contentSnapshot ?? "",
    authorId: doc.authorId ?? "",
    authorUsername: doc.authorUsername ?? "unknown",
    reason: doc.reason ?? "",
    status: doc.status ?? "open",
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
  };
}

// Submit a report against a piece of content.
export async function submitReport(
  targetType: ReportTarget,
  targetId: string,
  reason: string
) {
  const me = await getCurrentUser();
  if (!me) return { error: "You must be signed in to report." };
  if (!ObjectId.isValid(targetId)) return { error: "Invalid content." };

  const collname = COLLECTION_FOR[targetType];
  if (!collname) return { error: "Invalid report type." };

  // Look up the target to snapshot its content + author.
  const target = await db.collection(collname).findOne({ _id: new ObjectId(targetId) });
  if (!target) return { error: "That content no longer exists." };

  // Don't allow duplicate reports from the same user on the same item.
  const existing = await db.collection("reports").findOne({
    reporterId: me.id,
    targetType,
    targetId,
  });
  if (existing) return { ok: true, already: true };

  await db.collection("reports").insertOne({
    reporterId: me.id,
    targetType,
    targetId,
    contentSnapshot: (target.content as string) ?? "",
    authorId: (target.authorId as string) ?? (target.senderId as string) ?? "",
    authorUsername:
      (target.authorUsername as string) ?? (target.senderUsername as string) ?? "unknown",
    reason: reason.trim().slice(0, 300),
    status: "open",
    createdAt: new Date(),
  });

  return { ok: true };
}

// --- Moderator / admin actions ---
// Gated by the admin session cookie (set at /admin/login).

async function requireAdmin(): Promise<boolean> {
  return isAdmin();
}

export async function listReports(): Promise<Report[]> {
  if (!(await requireAdmin())) return [];
  const docs = await db
    .collection("reports")
    .find({})
    .sort({ status: 1, createdAt: -1 })
    .limit(200)
    .toArray();
  return docs.map(toReport);
}

// Count of open reports — for an admin badge.
export async function openReportCount(): Promise<number> {
  if (!(await requireAdmin())) return 0;
  return db.collection("reports").countDocuments({ status: "open" });
}

// Dismiss a report (content is fine).
export async function dismissReport(reportId: string) {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  if (!ObjectId.isValid(reportId)) return { error: "Invalid report." };
  await db.collection("reports").updateOne(
    { _id: new ObjectId(reportId) },
    { $set: { status: "dismissed" } }
  );
  revalidatePath("/admin/reports");
  return { ok: true };
}

// Remove the reported content and mark the report reviewed.
export async function removeReportedContent(reportId: string) {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  if (!ObjectId.isValid(reportId)) return { error: "Invalid report." };

  const report = await db.collection("reports").findOne({ _id: new ObjectId(reportId) });
  if (!report) return { error: "Report not found." };

  const collname = COLLECTION_FOR[report.targetType as ReportTarget];
  if (collname && ObjectId.isValid(report.targetId)) {
    await db.collection(collname).deleteOne({ _id: new ObjectId(report.targetId) });
  }

  await db.collection("reports").updateOne(
    { _id: new ObjectId(reportId) },
    { $set: { status: "reviewed" } }
  );
  revalidatePath("/admin/reports");
  return { ok: true };
}
