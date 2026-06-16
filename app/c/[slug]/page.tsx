// app/c/[slug]/page.tsx
// A single community: header with join button, post composer, and its posts.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getCommunityBySlug } from "@/app/actions/communities";
import { listCommunityPosts } from "@/app/actions/posts";
import AppBar from "@/components/AppBar";
import PostComposer from "@/components/PostComposer";
import PostCard from "@/components/PostCard";
import JoinButton from "@/components/JoinButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  return { title: community ? `${community.name} — Sera` : "Community — Sera" };
}

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const handle = (me as any).username || (me as any).displayUsername || "anon";
  const community = await getCommunityBySlug(slug);
  if (!community) notFound();

  const posts = await listCommunityPosts(slug);

  return (
    <div className="flex flex-1 flex-col">
      <AppBar handle={handle} />

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link
          href="/communities"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← All communities
        </Link>

        {/* community header */}
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
              🌐
            </span>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-medium">{community.name}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {community.memberCount} {community.memberCount === 1 ? "member" : "members"}
              </p>
            </div>
            <JoinButton communityId={community._id} initialJoined={!!community.isMember} />
          </div>
          {community.description && (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{community.description}</p>
          )}
        </div>

        {/* composer */}
        <div className="mt-6">
          <PostComposer handle={handle} communitySlug={slug} />
        </div>

        {/* posts */}
        <div className="mt-6 space-y-4">
          {posts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
              <p className="text-3xl">🕯️</p>
              <p className="mt-3 text-sm text-muted-foreground">
                No posts in here yet. Be the first.
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
