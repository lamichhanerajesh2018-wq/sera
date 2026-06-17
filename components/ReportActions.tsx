// components/ReportActions.tsx
// Moderator controls on a single report row.
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { dismissReport, removeReportedContent } from "@/app/actions/reports";

export default function ReportActions({
  reportId,
}: {
  reportId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      await dismissReport(reportId);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await removeReportedContent(reportId);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={dismiss}
        disabled={pending}
        className="rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-secondary/40 disabled:opacity-50"
      >
        Dismiss
      </button>
      <button
        onClick={remove}
        disabled={pending}
        className="rounded-full bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Remove content
      </button>
    </div>
  );
}
