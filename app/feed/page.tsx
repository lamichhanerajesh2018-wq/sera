// app/feed/page.tsx
// The confessions feed. Signed-in only. Composer on top, posts below.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listFeed } from "@/app/actions/posts";
import AppBar from "@/components/AppBar";
import PostComposer from "@/components/PostComposer";
import PostCard from "@/components/PostCard";

export const metadata = { title: "Your feed — Sera" };

export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const handle = (user as any).username || (user as any).displayUsername || "anon";
  const posts = await listFeed();

  return (
    <div className="flex flex-1 flex-col">
      <AppBar handle={handle} />

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <PostComposer handle={handle} />

        <div className="mt-6 space-y-4">
          {posts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
              <p className="text-3xl">🕯️</p>
              <p className="mt-3 font-display text-lg font-medium">It&apos;s quiet in here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No confessions yet. Be the first to say something.
              </p>
            </div>
          ) : (
            posts.map((post) => <PostCard key={post._id} post={post} />)
          )}
        </div>
      </main>
    </div>
  );
}
