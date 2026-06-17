// lib/format.ts
// Small display helpers (no server logic, safe to import anywhere).

// Format a count for display: small numbers exact, larger ones rounded with a
// "+" (e.g. 12,345 → "12,000+"). Keeps the homepage honest but tidy.
export function formatStat(n: number): string {
  if (n < 10) return String(n);
  if (n < 100) return `${Math.floor(n / 10) * 10}+`;
  if (n < 1000) return `${Math.floor(n / 100) * 100}+`;
  if (n < 1_000_000) return `${(Math.floor(n / 1000) * 1000).toLocaleString()}+`;
  return `${(n / 1_000_000).toFixed(1)}M+`;
}
