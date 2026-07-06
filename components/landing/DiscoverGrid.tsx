import FadeIn from "@/components/landing/FadeIn";

const ITEMS = [
  {
    title: "People",
    body: "Others who think like you, work like you, or are a few steps further along.",
    big: true,
  },
  { title: "Communities", body: "Spaces already gathered around exactly what you're into." },
  { title: "Projects", body: "Builds looking for a contributor, a tester, or a second opinion." },
  { title: "Mentors", body: "People who've already done what you're trying to do." },
  { title: "Software", body: "The tools your field actually uses, not the ones with the ad budget." },
  {
    title: "Opportunities",
    body: "The chance you didn't know to look for — surfaced before you'd think to search.",
    big: true,
  },
  { title: "Businesses", body: "Companies and studios shaped by the same interests you have." },
  { title: "Learning", body: "Courses and guides matched to exactly where you are right now." },
  { title: "Events", body: "Meetups and talks worth clearing your calendar for." },
  { title: "Jobs", body: "Roles that fit your interests, not just your resume." },
];

export default function DiscoverGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:[grid-auto-flow:dense]">
      {ITEMS.map((item, i) => (
        <FadeIn
          key={item.title}
          delay={(i % 4) * 0.06}
          className={`h-full ${item.big ? "col-span-2" : ""}`}
        >
          <div className="group flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.045]">
            <p className="font-mono text-xs text-white/25">{String(i + 1).padStart(2, "0")}</p>
            <div className="mt-6">
              <h3 className="font-display text-base font-medium text-white">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-white/45">{item.body}</p>
            </div>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}
