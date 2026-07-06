// components/AuthShell.tsx
// Shared frame for the signup/login screens: a glass card floating on SERA's
// dark, indigo/violet-lit background — matching the redesigned landing page.
import Link from "next/link";
import BrandMark from "@/components/landing/BrandMark";

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="dark relative flex flex-1 flex-col items-center justify-center bg-[#050509] px-6 py-16 text-white">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[360px] w-[520px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-cyan-400/10 blur-[100px]"
      />

      <div className="mb-8">
        <Link href="/" className="inline-flex items-center">
          <BrandMark size="lg" />
        </Link>
      </div>

      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
        <h1 className="font-display text-2xl font-medium tracking-tight text-white">{title}</h1>
        <p className="mt-1.5 text-sm text-white/50">{subtitle}</p>

        <div className="mt-6">{children}</div>
      </div>

      <div className="mt-6 text-sm text-white/50">{footer}</div>
    </div>
  );
}
