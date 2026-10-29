type LogLevel = "info" | "warn" | "error";

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const blockedKeys = new Set(["body", "title", "rawBody", "content"]);
  return Object.fromEntries(Object.entries(data).filter(([key]) => !blockedKeys.has(key)));
}

export function logResearchEvent(
  level: LogLevel,
  event: string,
  data: Record<string, unknown> = {},
): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    module: "research",
    event,
    ...sanitize(data),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}
