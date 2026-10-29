import Link from "next/link";
import { getResearchOverview } from "@/lib/research/admin/data";
import { overviewCards } from "@/lib/research/admin/core";
import { Card, Distribution, MetricCard, PageTitle, StatusPill, formatDate, money } from "./_components";

export const metadata = { title: "Research overview — Sera admin" };

export default async function ResearchOverviewPage() {
  const { stats, runs } = await getResearchOverview();
  const cards = overviewCards(stats);
  return <><PageTitle title="Research overview" description="Authenticated snapshot of collection, extraction, deduplication, review and quality state. No jobs can be launched here." />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value]) => <MetricCard key={label} label={label}
      value={label === "Reported model cost" ? money(value) : value} />)}</div>
    <div className="mt-6 grid gap-4 md:grid-cols-3"><Distribution title="Signals by source" values={stats.bySource}/><Distribution title="Signals by industry" values={stats.byIndustrySeed}/><Distribution title="Extraction status" values={stats.byProcessingStatus}/></div>
    <div className="mt-4 grid gap-4 md:grid-cols-2"><Distribution title="Raw geography evidence" values={stats.byGeographyEvidence}/><Distribution title="Mention geography" values={stats.extraction.geographyDistribution}/></div>
    <div className="mt-6 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Recent runs</h2><Link className="text-sm text-primary hover:underline" href="/admin/research/runs">All runs →</Link></div>
    <div className="mt-3 grid gap-3 lg:grid-cols-2">{runs.slice(0, 8).map((run) => <Card key={`${run.type}:${run.id}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{run.type}</p><p className="mt-1 font-medium">{run.sourceOrModel}</p><p className="text-xs text-muted-foreground">{run.version}</p></div><div className="text-right"><StatusPill value={run.status}/><p className="mt-2 text-xs text-muted-foreground">{formatDate(run.startedAt)}</p></div></div>
      <p className="mt-3 text-xs text-muted-foreground">Attempted {run.attempted ?? "—"} · Failed {run.failed ?? "—"} {run.dryRun ? "· dry run" : ""}</p></Card>)}</div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2"><Card><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest quality state</p><p className="mt-2">Critical audit gates: {stats.quality.criticalAuditFindings}</p><Link href="/admin/research/quality" className="mt-2 inline-block text-sm text-primary">Inspect quality →</Link></Card>
      <Card><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest readiness</p><div className="mt-2"><StatusPill value={stats.quality.latestReadinessStatus || "INSUFFICIENT_REVIEW_DATA"}/></div><p className="mt-2 text-xs text-muted-foreground">The dashboard never changes readiness automatically.</p></Card></div></>;
}
