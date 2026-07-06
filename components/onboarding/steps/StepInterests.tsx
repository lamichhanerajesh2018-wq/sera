"use client";

// Step 2 — Choose your interests. 3–10 picks feed the first pass of the
// Interest Graph. Cards, not checkboxes — selecting one should feel quick and
// a little satisfying, not like filling out a form.
import { motion } from "framer-motion";
import StepShell from "@/components/onboarding/StepShell";
import { INTERESTS, INTEREST_LIMITS } from "@/components/onboarding/data";
import type { StepProps } from "@/components/onboarding/types";

export default function StepInterests({ data, update, next }: StepProps) {
  const { interests } = data;
  const atMax = interests.length >= INTEREST_LIMITS.max;
  const canContinue = interests.length >= INTEREST_LIMITS.min;

  function toggle(value: string) {
    if (interests.includes(value)) {
      update({ interests: interests.filter((v) => v !== value) });
    } else if (!atMax) {
      update({ interests: [...interests, value] });
    }
  }

  return (
    <StepShell
      eyebrow="Step 2 of 6"
      title="What are you into?"
      subtitle={`Pick ${INTEREST_LIMITS.min} to ${INTEREST_LIMITS.max}. This shapes everything SERA shows you.`}
      onContinue={next}
      continueDisabled={!canContinue}
      footnote={
        <span className={interests.length >= INTEREST_LIMITS.min ? "text-violet-300" : ""}>
          {interests.length} of {INTEREST_LIMITS.max} selected
          {interests.length < INTEREST_LIMITS.min &&
            ` — pick at least ${INTEREST_LIMITS.min - interests.length} more`}
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {INTERESTS.map((item, i) => {
          const selected = interests.includes(item.value);
          const Icon = item.icon;
          return (
            <motion.button
              key={item.value}
              type="button"
              onClick={() => toggle(item.value)}
              aria-pressed={selected}
              disabled={!selected && atMax}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.02 }}
              whileTap={{ scale: 0.96 }}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                selected
                  ? "border-violet-400/40 bg-violet-400/10 text-white"
                  : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              <Icon className={`h-5 w-5 ${selected ? "text-violet-300" : "text-white/50"}`} />
              <span className="text-xs font-medium leading-tight sm:text-sm">{item.label}</span>
            </motion.button>
          );
        })}
      </div>
    </StepShell>
  );
}
