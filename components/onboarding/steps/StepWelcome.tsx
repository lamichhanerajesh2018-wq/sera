"use client";

// Step 8 — Welcome to SERA. The payoff: a first, personalized-feeling glimpse
// of the network before they ever land in the feed. Recommendations here are
// illustrative (no matching engine yet — see OnboardingFlow notes) but are
// worded using the user's own picks so the screen still feels earned.
import { Users, Globe, Rocket, Wrench, Compass } from "lucide-react";
import FadeIn from "@/components/landing/FadeIn";
import { INTERESTS, IDENTITIES } from "@/components/onboarding/data";
import type { StepProps } from "@/components/onboarding/types";

function labelFor(list: { value: string; label: string }[], value: string | null) {
  return list.find((i) => i.value === value)?.label ?? null;
}

export default function StepWelcome({ data }: StepProps) {
  const topInterest = labelFor(INTERESTS, data.interests[0]) ?? "your interests";
  const secondInterest = labelFor(INTERESTS, data.interests[1]);
  const identityLabel = labelFor(IDENTITIES, data.identity);

  const sections = [
    {
      icon: Users,
      title: "People",
      caption: `Because you're into ${topInterest}`,
      items: [
        { title: `3 ${topInterest} builders`, body: "Active this week, open to connecting." },
        {
          title: identityLabel ? `${identityLabel}s near your stage` : "People a step ahead",
          body: "Further along a similar path.",
        },
      ],
    },
    {
      icon: Globe,
      title: "Communities",
      caption: secondInterest ? `Spanning ${topInterest} and ${secondInterest}` : "Already gathered around this",
      items: [
        { title: `${topInterest} Builders`, body: "A space already active around this." },
        { title: "SERA Early Access", body: "Everyone shaping the network right now." },
      ],
    },
    {
      icon: Rocket,
      title: "Projects",
      caption: "Looking for someone like you",
      items: [{ title: `An open ${topInterest.toLowerCase()} build`, body: "Looking for a contributor." }],
    },
    {
      icon: Wrench,
      title: "Software",
      caption: "Worth knowing about",
      items: [{ title: `Tools serious about ${topInterest.toLowerCase()}`, body: "Not the ones with the ad budget." }],
    },
    {
      icon: Compass,
      title: "Opportunities",
      caption: identityLabel ? `Matched to ${identityLabel}` : "Matched to you",
      items: [{ title: "One worth a look", body: "Surfaced before you'd think to search." }],
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-6 py-14 sm:py-20">
      <FadeIn>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">
            Your Interest Graph is ready
          </p>
          <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-white sm:text-4xl">
            Welcome to SERA, @{data.username || "there"}.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/50">
            Here&apos;s a first look at what&apos;s already waiting for you.
          </p>
        </div>
      </FadeIn>

      <div className="mt-10 space-y-4">
        {sections.map((section, i) => {
          const Icon = section.icon;
          return (
            <FadeIn key={section.title} delay={i * 0.08}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                    <Icon className="h-4 w-4 text-violet-300" />
                  </span>
                  <div>
                    <h2 className="font-display text-sm font-medium text-white">{section.title}</h2>
                    <p className="text-xs text-white/40">{section.caption}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {section.items.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5"
                    >
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-white/45">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          );
        })}
      </div>

      <FadeIn delay={0.5}>
        <button
          type="button"
          onClick={() => window.location.assign("/feed")}
          className="mt-10 h-12 w-full rounded-full bg-white font-medium text-black transition-transform hover:scale-[1.02]"
        >
          Enter SERA
        </button>
      </FadeIn>
    </div>
  );
}
