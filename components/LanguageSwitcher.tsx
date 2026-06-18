"use client";

// LanguageSwitcher — sets NEXT_LOCALE cookie and reloads the page.
// Sits in the navbar so users can switch language at any time.
import { useState } from "react";

const LANGS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ne", label: "नेपाली", flag: "🇳🇵" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
];

function getCurrentLang(): string {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
  return match?.[1] ?? "en";
}

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>(() => getCurrentLang());

  function switchLang(code: string) {
    // Set cookie (1 year)
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000;SameSite=Lax`;
    setCurrent(code);
    setOpen(false);
    window.location.reload();
  }

  const activeLang = LANGS.find((l) => l.code === current) ?? LANGS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Switch language"
      >
        <span>{activeLang.flag}</span>
        <span className="hidden sm:inline">{activeLang.label}</span>
        <span className="text-[10px] opacity-60">▾</span>
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[130px] overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
            {LANGS.map((lang) => (
              <button
                key={lang.code}
                onClick={() => switchLang(lang.code)}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors hover:bg-accent ${
                  current === lang.code ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
                {current === lang.code && <span className="ml-auto text-[10px]">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
