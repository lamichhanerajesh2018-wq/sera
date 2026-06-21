// app/feed/loading.tsx
// Shown while the feed page server component is fetching data.
export default function FeedLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:max-w-6xl">
      <div className="flex gap-6">
        {/* Sidebar skeleton (hidden on mobile) */}
        <div className="hidden w-64 shrink-0 lg:block">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded-2xl bg-card animate-pulse" />
            ))}
          </div>
        </div>
        {/* Feed skeleton */}
        <div className="flex-1 space-y-4">
          <div className="h-28 rounded-3xl bg-card animate-pulse" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-36 rounded-3xl bg-card animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
