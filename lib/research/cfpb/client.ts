import { logResearchEvent } from "../logger.ts";
import type { CfpbConfig } from "../config.ts";

export type CfpbApiErrorCategory = "rate_limit" | "validation" | "network" | "server";

export class CfpbApiError extends Error {
  constructor(
    message: string,
    readonly category: CfpbApiErrorCategory,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "CfpbApiError";
  }
}

export interface CfpbComplaint {
  complaint_id?: number | string;
  complaint_what_happened?: string;
  date_received?: string;
  product?: string;
  sub_product?: string;
  issue?: string;
  sub_issue?: string;
  company?: string;
  state?: string;
  submitted_via?: string;
  company_response?: string;
  company_public_response?: string;
  zip_code?: string;
  [key: string]: unknown;
}

interface CfpbSearchResponse {
  _meta?: {
    is_data_stale?: boolean;
    is_narrative_stale?: boolean;
    last_updated?: string;
    break_points?: Record<string, [number | string, number | string]>;
  };
  hits?: {
    total?: { value?: number; relation?: string };
    hits?: Array<{ _source?: CfpbComplaint }>;
  };
}

export interface CfpbPage {
  records: CfpbComplaint[];
  total: number;
  dataStale: boolean;
  narrativeStale: boolean;
  lastUpdated?: string;
  nextSearchAfter?: string;
}

interface ClientDependencies {
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

function retryAfterMilliseconds(headers: Headers) {
  const raw = headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

export class CfpbApiClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private _requestCount = 0;

  constructor(
    private readonly config: CfpbConfig,
    private readonly maximumRequests = config.maximumRequestsPerRun,
    dependencies: ClientDependencies = {},
  ) {
    this.fetchImplementation = dependencies.fetch || fetch;
    this.sleep = dependencies.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  get requestCount() { return this._requestCount; }

  async fetchPage(input: {
    offset: number;
    size: number;
    page?: number;
    searchAfter?: string;
    dateReceivedMin?: string;
    dateReceivedMax?: string;
    products?: string[];
  }): Promise<CfpbPage> {
    const parameters = new URLSearchParams({
      frm: String(input.offset),
      size: String(input.size),
      has_narrative: "true",
      no_aggs: "true",
      no_highlight: "true",
      sort: "created_date_desc",
    });
    if (input.page && input.page > 1) parameters.set("page", String(input.page));
    if (input.searchAfter) parameters.set("search_after", input.searchAfter);
    if (input.dateReceivedMin) parameters.set("date_received_min", input.dateReceivedMin);
    if (input.dateReceivedMax) parameters.set("date_received_max", input.dateReceivedMax);
    for (const product of input.products || []) parameters.append("product", product);
    const response = await this.fetchWithRetry(`${this.config.apiBaseUrl}?${parameters.toString()}`);
    const payload = await response.json().catch(() => null) as CfpbSearchResponse | null;
    if (!payload || !payload.hits || !Array.isArray(payload.hits.hits)) {
      throw new CfpbApiError("CFPB returned malformed search JSON", "server", response.status);
    }
    const nextPage = (input.page || 1) + 1;
    const nextBreakPoint = payload._meta?.break_points?.[String(nextPage)];
    return {
      records: payload.hits.hits.map((hit) => hit?._source || {}),
      total: typeof payload.hits.total?.value === "number" ? payload.hits.total.value : 0,
      dataStale: Boolean(payload._meta?.is_data_stale),
      narrativeStale: Boolean(payload._meta?.is_narrative_stale),
      ...(typeof payload._meta?.last_updated === "string" && { lastUpdated: payload._meta.last_updated }),
      ...(Array.isArray(nextBreakPoint) && nextBreakPoint.length === 2 && {
        nextSearchAfter: `${nextBreakPoint[0]}_${nextBreakPoint[1]}`,
      }),
    };
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    let lastError: CfpbApiError | undefined;
    for (let attempt = 0; attempt <= this.config.retryLimit; attempt += 1) {
      if (attempt > 0) {
        const delay = lastError?.retryAfterMs ?? this.config.retryBaseDelayMs * 2 ** (attempt - 1);
        logResearchEvent("warn", "cfpb_request_retry", {
          category: lastError?.category, status: lastError?.status, attempt, delayMs: delay,
        });
        await this.sleep(delay);
      }
      try {
        if (this._requestCount >= this.maximumRequests) {
          throw new CfpbApiError("CFPB request limit reached", "validation");
        }
        this._requestCount += 1;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
        try {
          const response = await this.fetchImplementation(url, {
            headers: { Accept: "application/json", "User-Agent": this.config.userAgent },
            signal: controller.signal,
          });
          if (response.ok) return response;
          const error = response.status === 429
            ? new CfpbApiError("CFPB rate limit exceeded", "rate_limit", response.status, retryAfterMilliseconds(response.headers))
            : response.status >= 500
              ? new CfpbApiError("CFPB server request failed", "server", response.status)
              : new CfpbApiError("CFPB rejected the request", "validation", response.status);
          if (!this.isRetryable(error) || attempt === this.config.retryLimit) throw error;
          lastError = error;
        } finally { clearTimeout(timeout); }
      } catch (error) {
        const converted = error instanceof CfpbApiError ? error
          : new CfpbApiError(error instanceof Error && error.name === "AbortError" ? "CFPB request timed out" : "CFPB network request failed", "network");
        if (!this.isRetryable(converted) || attempt === this.config.retryLimit) throw converted;
        lastError = converted;
      }
    }
    throw lastError || new CfpbApiError("CFPB request failed", "network");
  }

  private isRetryable(error: CfpbApiError) {
    return error.category === "network" || error.category === "rate_limit" || error.category === "server";
  }
}
