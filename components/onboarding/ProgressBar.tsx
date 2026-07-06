"use client";

// Segmented progress indicator for the "question" steps (2–6 of the
// onboarding wizard). Steps 1, 7 and 8 render their own full-bleed screens
// without this chrome.
import { motion } from "framer-motion";

export default function ProgressBar({
  step,
  totalSteps,
}: {
  step: number;
  totalSteps: number;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xs items-center gap-1.5" aria-hidden>
      {Array.from({ length: totalSteps }).map((_, i) => {
        const filled = i < step;
        return (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-200"
              initial={false}
              animate={{ width: filled ? "100%" : "0%" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        );
      })}
    </div>
  );
}
