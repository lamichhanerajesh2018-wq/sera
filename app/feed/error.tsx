"use client";
// app/feed/error.tsx
// Shown when the feed page throws an unhandled error.
export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <p className="text-4xl">😵</p>
      <h2 className="mt-4 font-display text-xl font-medium">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The feed couldn&apos;t load. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
