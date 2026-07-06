"use client";

// Step 5 (optional) — Add your skills. Searchable suggestions plus free-text
// tags. Skippable — this refines matching but nothing here blocks entry.
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import StepShell from "@/components/onboarding/StepShell";
import { SKILL_SUGGESTIONS } from "@/components/onboarding/data";
import type { StepProps } from "@/components/onboarding/types";

const MAX_SKILLS = 15;

export default function StepSkills({ data, update, next }: StepProps) {
  const [query, setQuery] = useState("");
  const { skills } = data;

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SKILL_SUGGESTIONS.filter(
      (s) => !skills.includes(s) && (q === "" || s.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [query, skills]);

  const canAddCustom =
    query.trim().length > 1 &&
    !skills.some((s) => s.toLowerCase() === query.trim().toLowerCase()) &&
    skills.length < MAX_SKILLS;

  function addSkill(skill: string) {
    if (skills.length >= MAX_SKILLS || skills.includes(skill)) return;
    update({ skills: [...skills, skill] });
    setQuery("");
  }

  function removeSkill(skill: string) {
    update({ skills: skills.filter((s) => s !== skill) });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && canAddCustom) {
      e.preventDefault();
      addSkill(query.trim());
    }
  }

  return (
    <StepShell
      eyebrow="Step 5 of 6 — optional"
      title="Add your skills."
      subtitle="What you're good at helps SERA match you with the right people and projects."
      onContinue={next}
      onSkip={next}
      footnote={skills.length > 0 ? `${skills.length} added` : undefined}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search or type a skill…"
          disabled={skills.length >= MAX_SKILLS}
          className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-400/15 disabled:opacity-50"
        />
      </div>

      {skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {skills.map((skill) => (
              <motion.span
                key={skill}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-400/10 py-1.5 pl-3 pr-2 text-xs font-medium text-violet-200"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  aria-label={`Remove ${skill}`}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-violet-200/70 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {canAddCustom && (
          <button
            type="button"
            onClick={() => addSkill(query.trim())}
            className="rounded-full border border-white/15 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-white/25 hover:text-white"
          >
            Add &ldquo;{query.trim()}&rdquo;
          </button>
        )}
        {suggestions.map((skill) => (
          <button
            key={skill}
            type="button"
            onClick={() => addSkill(skill)}
            className="rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-1.5 text-xs font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
          >
            {skill}
          </button>
        ))}
      </div>
    </StepShell>
  );
}
