// app/settings/invites/page.tsx
// Your invites: personal invite link, total referral count, and the list of
// people who joined through your link.
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getMyReferrals } from "@/app/actions/referrals";
import AppBar from "@/components/AppBar";
import InviteLink from "@/components/InviteLink";

export const metadata = { title: "Your invites — Sera" };

function joinedLabel(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function InvitesPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const handle = (me as any).username || (me as any).displayUsername || "anon";
  const { count, invitees } = await getMyReferrals();

  return (
    <div className="flex flex-1 flex-col">
      <AppBar handle={handle} />

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-4">
          <h1 className="font-display text-2xl font-medium">Invite people to Sera</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your link and grow your circle. You stay anonymous either way.
          </p>
        </div>

        <InviteLink handle={handle} />

        {/* count */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-6 text-center">
          <p className="font-display text-4xl font-medium text-primary">{count}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {count === 1 ? "person joined" : "people joined"} through your link
          </p>
        </div>

        {/* invited list */}
        <div className="mt-6">
          <h2 className="mb-3 font-display text-lg font-medium">People you invited</h2>
          <div className="space-y-2">
            {invitees.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
                <p className="text-3xl">🌱</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  No one yet. Share your link to start growing your circle.
                </p>
              </div>
            ) : (
              invitees.map((u) => (
                <div
                  key={u.username}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-base">
                    🕶️
                  </span>
                  <Link
                    href={`/u/${u.username}`}
                    className="flex-1 font-medium transition-colors hover:text-primary"
                  >
                    @{u.username}
                  </Link>
                  {u.joinedAt && (
                    <span className="text-xs text-muted-foreground">{joinedLabel(u.joinedAt)}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
