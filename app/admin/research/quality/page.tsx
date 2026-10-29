import { getResearchQuality } from "@/lib/research/admin/data";
import { Card, MetricCard, PageTitle, SafeText, StatusPill, formatDate, percent } from "../_components";
import { readinessDisplayState } from "@/lib/research/admin/core";

export default async function ResearchQualityPage() {
  const quality = await getResearchQuality(); const metrics=quality.metrics;
  const values = [
    ["Extraction precision",percent(metrics.extractionPrecision)],["Extraction recall",percent(metrics.extractionRecall)],
    ["Extraction F1",percent(metrics.extractionF1)],["Grounding accuracy",percent(metrics.groundingAccuracy)],
    ["Unsupported-field rate",percent(metrics.unsupportedFieldRate)],["Solution-bias rate",percent(metrics.solutionBiasRate)],
    ["Duplicate merge precision",percent(metrics.deduplicationMergePrecision)],["Duplicate recall",percent(metrics.duplicateRecall)],
    ["Geography accuracy",percent(metrics.geographyAccuracy)],["Reviewer agreement",percent(metrics.reviewerAgreement)],
    ["Reviewer disagreement",percent(metrics.reviewerDisagreementRate)],["Cohen’s kappa",metrics.cohensKappa.toFixed(3)],
    ["Pending reviews",metrics.pendingReviews],
    ["Completed reviews",metrics.completedReviews],["Critical audit gates",metrics.criticalAuditFindings],
  ] as const;
  const readiness=quality.readiness;
  const readinessDisplay = readinessDisplayState(readiness);
  return <><PageTitle title="Research quality" description="Existing Phase 5 evaluation, review, audit and readiness outputs only. This page does not invent metrics or change thresholds."/>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{values.map(([label,value])=><MetricCard key={label} label={label} value={value}/>)}</div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2"><Card><div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Latest readiness</h2><p className="mt-1 text-xs text-muted-foreground">Saved report; never recalculated automatically in this UI.</p></div><StatusPill value={readinessDisplay.status}/></div>{readiness?<><p className="mt-3 text-sm">Reviewed sample: {readiness.reviewedSampleSize} · generated {formatDate(readiness.generatedAt)}</p><div className="mt-4 space-y-2">{Object.entries(readiness.gates).map(([name,gate])=><div key={name} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-2 text-xs"><span>{name}</span><span><StatusPill value={gate.passed?"passed":"failed"}/> {gate.actual} {gate.comparator} {gate.required}</span></div>)}</div><h3 className="mt-4 text-xs font-semibold uppercase text-muted-foreground">Why this state</h3><p className="mt-2 text-sm text-muted-foreground"><SafeText text={readinessDisplay.explanation}/></p></>:<p className="mt-4 text-sm text-muted-foreground">{readinessDisplay.explanation}</p>}</Card>
    <Card><h2 className="font-display text-lg font-semibold">Latest evaluation</h2>{quality.latestEvaluation?<><p className="mt-2 text-sm">{quality.latestEvaluation.type} · sample {quality.latestEvaluation.sampleSize} · {formatDate(quality.latestEvaluation.completedAt)}</p><pre className="mt-3 max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-xs">{JSON.stringify(quality.latestEvaluation.metrics,null,2)}</pre></>:<p className="mt-4 text-sm text-muted-foreground">No saved evaluation run.</p>}</Card></div>
    <Card className="mt-4"><div className="flex justify-between"><div><h2 className="font-display text-lg font-semibold">Latest bounded cluster audit</h2><p className="text-xs text-muted-foreground">Current report-only sample of at most 10 active or needs-review clusters.</p></div><StatusPill value="report_only"/></div><div className="mt-4 grid gap-3 md:grid-cols-2">{quality.clusterAudit.clusters.map((cluster,i)=><article key={i} className="rounded-xl border border-border p-3"><p className="font-medium"><SafeText text={cluster.canonicalProblem}/></p><p className="mt-2 text-xs text-muted-foreground">{cluster.sources.join(", ")} · {cluster.geography} · {cluster.mentionVariants.length} sampled mentions</p><div className="mt-2 flex flex-wrap gap-1">{cluster.flags.length?cluster.flags.map(flag=><StatusPill key={flag} value={flag}/>):<StatusPill value="no_flags"/>}</div></article>)}</div>{!quality.clusterAudit.clusters.length&&<p className="mt-4 text-sm text-muted-foreground">No unique-problem clusters available.</p>}</Card></>;
}
