"use client";

// Step 4 — Tell us about yourself. Single choice: the one identity that best
// frames how SERA should read everything else about you.
import { motion } from "framer-motion";
import StepShell from "@/components/onboarding/StepShell";
import { IDENTITIES } from "@/components/onboarding/data";
import type { StepProps } from "@/components/onboarding/types";

export default function StepIdentity({ data, update, next }: StepProps) {
  return (
    <StepShell
      eyebrow="Step 4 of 6"
      title="Tell us about yourself."
      subtitle="Just one — pick whichever fits best today."
      onContinue={next}
      continueDisabled={!data.identity}
    >
      <div
        role="radiogroup"
        aria-label="Primary identity"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {IDENTITIES.map((item, i) => {
          const selected = data.identity === item.value;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => update({ identity: item.value })}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.02 }}
              whileTap={{ scale: 0.96 }}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition-colors ${
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
