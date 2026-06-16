// components/CommentThread.tsx
// Renders comments for a post as a 1-level thread: top-level comments, each with
// its replies nested beneath and a per-comment reply box.
"use client";

import { useState } from "react";
import CommentForm from "@/components/CommentForm";
import ReportButton from "@/components/ReportButton";
import type { Comment } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function CommentThread({
  postId,
  comments,
}: {
  postId: string;
  comments: Comment[];
}) {
  const topLevel = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  if (comments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No replies yet. Start the conversation.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {topLevel.map((c) => (
        <CommentItem key={c._id} postId={postId} comment={c} replies={repliesOf(c._id)} />
      ))}
    </div>
  );
}

function CommentItem({
  postId,
  comment,
  replies,
}: {
  postId: string;
  comment: Comment;
  replies: Comment[];
}) {
  const [replying, setReplying] = useState(false);

  return (
    <div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs">🕶️</span>
          <span className="font-medium">@{comment.authorUsername}</span>
          <span className="text-muted-foreground">· {timeAgo(comment.createdAt)}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{comment.content}</p>
        <div className="mt-2 flex items-center gap-4">
          <button
            onClick={() => setReplying((v) => !v)}
            className="text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            Reply
          </button>
          <ReportButton targetType="comment" targetId={comment._id} />
        </div>
      </div>

      {/* replies */}
      {(replies.length > 0 || replying) && (
        <div className="ml-5 mt-3 space-y-3 border-l border-border pl-4">
          {replies.map((r) => (
            <div key={r._id} className="rounded-2xl border border-border bg-card/60 p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">@{r.authorUsername}</span>
                <span className="text-muted-foreground">· {timeAgo(r.createdAt)}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{r.content}</p>
            </div>
          ))}

          {replying && (
            <CommentForm
              postId={postId}
              parentId={comment._id}
              placeholder={`Reply to @${comment.authorUsername}…`}
              onDone={() => setReplying(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
