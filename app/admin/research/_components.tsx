import Link from "next/link";
import type { ReactNode } from "react";

export function SafeText({ text, empty = "Not available", className = "" }: { text?: string | null; empty?: string; className?: string }) {
  return <span className={`whitespace-pre-wrap break-words ${className}`}>{text || <span className="italic text-muted-foreground">{empty}</span>}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-card p-4 ${className}`}>{children}</section>;
}

export function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <Card><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
    {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</Card>;
}

export function StatusPill({ value }: { value?: string | null }) {
  const style = value?.includes("fail") || value === "NOT_READY" ? "border-destructive/30 bg-destructive/10 text-destructive"
    : value?.includes("review") || value === "INSUFFICIENT_REVIEW_DATA" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : value === "completed" || value === "accepted" || value === "active" || value === "READY" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-border bg-muted/50 text-muted-foreground";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${style}`}>{value || "unknown"}</span>;
}

export function PageTitle({ title, description, count }: { title: string; description: string; count?: number }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-2xl font-semibold">{title}</h1>
    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p></div>
    {count !== undefined && <p className="text-sm tabular-nums text-muted-foreground">{count.toLocaleString()} records</p>}</div>;
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <form className="mb-4 grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">{children}<div className="flex gap-2 lg:col-span-4">
    <button className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Apply filters</button>
    <Link href="?" className="rounded-lg border border-border px-3 py-2 text-sm">Clear</Link></div></form>;
}

export function TextInput({ name, label, value, type = "text", placeholder }: { name: string; label: string; value?: string; type?: string; placeholder?: string }) {
  return <label className="text-xs font-medium text-muted-foreground">{label}<input name={name} type={type} defaultValue={value}
    placeholder={placeholder} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground" /></label>;
}

export function SelectInput({ name, label, value, options }: { name: string; label: string; value?: string; options: Array<[string, string]> }) {
  return <label className="text-xs font-medium text-muted-foreground">{label}<select name={name} defaultValue={value || ""}
    className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground"><option value="">All</option>
    {options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>;
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <div className="overflow-x-auto rounded-2xl border border-border bg-card"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground"><tr>
    {headers.map((header) => <th key={header} className="px-3 py-2.5 font-semibold">{header}</th>)}</tr></thead><tbody className="divide-y divide-border">{children}</tbody></table></div>;
}

export function EmptyState({ children = "No matching records." }: { children?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Pager({ page, pages, params }: { page: number; pages: number; params: Record<string, string | undefined> }) {
  const href = (next: number) => { const query = new URLSearchParams(); for (const [key, value] of Object.entries(params)) if (value && key !== "page") query.set(key, value); query.set("page", String(next)); return `?${query}`; };
  return <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm"><span className="text-muted-foreground">Page {page} of {pages}</span><div className="flex gap-2">
    {page > 1 ? <Link className="rounded-lg border border-border px-3 py-1.5" href={href(page - 1)}>Previous</Link> : <span />}
    {page < pages && <Link className="rounded-lg border border-border px-3 py-1.5" href={href(page + 1)}>Next</Link>}</div></nav>;
}

export function DefinitionList({ items }: { items: Array<[string, ReactNode]> }) {
  return <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{items.map(([label, value]) => <div key={label}><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value || <span className="italic text-muted-foreground">Not available</span>}</dd></div>)}</dl>;
}

export function Distribution({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values).slice(0, 12); const max = Math.max(1, ...entries.map(([, count]) => count));
  return <Card><h2 className="text-sm font-semibold">{title}</h2>{entries.length ? <ul className="mt-3 space-y-2">{entries.map(([label, count]) => <li key={label}>
    <div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate">{label}</span><span className="tabular-nums text-muted-foreground">{count}</span></div>
    <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${(count / max) * 100}%` }} /></div></li>)}</ul>
    : <p className="mt-3 text-sm text-muted-foreground">No data yet.</p>}</Card>;
}

export function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString() : "—"; }
export function percent(value: number) { return `${(value * 100).toFixed(1)}%`; }
export function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 6 }).format(value); }
