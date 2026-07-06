// app/onboarding/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { enabledSocialProviders } from "@/lib/auth";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";

export const metadata: Metadata = {
  title: "Set up SERA",
  description: "A couple minutes to help SERA understand what you're into.",
};

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050509]" />}>
      <OnboardingFlow providers={enabledSocialProviders} />
    </Suspense>
  );
}
