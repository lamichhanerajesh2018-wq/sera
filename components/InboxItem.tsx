// components/InboxItem.tsx
// One received anonymous question, with answer/delete controls.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  answerQuestion,
  deleteQuestion,
  setAnswerVisibility,
  reactToQuestion,
} from "@/app/actions/questions";
import ReportButton from "@/components/ReportButton";
import ShareCard from "@/components/ShareCard";
import type { AnonQuestion } from "@/lib/types";

const REACTIONS = ["❤️", "👍", "👀"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function InboxItem({ question }: { question: AnonQuestion }) {
  const router = useRouter();
  const [answering, setAnswering] = useState(false);
  const [draft, setDraft] = useState("");
  const [makePublic, setMakePublic] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [pending, startTransition] = useTransition();

  function submitAnswer() {
    const text = draft.trim();
    if (!text) return;
    startTransition(async () => {
      await answerQuestion(question._id, text, makePublic);
      setAnswering(false);
      router.refresh();
    });
  }

  function toggleVisibility() {
    startTransition(async () => {
      await setAnswerVisibility(question._id, !question.isPublic);
      router.refresh();
    });
  }

  function react(emoji: string) {
    startTransition(async () => {
      await reactToQuestion(question._id, emoji);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteQuestion(question._id);
      router.refresh();
    });
  }

  const reactions = question.reactions ?? {};

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      {/* the question */}
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm">
          ❓
        </span>
        <div className="flex-1">
          <p className="text-[11px] text-muted-foreground">
            Anonymous · {timeAgo(question.createdAt)}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-7">{question.content}</p>

          {/* reactions + share */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {REACTIONS.map((emoji) => {
              const active = (reactions[emoji] ?? 0) > 0;
              return (
                <button
                  key={emoji}
                  onClick={() => react(emoji)}
                  disabled={pending}
                  className={`rounded-full border px-2.5 py-1 text-sm transition-colors disabled:opacity-50 ${
                    active
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-background/40 hover:border-primary/30"
                  }`}
                  aria-label={`React ${emoji}`}
                >
                  {emoji}
                </button>
              );
            })}
            <button
              onClick={() => setSharing(true)}
              className="ml-1 rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              ↗ Share
            </button>
          </div>
        </div>
      </div>

      {/* the answer, if any */}
      {question.answer ? (
        <div className="mt-4 ml-12">
          <div className="rounded-2xl border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-primary">Your answer</p>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  question.isPublic
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background/40 text-muted-foreground"
                }`}
              >
                {question.isPublic ? "Public" : "Private"}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{question.answer}</p>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <button
              onClick={toggleVisibility}
              disabled={pending}
              className="transition-colors hover:text-primary disabled:opacity-50"
            >
              {question.isPublic ? "Make private" : "Make public"}
            </button>
            <button
              onClick={remove}
              disabled={pending}
              className="transition-colors hover:text-destructive disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      ) : answering ? (
        <div className="mt-4 ml-12">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            placeholder="Write your answer…"
            rows={3}
            className="w-full resize-none rounded-2xl border border-border bg-background/40 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
          />

          {/* public / private choice */}
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-full border border-border bg-background/40 p-1 text-xs">
            <button
              type="button"
              onClick={() => setMakePublic(true)}
              className={`rounded-full py-1.5 font-medium transition-colors ${
                makePublic
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Public · shows on profile
            </button>
            <button
              type="button"
              onClick={() => setMakePublic(false)}
              className={`rounded-full py-1.5 font-medium transition-colors ${
                !makePublic
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Private · only you
            </button>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setAnswering(false)}
              className="rounded-full px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={submitAnswer}
              disabled={pending || !draft.trim()}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Post answer"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 ml-12 flex items-center gap-4 text-sm text-muted-foreground">
          <button
            onClick={() => setAnswering(true)}
            className="transition-colors hover:text-primary"
          >
            Answer
          </button>
          <button onClick={remove} className="transition-colors hover:text-destructive">
            Delete
          </button>
          <ReportButton targetType="question" targetId={question._id} />
        </div>
      )}

      {sharing && (
        <ShareCard
          message={question.content}
          handle={question.recipientUsername}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
