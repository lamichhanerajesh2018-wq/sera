// components/PostCard.tsx
// A single confession in the feed: handle, time, content, and the like / emoji
// reaction / comment controls. Reactions update optimistically.
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toggleLike, toggleReaction } from "@/app/actions/posts";
import Avatar from "@/components/Avatar";
import ReportButton from "@/components/ReportButton";
import PostShare from "@/components/PostShare";
import type { Post } from "@/lib/types";

const EMOJIS = ["🔥", "😂", "😮", "💜", "😢"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// Detect preferred language from browser
function getUserLang(): string {
  if (typeof navigator === "undefined") return "en";
  const code = (navigator.language || "en").split("-")[0].toLowerCase();
  return ["ne","hi","es","fr","de","ja","ko","zh","ar","pt"].includes(code) ? code : "en";
}

export default function PostCard({ post, readOnly = false }: { post: Post; readOnly?: boolean }) {
  const router = useRouter();
  const [liked, setLiked] = useState(!!post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [reactions, setReactions] = useState<Record<string, number>>(post.reactions || {});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  async function onTranslate() {
    // Toggle back to original if already translated
    if (translated) { setShowOriginal((v) => !v); return; }
    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: post.content, targetLang: getUserLang() }),
      });
      const data = await res.json();
      if (data.translated) setTranslated(data.translated);
    } catch { /* silently ignore */ }
    finally { setTranslating(false); }
  }

  const displayContent = translated && !showOriginal ? translated : post.content;

  // Guests can read, but any interaction sends them to sign up.
  function gate(): boolean {
    if (readOnly) {
      router.push("/signup");
      return true;
    }
    return false;
  }

  async function onLike() {
    if (gate()) return;
    // optimistic
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    await toggleLike(post._id);
  }

  async function onReact(emoji: string) {
    if (gate()) return;
    setPickerOpen(false);
    setReactions((r) => {
      const next = { ...r };
      next[emoji] = (next[emoji] || 0) + 1;
      return next;
    });
    await toggleReaction(post._id, emoji);
  }

  const activeReactions = Object.entries(reactions).filter(([, n]) => n > 0);

  return (
    <article className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-5">
      {/* header */}
      <div className="flex items-center gap-3">
        <Link href={`/u/${post.authorUsername}`} className="shrink-0">
          <Avatar seed={post.authorUsername} size={36} />
        </Link>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Link
            href={`/u/${post.authorUsername}`}
            className="truncate font-medium transition-colors hover:text-primary"
          >
            @{post.authorUsername}
          </Link>
          <span className="shrink-0 text-muted-foreground">· {timeAgo(post.createdAt)}</span>
        </div>
      </div>

      {/* content */}
      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-7">{displayContent}</p>
      {translated && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {showOriginal ? "Showing original" : "Translated · "}
          {!showOriginal && (
            <button onClick={() => setShowOriginal(true)} className="underline underline-offset-2 hover:text-foreground">
              Show original
            </button>
          )}
        </p>
      )}

      {/* active reactions row */}
      {activeReactions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {activeReactions.map(([emoji, n]) => (
            <span
              key={emoji}
              className="flex items-center gap-1 rounded-full border border-border bg-background/40 px-2 py-0.5 text-xs"
            >
              {emoji} {n}
            </span>
          ))}
        </div>
      )}

      {/* actions */}
      <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground sm:gap-5">
        <button
          onClick={onLike}
          className={`flex items-center gap-1.5 transition-colors hover:text-primary ${liked ? "text-primary" : ""}`}
        >
          <span>{liked ? "❤️" : "🤍"}</span>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>

        <button
          onClick={() => (readOnly ? router.push("/signup") : setPickerOpen((v) => !v))}
          className="flex items-center gap-1.5 transition-colors hover:text-primary"
        >
          <span>😊</span> React
        </button>

        <Link
          href={`/post/${post._id}`}
          onClick={(e) => {
            if (readOnly) {
              e.preventDefault();
              router.push("/signup");
            }
          }}
          className="flex items-center gap-1.5 transition-colors hover:text-primary"
        >
          <span>💬</span>
          {post.commentCount > 0 ? post.commentCount : "Reply"}
        </Link>

        <PostShare
          postId={post._id}
          authorUsername={post.authorUsername}
          content={post.content}
        />

        <button
          onClick={onTranslate}
          disabled={translating}
          className="flex items-center gap-1.5 transition-colors hover:text-primary disabled:opacity-50"
          title="Translate"
        >
          <span>🌐</span>
          {translating ? "…" : translated && !showOriginal ? "Original" : "Translate"}
        </button>

        {!readOnly && (
          <div className="ml-auto">
            <ReportButton targetType="post" targetId={post._id} />
          </div>
        )}

        {/* emoji picker */}
        {pickerOpen && (
          <div className="absolute -top-12 left-16 flex gap-1 rounded-full border border-border bg-popover px-2 py-1.5 shadow-xl">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => onReact(e)}
                className="text-lg transition-transform hover:scale-125"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
