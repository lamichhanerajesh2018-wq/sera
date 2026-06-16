// app/inbox/page.tsx
// The user's anonymous-question inbox: share link on top, received questions
// below with answer/delete controls.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listInbox } from "@/app/actions/questions";
import AppBar from "@/components/AppBar";
import ShareLink from "@/components/ShareLink";
import InboxItem from "@/components/InboxItem";

export const metadata = { title: "Your inbox — Sera" };

export default async function InboxPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const handle = (me as any).username || (me as any).displayUsername || "anon";
  const questions = await listInbox();
  const unanswered = questions.filter((q) => !q.answer).length;

  return (
    <div className="flex flex-1 flex-col">
      <AppBar handle={handle} />

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-4">
          <h1 className="font-display text-2xl font-medium">Your inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {questions.length === 0
              ? "Anonymous messages people send you land here."
              : `${questions.length} message${questions.length === 1 ? "" : "s"}` +
                (unanswered ? ` · ${unanswered} unanswered` : "")}
          </p>
        </div>

        <ShareLink handle={handle} />

        <div className="mt-6 space-y-4">
          {questions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
              <p className="text-3xl">📭</p>
              <p className="mt-3 text-sm text-muted-foreground">
                No messages yet. Share your link above to start receiving them.
              </p>
            </div>
          ) : (
            questions.map((q) => <InboxItem key={q._id} question={q} />)
          )}
        </div>
      </main>
    </div>
  );
}
