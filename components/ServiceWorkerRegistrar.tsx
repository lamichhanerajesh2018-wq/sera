// components/ServiceWorkerRegistrar.tsx
// Registers the PWA service worker on the client, after the page loads. Runs
// once on mount; safe to include high in the tree. No UI.
"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("[sw] registration failed:", err));
    };

    // Register after the window load event so it doesn't compete with the
    // initial render for bandwidth.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
