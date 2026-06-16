// components/ReportButton.tsx
// A small "report" control. Opens a reason picker, submits a report, and
// confirms quietly. Used on posts, comments, etc.
"use client";

import { useState, useTransition } from "react";
import { submitReport } from "@/app/actions/reports";
import type { ReportTarget } from "@/lib/types";

const REASONS = [
  "Harassment or bullying",
  "Hate speech",
  "Threats or violence",
  "Sexual or inappropriate",
  "Spam",
  "Something else",
];

export default function ReportButton({
  targetType,
  targetId,
  className = "",
}: {
  targetType: ReportTarget;
  targetId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function report(reason: string) {
    startTransition(async () => {
      await submitReport(targetType, targetId, reason);
      setOpen(false);
      setDone(true);
    });
  }

  if (done) {
    return <span className={`text-xs text-muted-foreground ${className}`}>Reported · thank you</span>;
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`text-xs text-muted-foreground transition-colors hover:text-destructive ${className}`}
      >
        Report
      </button>

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
            <p className="px-3 py-2 text-xs text-muted-foreground">Why are you reporting this?</p>
            {REASONS.map((r) => (
              <button
                key={r}
                onClick={() => report(r)}
                disabled={pending}
                className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/50 disabled:opacity-50"
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
