// app/post/[id]/page.tsx
// A single confession with its full comment thread. Signed-in only.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPost } from "@/app/actions/posts";
import { listComments } from "@/app/actions/comments";
import AppBar from "@/components/AppBar";
import PostCard from "@/components/PostCard";
import CommentForm from "@/components/CommentForm";
import CommentThread from "@/components/CommentThread";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const handle = (user as any).username || (user as any).displayUsername || "anon";
  const post = await getPost(id);
  if (!post) notFound();

  const comments = await listComments(id);

  return (
    <div className="flex flex-1 flex-col">
      <AppBar handle={handle} />

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link
          href="/feed"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to feed
        </Link>

        <PostCard post={post} />

        <div className="mt-6">
          <h2 className="mb-3 font-display text-lg font-medium">
            {comments.length > 0 ? `${comments.length} replies` : "Replies"}
          </h2>

          <div className="mb-6">
            <CommentForm postId={id} placeholder="Share a reply, anonymously…" />
          </div>

          <CommentThread postId={id} comments={comments} />
        </div>
      </main>
    </div>
  );
}
