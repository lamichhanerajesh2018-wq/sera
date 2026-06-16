"use client";

// The signature moment: the tagline emerges from the dark like a whisper
// surfacing. Words fade + drift up in sequence, then a soft amber glow breathes
// behind them. Respects reduced-motion.
import { useEffect, useState } from "react";

const LINE_ONE = "Speak freely.";
const LINE_TWO = "Stay unseen.";

export default function HeroWhisper() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative">
      {/* breathing amber glow behind the words */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[280px] w-[520px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[80px] motion-safe:animate-pulse"
        style={{ animationDuration: "6s" }}
      />

      <h1 className="font-display text-5xl font-medium leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
        <span className="block overflow-hidden">
          <span
            className={`block transition-all duration-[1200ms] ease-out ${
              shown ? "translate-y-0 opacity-100 blur-0" : "translate-y-4 opacity-0 blur-md"
            }`}
          >
            {LINE_ONE}
          </span>
        </span>
        <span className="block overflow-hidden">
          <span
            className={`block bg-gradient-to-b from-primary to-primary/60 bg-clip-text text-transparent transition-all duration-[1200ms] ease-out ${
              shown ? "translate-y-0 opacity-100 blur-0" : "translate-y-4 opacity-0 blur-md"
            }`}
            style={{ transitionDelay: "350ms" }}
          >
            {LINE_TWO}
          </span>
        </span>
      </h1>
    </div>
  );
}
