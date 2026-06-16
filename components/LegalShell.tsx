// components/LegalShell.tsx
// Shared frame for legal pages (privacy, terms, guidelines): a slim header with
// the Sera wordmark, a centered prose column, and a footer link back home.
// Children are the page body; pass `title` and `updated` for the heading block.
import Link from "next/link";
import Logo from "@/components/Logo";

export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Logo href="/" size="sm" />
          <nav className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link href="/guidelines" className="transition-colors hover:text-foreground">Guidelines</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>

        {/* prose: scoped typography so we don't depend on a Tailwind typography plugin */}
        <div className="legal-prose mt-10">{children}</div>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground">← Back to Sera</Link>
        </div>
      </main>
    </div>
  );
}
