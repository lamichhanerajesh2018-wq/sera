import Link from "next/link";
import { notFound } from "next/navigation";
import { getResearchRawSignal } from "@/lib/research/admin/data";
import { Card, DefinitionList, PageTitle, SafeText, StatusPill, formatDate } from "../../_components";

export default async function RawSignalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const raw = await getResearchRawSignal((await params).id); if (!raw) notFound();
  return <><div className="mb-3"><Link href="/admin/research/signals" className="text-sm text-primary">← Raw signals</Link></div><PageTitle title={raw.title} description={`${raw.source} · source ID ${raw.sourceId}`}/>
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]"><Card><h2 className="text-sm font-semibold">Original public source text</h2><div className="mt-3 max-h-[42rem] overflow-auto rounded-xl bg-muted/40 p-4 text-sm leading-6"><SafeText text={raw.body}/></div>
      <a className="mt-3 inline-block text-sm text-primary hover:underline" href={raw.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">Open authorized source ↗</a></Card>
      <div className="space-y-4"><Card><DefinitionList items={[["Processing",<StatusPill key="s" value={raw.processingStatus}/>],["Geography",<StatusPill key="g" value={raw.geographyEvidence}/>],["Community",raw.sourceCommunity],["Industry",raw.industrySeed],["Published",formatDate(raw.publishedAt)],["Collected",formatDate(raw.collectedAt)],["Retries",raw.retryCount],["Rejection",raw.rejectionReason],["Safe error",raw.errorMessage]]}/></Card>
      <Card><h2 className="mb-3 text-sm font-semibold">Safe source metadata</h2><DefinitionList items={Object.entries(raw.metadata).map(([key,value])=>[key,String(value)])}/></Card>
      <Card><h2 className="mb-3 text-sm font-semibold">Collection</h2>{raw.collectionRun ? <DefinitionList items={[["Run",raw.collectionRun.id],["Collector",raw.collectionRun.collectorName],["Status",<StatusPill key="r" value={raw.collectionRun.status}/>],["Dry run",raw.collectionRun.dryRun ? "Yes":"No"],["Started",formatDate(raw.collectionRun.startedAt)]]}/> : <p className="text-sm text-muted-foreground">No linked collection run.</p>}</Card>
      <Card><h2 className="mb-2 text-sm font-semibold">Extraction result</h2>{raw.mention ? <Link className="text-sm text-primary hover:underline" href={`/admin/research/mentions/${raw.mention.id}`}>{raw.mention.canonicalProblem}</Link>:<p className="text-sm text-muted-foreground">No linked ProblemMention.</p>}</Card></div></div></>;
}
