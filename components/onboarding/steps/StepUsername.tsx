"use client";

// Step 6 — Create your username. Pre-filled with the handle assigned at
// signup; editing it here previews a new one with a live availability check.
// "Finish setup" is the one moment this entire flow writes anything: it
// renames the account (if changed) via Better Auth's own validation, then
// saves interests/goals/identity/skills to the user's profile.
import { useEffect, useState } from "react";
import { Check, Loader2, X as XIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { saveOnboardingProfile } from "@/app/actions/onboarding";
import StepShell from "@/components/onboarding/StepShell";
import type { StepProps } from "@/components/onboarding/types";

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

type CheckResult = "available" | "taken" | "unknown" | null;

export default function StepUsername({ data, update, next }: StepProps) {
  const value = data.username;
  const valid = USERNAME_RE.test(value);
  const tooShort = value.length > 0 && value.length < 3;
  const badChars = value.length > 0 && !/^[a-zA-Z0-9_-]*$/.test(value);

  // Captured once — the handle assigned at signup. Plain state (not a ref)
  // so it's safe to read during render; it never changes after mount.
  const [initialUsername] = useState(data.username);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Debounced live availability check. State is only ever set inside the
  // async callback (a genuine external-system response), never synchronously
  // at the top of the effect.
  useEffect(() => {
    if (!valid || value === initialUsername) return;

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/is-username-available", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: value }),
        });
        const json = await res.json();
        if (!cancelled) {
          setLastChecked(value);
          setCheckResult(json.available ? "available" : "taken");
        }
      } catch {
        if (!cancelled) {
          setLastChecked(value);
          setCheckResult("unknown");
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, valid, initialUsername]);

  const pendingCheck = valid && value !== initialUsername && lastChecked !== value;

  const availability: "idle" | "checking" | "available" | "taken" | "unknown" = !valid
    ? "idle"
    : value === initialUsername
      ? "available"
      : pendingCheck
        ? "checking"
        : (checkResult ?? "checking");

  async function handleFinish() {
    setFormError(null);
    setSaving(true);

    if (value !== initialUsername) {
      const { error } = await authClient.updateUser({
        username: value,
        displayUsername: value,
      });
      if (error) {
        setFormError(error.message || "That username is taken.");
        setSaving(false);
        return;
      }
    }

    try {
      await saveOnboardingProfile({
        interests: data.interests,
        goals: data.goals,
        identity: data.identity,
        skills: data.skills,
      });
    } catch {
      setFormError("Couldn't save your profile. Please try again.");
      setSaving(false);
      return;
    }

    next();
  }

  const canContinue = valid && availability !== "checking" && availability !== "taken" && !saving;

  return (
    <StepShell
      eyebrow="Step 6 of 6"
      title="Create your username."
      subtitle="This is the only thing people see. You can change it anytime in Settings."
      onContinue={handleFinish}
      continueDisabled={!canContinue}
      continueLabel={saving ? "Finishing…" : "Finish setup"}
    >
      <div
        className={`flex h-14 items-center rounded-2xl border bg-white/[0.04] pl-4 pr-3 transition-colors focus-within:ring-2 ${
          availability === "taken"
            ? "border-red-400/40 focus-within:border-red-400/50 focus-within:ring-red-400/15"
            : "border-white/10 focus-within:border-violet-400/50 focus-within:ring-violet-400/15"
        }`}
      >
        <span className="text-lg text-white/35">@</span>
        <input
          type="text"
          value={value}
          onChange={(e) =>
            update({ username: e.target.value.trim().toLowerCase().slice(0, 20) })
          }
          autoFocus
          maxLength={20}
          placeholder="sera-4821"
          disabled={saving}
          className="h-full flex-1 bg-transparent px-2 text-lg text-white outline-none placeholder:text-white/25 disabled:opacity-50"
        />
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          {availability === "checking" && <Loader2 className="h-4 w-4 animate-spin text-white/40" />}
          {availability === "available" && <Check className="h-4 w-4 text-emerald-400" />}
          {availability === "taken" && <XIcon className="h-4 w-4 text-red-400" />}
        </span>
      </div>

      <p
        className={`mt-3 text-xs ${
          availability === "taken" ? "text-red-400" : "text-white/40"
        }`}
      >
        {badChars
          ? "Only letters, numbers, underscores and hyphens."
          : tooShort
            ? "At least 3 characters."
            : availability === "taken"
              ? "That username is already taken."
              : availability === "checking"
                ? "Checking availability…"
                : "Letters, numbers, underscores and hyphens — 3 to 20 characters."}
      </p>

      {formError && <p className="mt-2 text-xs text-red-400">{formError}</p>}
    </StepShell>
  );
}
