// app/contact/page.tsx
// Public contact page. Uses the shared legal frame for header + back link, and
// renders the ContactForm which emails the site owner on submit.
import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact · Sera",
  description: "Get in touch with the Sera team.",
};

export default function ContactPage() {
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

      <main className="mx-auto w-full max-w-xl px-6 py-12">
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">Get in touch</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Questions, feedback, or something not working right? Send us a message and we&apos;ll
          get back to you. For anything urgent about your safety, please contact local emergency
          services.
        </p>

        <div className="mt-8">
          <ContactForm />
        </div>

        <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground">← Back to Sera</Link>
        </div>
      </main>
    </div>
  );
}
