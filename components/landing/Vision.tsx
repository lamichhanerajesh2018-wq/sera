import FadeIn from "@/components/landing/FadeIn";

const PILLARS = [
  {
    title: "Sharper suggestions over time",
    body: "The more you explore, the better SERA gets at knowing what belongs in front of you.",
  },
  {
    title: "Matching that runs both ways",
    body: "People, projects and roles that are also looking for someone like you — not just a feed you scroll past.",
  },
  {
    title: "One stream for every opportunity",
    body: "Jobs, events and openings worth your attention, in one place instead of ten tabs.",
  },
  {
    title: "Projects before they go public",
    body: "Find the builds that need what you're good at, early enough to matter.",
  },
];

export default function Vision() {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-white/10 border-y border-white/10">
      {PILLARS.map((p, i) => (
        <FadeIn key={p.title} delay={i * 0.08}>
          <div className="flex flex-col gap-1.5 py-7 sm:flex-row sm:items-baseline sm:gap-10 sm:py-8">
            <h3 className="font-display text-lg font-medium text-white sm:w-72 sm:shrink-0">
              {p.title}
            </h3>
            <p className="text-sm leading-6 text-white/45">{p.body}</p>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}
