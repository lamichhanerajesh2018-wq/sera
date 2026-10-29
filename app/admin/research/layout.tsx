import Link from "next/link";
import { logoutAdmin } from "@/app/actions/admin-auth";
import { requireResearchAdmin } from "@/lib/research/admin/data";

export const dynamic = "force-dynamic";

const links = [
  ["Overview", "/admin/research"], ["Raw signals", "/admin/research/signals"],
  ["Problem mentions", "/admin/research/mentions"], ["Unique problems", "/admin/research/problems"],
  ["Human review", "/admin/research/reviews"], ["Runs", "/admin/research/runs"], ["Quality", "/admin/research/quality"],
];

export default async function ResearchAdminLayout({ children }: { children: React.ReactNode }) {
  await requireResearchAdmin();
  return <div className="min-h-screen bg-background"><header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3"><div>
      <Link href="/admin/research" className="font-display text-lg font-semibold">Research Admin</Link>
      <p className="text-[11px] text-muted-foreground">Private · report and review only</p></div>
      <nav aria-label="Research admin" className="flex flex-wrap gap-1 text-xs">{links.map(([label, href]) => <Link key={href} href={href}
        className="rounded-full px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">{label}</Link>)}</nav>
      <div className="flex gap-2"><Link href="/admin/stats" className="rounded-full border border-border px-3 py-1.5 text-xs">Sera admin</Link>
        <form action={logoutAdmin}><button className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">Sign out</button></form></div></div>
  </header><main className="mx-auto max-w-7xl px-4 py-6">{children}</main></div>;
}
