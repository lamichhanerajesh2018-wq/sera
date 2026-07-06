// Standalone wordmark for the redesigned landing page — a gradient node-mark
// paired with the SERA name. Kept separate from components/Logo.tsx so this
// page's new indigo/violet/cyan identity never bleeds into the rest of the
// (amber-accented) product.
export default function BrandMark({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const markSize = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const textSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className={markSize} fill="none" role="img" aria-label="SERA">
        <defs>
          <linearGradient id="brandmark-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="55%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="3.2" fill="url(#brandmark-grad)" />
        <circle cx="6" cy="8" r="2.1" fill="url(#brandmark-grad)" opacity="0.85" />
        <circle cx="26" cy="7" r="2.1" fill="url(#brandmark-grad)" opacity="0.85" />
        <circle cx="27" cy="24" r="2.1" fill="url(#brandmark-grad)" opacity="0.85" />
        <circle cx="5" cy="23" r="2.1" fill="url(#brandmark-grad)" opacity="0.85" />
        <path
          d="M16 16 L6 8 M16 16 L26 7 M16 16 L27 24 M16 16 L5 23"
          stroke="url(#brandmark-grad)"
          strokeWidth="1"
          opacity="0.5"
        />
      </svg>
      <span className={`font-display ${textSize} font-semibold tracking-tight text-white`}>SERA</span>
    </span>
  );
}
