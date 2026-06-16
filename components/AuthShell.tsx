// components/AuthShell.tsx
// Shared frame for the signup/login screens: centered card on the dark
// candle-lit background, with the Sera wordmark above it.
import Logo from "@/components/Logo";

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
    <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-16">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[320px] w-[460px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[90px]"
      />

      <div className="mb-8">
        <Logo href="/" size="lg" />
      </div>

      <div className="w-full max-w-sm rounded-3xl border border-border bg-card/70 p-8 backdrop-blur">
        <h1 className="font-display text-2xl font-medium tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

        <div className="mt-6">{children}</div>
      </div>

      <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
    </div>
  );
}
