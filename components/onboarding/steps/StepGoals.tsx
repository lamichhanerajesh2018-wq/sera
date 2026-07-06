"use client";

// Step 3 — What are you here to do? Multi-select. This is intent, not just
// interest — it tells SERA whether to lead with people, projects, or jobs.
import { motion } from "framer-motion";
import StepShell from "@/components/onboarding/StepShell";
import { GOALS } from "@/components/onboarding/data";
import type { StepProps } from "@/components/onboarding/types";

export default function StepGoals({ data, update, next }: StepProps) {
  const { goals } = data;

  function toggle(value: string) {
    update({
      goals: goals.includes(value) ? goals.filter((v) => v !== value) : [...goals, value],
    });
  }

  return (
    <StepShell
      eyebrow="Step 3 of 6"
      title="What are you here to do?"
      subtitle="Pick as many as apply — this decides what SERA leads with."
      onContinue={next}
      continueDisabled={goals.length === 0}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {GOALS.map((item, i) => {
          const selected = goals.includes(item.value);
          const Icon = item.icon;
          return (
            <motion.button
              key={item.value}
              type="button"
              onClick={() => toggle(item.value)}
              aria-pressed={selected}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.02 }}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                selected
                  ? "border-violet-400/40 bg-violet-400/10 text-white"
                  : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${selected ? "text-violet-300" : "text-white/45"}`} />
              <span className="text-sm font-medium">{item.label}</span>
            </motion.button>
          );
        })}
      </div>
    </StepShell>
  );
}
