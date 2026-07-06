import FadeIn from "@/components/landing/FadeIn";

const LINES = [
  "Not more content. The people behind it.",
  "Not more scrolling. Somewhere to arrive.",
  "Not another feed. A way forward.",
];

export default function Manifesto() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <FadeIn>
        <p className="font-display text-2xl leading-snug text-white/30 sm:text-3xl">
          Most platforms show you more of what you already saw.
        </p>
      </FadeIn>
      <FadeIn delay={0.15}>
        <p className="mt-3 bg-gradient-to-r from-indigo-200 via-violet-200 to-cyan-100 bg-clip-text font-display text-3xl font-medium leading-snug text-transparent sm:text-4xl">
          SERA shows you what&apos;s next.
        </p>
      </FadeIn>

      <FadeIn delay={0.3}>
        <div className="mx-auto mt-16 grid grid-cols-1 divide-y divide-white/10 border-t border-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:border-t-0">
          {LINES.map((line) => (
            <p key={line} className="px-4 py-6 text-sm leading-6 text-white/50 sm:py-0">
              {line}
            </p>
          ))}
        </div>
      </FadeIn>
    </div>
  );
}
