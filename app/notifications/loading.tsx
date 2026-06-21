// app/notifications/loading.tsx
export default function NotificationsLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 h-8 w-48 rounded-xl bg-card animate-pulse" />
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 rounded-2xl bg-card animate-pulse" />
        ))}
      </div>
    </div>
  );
}
