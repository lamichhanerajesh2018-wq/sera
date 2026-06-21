// app/inbox/loading.tsx
export default function InboxLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-6 h-8 w-40 rounded-xl bg-card animate-pulse" />
      <div className="mb-4 h-20 rounded-3xl bg-card animate-pulse" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-28 rounded-3xl bg-card animate-pulse" />
        ))}
      </div>
    </div>
  );
}
