import Link from "next/link";
import { listResearchRawSignals } from "@/lib/research/admin/data";
import { EmptyState, FilterBar, Pager, PageTitle, SelectInput, StatusPill, Table, TextInput, formatDate } from "../_components";

type Search = Record<string, string | string[] | undefined>;
const one = (params: Search, key: string) => { const value = params[key]; return Array.isArray(value) ? value[0] : value; };

export default async function RawSignalsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const input = { page: one(params,"page"), pageSize: one(params,"pageSize"), source: one(params,"source"), status: one(params,"status"),
    geography: one(params,"geography"), industry: one(params,"industry"), community: one(params,"community"), collectionRun: one(params,"collectionRun"),
    dateMin: one(params,"dateMin"), dateMax: one(params,"dateMax"), search: one(params,"search"), sort: one(params,"sort"), direction: one(params,"direction") };
  const result = await listResearchRawSignals(input);
  return <><PageTitle title="Raw signals" description="Privacy-minimized source records. Author identifiers and ZIP codes are omitted." count={result.total}/>
    <FilterBar><TextInput name="search" label="Text search" value={input.search} placeholder="Title, body or source ID"/>
      <SelectInput name="source" label="Source" value={input.source} options={[["cfpb","CFPB"],["reddit","Reddit"],["manual_import","Manual import"]]}/>
      <SelectInput name="status" label="Processing status" value={input.status} options={[["pending","Pending"],["processing","Processing"],["processed","Processed"],["no_problem","No problem"],["failed","Failed"],["ignored","Ignored"]]}/>
      <SelectInput name="geography" label="Geography evidence" value={input.geography} options={[["explicit_us","Explicit US"],["us_context","US context"],["unknown","Unknown"],["non_us","Non-US"]]}/>
      <TextInput name="industry" label="Industry" value={input.industry}/><TextInput name="community" label="Community" value={input.community}/>
      <TextInput name="collectionRun" label="Collection run ID" value={input.collectionRun}/><TextInput name="dateMin" label="Published from" type="date" value={input.dateMin}/>
      <TextInput name="dateMax" label="Published to" type="date" value={input.dateMax}/><SelectInput name="sort" label="Sort" value={input.sort} options={[["created","Created"],["published","Published"],["source","Source"],["status","Status"]]}/></FilterBar>
    {result.rows.length ? <Table headers={["Source","Community / product","Title / preview","Published","Geography","Industry","Status","Collection run","Created"]}>{result.rows.map((row) => <tr key={row.id} className="align-top hover:bg-muted/20">
      <td className="px-3 py-3 font-medium">{row.source}</td><td className="max-w-44 px-3 py-3">{row.communityOrProduct}</td><td className="max-w-sm px-3 py-3"><Link className="font-medium text-primary hover:underline" href={`/admin/research/signals/${row.id}`}>{row.title}</Link><p className="mt-1 text-xs leading-5 text-muted-foreground">{row.bodyPreview}</p></td>
      <td className="px-3 py-3 text-xs">{formatDate(row.publishedAt)}</td><td className="px-3 py-3"><StatusPill value={row.geographyEvidence}/></td><td className="px-3 py-3">{row.industrySeed || "—"}</td><td className="px-3 py-3"><StatusPill value={row.processingStatus}/></td>
      <td className="px-3 py-3 font-mono text-xs">{row.collectionRunId?.slice(-8) || "—"}</td><td className="px-3 py-3 text-xs">{formatDate(row.createdAt)}</td></tr>)}</Table> : <EmptyState/>}
    <Pager page={result.page} pages={result.pages} params={Object.fromEntries(Object.entries(input).map(([k,v])=>[k,v === undefined ? undefined : String(v)]))}/></>;
}
