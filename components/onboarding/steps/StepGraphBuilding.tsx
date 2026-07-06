"use client";

// Step 7 — AI builds your Interest Graph. Purely a moment of anticipation:
// no real computation happens here (see OnboardingFlow notes), just a
// sequence that dramatizes what's about to be true on the next screen. Auto-
// advances to Step 8 when it finishes.
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import type { StepProps } from "@/components/onboarding/types";

const MESSAGES = [
  "Analyzing your interests…",
  "Finding communities…",
  "Matching people…",
  "Discovering opportunities…",
  "Preparing your personalized network…",
];

const STEP_DURATION = 850;

export default function StepGraphBuilding({ next }: StepProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [done, setDone] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const duration = reduce ? 150 : STEP_DURATION;

    if (activeIdx < MESSAGES.length - 1) {
      const t = setTimeout(() => setActiveIdx((i) => i + 1), duration);
      return () => clearTimeout(t);
    }

    const finishTimer = setTimeout(() => setDone(true), duration);
    return () => clearTimeout(finishTimer);
  }, [activeIdx, reduce]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(next, reduce ? 200 : 700);
    return () => clearTimeout(t);
  }, [done, next, reduce]);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col items-center justify-center px-6 py-14 text-center">
      {/* orbiting graph motif */}
      <div className="relative mb-12 h-28 w-28">
        <motion.div
          className="absolute inset-0 rounded-full border border-white/10"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          {[0, 90, 180, 270].map((deg) => (
            <span
              key={deg}
              className="absolute h-2 w-2 rounded-full bg-gradient-to-br from-indigo-300 to-cyan-200"
              style={{
                top: "50%",
                left: "50%",
                transform: `rotate(${deg}deg) translate(56px) rotate(-${deg}deg)`,
              }}
            />
          ))}
        </motion.div>
        <motion.div
          className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 via-violet-400/20 to-cyan-300/20 backdrop-blur-xl"
          animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="bg-gradient-to-br from-indigo-200 via-violet-200 to-cyan-100 bg-clip-text text-xl font-semibold text-transparent">
            ✦
          </span>
        </motion.div>
      </div>

      <div className="w-full space-y-3">
        {MESSAGES.map((msg, i) => {
          const isActive = i === activeIdx && !done;
          const isComplete = i < activeIdx || done;
          if (i > activeIdx) return null;
          return (
            <motion.div
              key={msg}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: isActive || isComplete ? 1 : 0.3, y: 0 }}
              transition={{ duration: 0.35 }}
              className="flex items-center justify-center gap-2.5 text-sm"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  isComplete
                    ? "border-violet-400/50 bg-violet-400/20 text-violet-200"
                    : "border-white/20"
                }`}
              >
                {isComplete && <Check className="h-2.5 w-2.5" />}
              </span>
              <span className={isComplete ? "text-white/50" : "text-white"}>{msg}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
