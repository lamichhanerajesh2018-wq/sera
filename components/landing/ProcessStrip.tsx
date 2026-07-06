import FadeIn from "@/components/landing/FadeIn";

const STEPS = ["Explore", "Understand", "Discover"];

export default function ProcessStrip() {
  return (
    <FadeIn>
      <div className="mx-auto flex max-w-lg items-center justify-center gap-3 sm:gap-5">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-3 sm:gap-5">
            <span className="font-display text-base font-medium text-white/70 sm:text-lg">
              {step}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="text-white/20">
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </FadeIn>
  );
}
