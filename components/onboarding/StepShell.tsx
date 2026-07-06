// components/onboarding/StepShell.tsx
// Shared layout for the "question" steps (interests, goals, identity, skills,
// username): eyebrow + heading + subtitle, scrollable content, and a footer
// with Continue (and an optional Skip). Back button + progress bar live in
// OnboardingFlow's persistent top bar, not here, so they never re-animate.
export default function StepShell({
  eyebrow,
  title,
  subtitle,
  children,
  footnote,
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
  onSkip,
  skipLabel = "Skip for now",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footnote?: React.ReactNode;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-6 py-10 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">{eyebrow}</p>
      <h1 className="mt-3 font-display text-2xl font-medium tracking-tight text-white sm:text-3xl">
        {title}
      </h1>
      {subtitle && <p className="mt-2 text-sm leading-6 text-white/50">{subtitle}</p>}

      <div className="mt-8">{children}</div>

      <div className="mt-10">
        {footnote && <div className="mb-4 text-center text-xs text-white/40">{footnote}</div>}
        <button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled}
          className="h-12 w-full rounded-full bg-white font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {continueLabel}
        </button>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="mt-3 w-full text-center text-sm text-white/40 transition-colors hover:text-white/70"
          >
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}
