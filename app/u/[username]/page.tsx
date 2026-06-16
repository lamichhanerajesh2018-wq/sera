// app/u/[username]/page.tsx
// Public anonymous profile. Shows a handle, join date, post count and the
// user's posts — nothing that ties back to a real identity.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getProfile, getProfilePosts } from "@/app/actions/profile";
import AppBar from "@/components/AppBar";
import PostCard from "@/components/PostCard";
import MessageButton from "@/components/MessageButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return { title: `@${username} — Sera` };
}

function joinedLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const myHandle = (me as any).username || (me as any).displayUsername || "anon";

  const profile = await getProfile(username);
  if (!profile) notFound();

  const posts = await getProfilePosts(profile.username);

  return (
    <div className="flex flex-1 flex-col">
      <AppBar handle={myHandle} />

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link
          href="/feed"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to feed
        </Link>

        {/* profile header */}
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-2xl">
              🕶️
            </span>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-medium">@{profile.username}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Anonymous · {profile.postCount} {profile.postCount === 1 ? "post" : "posts"}
                {profile.joinedAt && ` · joined ${joinedLabel(profile.joinedAt)}`}
              </p>
            </div>
            {profile.isMe ? (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                This is you
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href={`/ask/${profile.username}`}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary/40"
                >
                  Ask
                </Link>
                <MessageButton username={profile.username} />
              </div>
            )}
          </div>
        </div>

        {/* posts */}
        <div className="mt-6 space-y-4">
          {posts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
              <p className="text-3xl">🕯️</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {profile.isMe
                  ? "You haven't posted anything yet."
                  : "No posts yet."}
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
