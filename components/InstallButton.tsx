// components/InstallButton.tsx
// "Install app" button for the landing nav. Uses the beforeinstallprompt event
// (Chrome / Android / desktop Chrome+Edge) to trigger the native install prompt.
// Hides itself when the app is already installed or when install isn't available
// (e.g. iOS Safari, which has no programmatic prompt — there we show a hint).
"use client";

import { useEffect, useState } from "react";

// Minimal type for the non-standard beforeinstallprompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallButton({
  className = "",
}: {
  className?: string;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    // Already running as an installed app? Then nothing to do.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS standalone flag
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    // Detect iOS Safari, which can't use beforeinstallprompt.
    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
    setIsIOS(ios);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Already installed → show nothing.
  if (installed) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  // iOS: no prompt API — offer a tappable hint instead.
  if (isIOS) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowIOSHint((v) => !v)}
          className={className}
        >
          Install app
        </button>
        {showIOSHint && (
          <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-border bg-card p-3 text-xs leading-5 text-muted-foreground shadow-xl">
            On iPhone: tap the <span className="text-foreground">Share</span> button,
            then <span className="text-foreground">Add to Home Screen</span> to
            install Sera.
          </div>
        )}
      </div>
    );
  }

  // Chrome/Edge/Android: only show once the browser says install is available.
  if (!deferred) return null;

  return (
    <button type="button" onClick={install} className={className}>
      Install app
    </button>
  );
}
