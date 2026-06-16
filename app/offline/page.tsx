// app/offline/page.tsx
// Shown by the service worker when a navigation fails because the user is
// offline. Kept simple and self-contained so it renders without network.
import Logo from "@/components/Logo";

export const metadata = { title: "Offline — Sera" };

export default function OfflinePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <Logo href={null} size="lg" />
      <p className="mt-10 text-4xl">🌙</p>
      <h1 className="mt-4 font-display text-2xl font-medium">You&apos;re offline</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Sera needs a connection to load fresh confessions and messages. Check your
        internet and try again.
      </p>
      <a
        href="/feed"
        className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Try again
      </a>
    </div>
  );
}
