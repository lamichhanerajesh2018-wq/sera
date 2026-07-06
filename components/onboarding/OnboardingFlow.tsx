"use client";

// components/onboarding/OnboardingFlow.tsx
// Orchestrates the 8-step onboarding wizard: owns step position + the
// in-memory answers, animates between screens, and shows a persistent
// back/progress/exit bar for the "question" steps (2–6).
//
// Persistence note: interests, goals, identity, skills and the username live
// in React state (see components/onboarding/types.ts) as the user moves
// through the flow, and are only written once — in Step 6's "Finish setup"
// (see StepUsername.tsx), which renames the account via Better Auth and then
// calls saveOnboardingProfile(). The account itself (Step 1) is real from the
// start: it calls the same Better Auth flows as /signup.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { ensureUsernameForCurrentUser } from "@/app/actions/onboarding";
import ProgressBar from "@/components/onboarding/ProgressBar";
import { INITIAL_ONBOARDING_DATA, type OnboardingData } from "@/components/onboarding/types";
import StepAccount from "@/components/onboarding/steps/StepAccount";
import StepInterests from "@/components/onboarding/steps/StepInterests";
import StepGoals from "@/components/onboarding/steps/StepGoals";
import StepIdentity from "@/components/onboarding/steps/StepIdentity";
import StepSkills from "@/components/onboarding/steps/StepSkills";
import StepUsername from "@/components/onboarding/steps/StepUsername";
import StepGraphBuilding from "@/components/onboarding/steps/StepGraphBuilding";
import StepWelcome from "@/components/onboarding/steps/StepWelcome";

const TOTAL_QUESTION_STEPS = 6;
const LAST_STEP = 8;

const variants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? -24 : 24 }),
};

export default function OnboardingFlow({
  providers,
}: {
  providers: { google: boolean; apple: boolean };
}) {
  const searchParams = useSearchParams();
  const refHandle = (searchParams.get("ref") || "").trim().toLowerCase();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL_ONBOARDING_DATA);
  const resumedRef = useRef(false);

  const { data: session, isPending } = authClient.useSession();

  // Returning from a Google/Apple redirect lands back on this same route with
  // a fresh page load (React state reset) but an active session — detect that
  // and skip straight past account creation instead of asking again.
  useEffect(() => {
    if (isPending || resumedRef.current || step !== 1) return;
    if (!session?.user) return;

    resumedRef.current = true;
    (async () => {
      const handle = await ensureUsernameForCurrentUser();
      setData((d) => ({ ...d, username: handle ?? d.username }));
      setDirection(1);
      setStep(2);
    })();
  }, [session, isPending, step]);

  function update(patch: Partial<OnboardingData>) {
    setData((d) => ({ ...d, ...patch }));
  }

  function next() {
    setDirection(1);
    setStep((s) => Math.min(s + 1, LAST_STEP));
  }

  function back() {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  }

  const showChrome = step >= 2 && step <= 6;
  const stepProps = { data, update, next, back };

  return (
    <div className="dark relative min-h-screen w-full overflow-x-clip bg-[#050509] text-white">
      {showChrome && (
        <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-white/[0.06] bg-[#050509]/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <ProgressBar step={step - 1} totalSteps={TOTAL_QUESTION_STEPS} />
          <Link
            href="/"
            aria-label="Exit setup"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </Link>
        </div>
      )}

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={step}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === 1 && (
            <StepAccount {...stepProps} providers={providers} refHandle={refHandle} />
          )}
          {step === 2 && <StepInterests {...stepProps} />}
          {step === 3 && <StepGoals {...stepProps} />}
          {step === 4 && <StepIdentity {...stepProps} />}
          {step === 5 && <StepSkills {...stepProps} />}
          {step === 6 && <StepUsername {...stepProps} />}
          {step === 7 && <StepGraphBuilding {...stepProps} />}
          {step === 8 && <StepWelcome {...stepProps} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
