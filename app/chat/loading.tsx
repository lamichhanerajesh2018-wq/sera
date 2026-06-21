// app/chat/loading.tsx
export default function ChatLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 h-8 w-40 rounded-xl bg-card animate-pulse" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 rounded-3xl bg-card animate-pulse" />
        ))}
      </div>
    </div>
  );
}
