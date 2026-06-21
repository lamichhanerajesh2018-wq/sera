"use client";
// app/notifications/error.tsx
export default function NotificationsError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <p className="text-4xl">🔔</p>
      <h2 className="mt-4 font-display text-xl font-medium">Couldn&apos;t load notifications</h2>
      <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Please try again.</p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
