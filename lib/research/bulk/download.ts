import { Readable } from "node:stream";
import { parse, type Options as CsvParseOptions } from "csv-parse";
import { ParseOne } from "unzipper";

export interface ZipDelimitedSource {
  url: string;
  entryPattern: RegExp;
  delimiter: string;
  columns: true | string[];
  userAgent: string;
  requestTimeoutMs: number;
}

export async function* streamZipDelimitedRows(
  source: ZipDelimitedSource,
): AsyncGenerator<Record<string, string>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), source.requestTimeoutMs);
  let archive: Readable | undefined;
  let entry: ReturnType<typeof ParseOne> | undefined;
  let parser: ReturnType<typeof parse> | undefined;
  try {
    const response = await fetch(source.url, {
      headers: { Accept: "application/zip", "User-Agent": source.userAgent },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`Official bulk download failed with HTTP ${response.status}`);
    }
    archive = Readable.fromWeb(response.body as never);
    entry = archive.pipe(ParseOne(source.entryPattern));
    archive.on("error", (error) => entry?.destroy(error));
    const options: CsvParseOptions = {
      delimiter: source.delimiter,
      columns: source.columns,
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
    };
    parser = entry.pipe(parse(options));
    entry.on("error", (error) => parser?.destroy(error));
    for await (const row of parser) yield row as Record<string, string>;
  } finally {
    clearTimeout(timeout);
    // Early bounded exits intentionally cancel the remaining large download.
    // Attach cleanup listeners first so Node does not surface cancellation as
    // an unhandled stream error after the async generator has returned.
    const ignoreCancellation = () => undefined;
    archive?.on("error", ignoreCancellation);
    entry?.on("error", ignoreCancellation);
    parser?.on("error", ignoreCancellation);
    parser?.destroy();
    entry?.destroy();
    archive?.destroy();
    controller.abort();
  }
}
