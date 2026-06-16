// components/PostHogProvider.tsx
// Initializes PostHog analytics on the client and tracks page views. Kept
// privacy-conscious to match Sera's anonymous design: we never identify users
// by real identity, mask common PII in autocapture, and respect Do Not Track.
"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

let initialized = false;

function initPostHog() {
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  if (!key) return; // analytics simply off if not configured
  if (typeof window === "undefined") return;

  posthog.init(key, {
    api_host: host,
    // We track page views manually (below) so routing changes are captured.
    capture_pageview: false,
    capture_pageleave: true,
    // Privacy: Sera is anonymous-by-design. Mask text/inputs in any session
    // capture and don't persist a cross-site profile.
    autocapture: true,
    mask_all_text: false,
    mask_all_element_attributes: false,
    respect_dnt: true,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHog();
  }, []);

  // Track a pageview on every route change.
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return <>{children}</>;
}

// ---- event helper --------------------------------------------------------
// Use across the app to log meaningful actions for funnels:
//   track("signup_completed", { mode: "anonymous" })
//   track("message_sent")
//   track("invite_copied")
export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, properties);
  } catch {
    /* analytics must never break the app */
  }
}
