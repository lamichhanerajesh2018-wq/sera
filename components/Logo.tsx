// components/Logo.tsx
// The Sera brand mark + wordmark. The "S" ribbon is inline SVG so it inherits
// the page's primary (candle-amber) color via currentColor. Used in the nav,
// footer and auth screens. Pass `markOnly` for just the icon.
import Link from "next/link";

function SeraMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      role="img"
      aria-label="Sera"
    >
      <path
        d="M70 28 C70 18 60 13 49 13 C34 13 24 23 24 37 C24 49 33 55 47 59 C58 62 64 65 64 72 C64 80 56 85 47 85 C36 85 30 79 30 71"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M58 16 C68 18 75 24 78 33"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
    </svg>
  );
}

export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return <SeraMark className={`${className} text-primary`} />;
}

export default function Logo({
  href = "/",
  size = "md",
  className = "",
}: {
  href?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const markSize =
    size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const textSize =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";

  const inner = (
    <span className={`flex items-center gap-2 ${className}`}>
      <SeraMark className={`${markSize} text-primary`} />
      <span className={`font-display ${textSize} font-semibold tracking-[0.18em]`}>
        SERA
      </span>
    </span>
  );

  if (href === null) return inner;
  return (
    <Link href={href} className="inline-flex items-center">
      {inner}
    </Link>
  );
}
