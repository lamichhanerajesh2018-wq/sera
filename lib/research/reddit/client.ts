import {
  requireRedditCredentials,
  type RedditConfig,
} from "../config.ts";
import { logResearchEvent } from "../logger.ts";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_ORIGIN = "https://oauth.reddit.com";
const TOKEN_REFRESH_SKEW_MS = 60_000;

export type RedditApiErrorCategory =
  | "authentication"
  | "authorization"
  | "rate_limit"
  | "validation"
  | "network"
  | "server";

export class RedditApiError extends Error {
  constructor(
    message: string,
    readonly category: RedditApiErrorCategory,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "RedditApiError";
  }
}

export interface RedditPostData {
  id?: string;
  name?: string;
  subreddit?: string;
  title?: string;
  selftext?: string;
  author?: string;
  created_utc?: number;
  permalink?: string;
  domain?: string;
  is_self?: boolean;
  over_18?: boolean;
  locked?: boolean;
  stickied?: boolean;
  spoiler?: boolean;
  distinguished?: string | null;
  removed_by_category?: string | null;
  score?: number;
  num_comments?: number;
  upvote_ratio?: number;
}

interface RedditListing {
  data?: {
    children?: Array<{ kind?: string; data?: RedditPostData }>;
    after?: string | null;
  };
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
}

interface ClientDependencies {
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}

export class RedditApiClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => number;
  private accessToken?: string;
  private tokenRequest?: Promise<string>;
  private tokenExpiresAt = 0;
  private nextRequestAt = 0;
  private requestQueue: Promise<void> = Promise.resolve();
  private _requestCount = 0;

  constructor(
    private readonly config: RedditConfig,
    private readonly maximumRequests = config.maximumRequestsPerRun,
    dependencies: ClientDependencies = {},
  ) {
    this.fetchImplementation = dependencies.fetch || fetch;
    this.sleep = dependencies.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = dependencies.now || Date.now;
  }

  get requestCount(): number {
    return this._requestCount;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt - TOKEN_REFRESH_SKEW_MS > this.now()) {
      return this.accessToken;
    }
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = this.requestAccessToken();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = undefined;
    }
  }

  private async requestAccessToken(): Promise<string> {
    const credentials = requireRedditCredentials(this.config);
    const authorization = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64");
    const response = await this.fetchWithRetry(
      TOKEN_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": credentials.userAgent,
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
      },
      "token",
    );
    const payload = (await response.json().catch(() => null)) as TokenResponse | null;
    if (
      !payload ||
      typeof payload.access_token !== "string" ||
      !payload.access_token ||
      payload.token_type?.toLowerCase() !== "bearer" ||
      typeof payload.expires_in !== "number" ||
      payload.expires_in <= 0
    ) {
      throw new RedditApiError("Reddit returned an invalid access-token response", "authentication", response.status);
    }
    this.accessToken = payload.access_token;
    this.tokenExpiresAt = this.now() + payload.expires_in * 1_000;
    return this.accessToken;
  }

  async searchPosts(input: {
    community: string;
    query: string;
    sort: string;
    timeFilter: string;
    limit: number;
  }): Promise<RedditPostData[]> {
    const parameters = new URLSearchParams({
      q: input.query,
      restrict_sr: "on",
      sort: input.sort,
      t: input.timeFilter,
      limit: String(input.limit),
      type: "link",
      raw_json: "1",
    });
    const listing = await this.requestJson<RedditListing>(
      `/r/${encodeURIComponent(input.community)}/search?${parameters.toString()}`,
    );
    return (listing.data?.children || [])
      .filter((child) => child.kind === "t3" && child.data)
      .map((child) => child.data!);
  }

  async requestJson<T>(path: string): Promise<T> {
    if (!path.startsWith("/")) {
      throw new RedditApiError("Reddit API paths must begin with /", "validation");
    }
    const request = async () => {
      const credentials = requireRedditCredentials(this.config);
      const token = await this.getAccessToken();
      return this.fetchWithRetry(
        `${API_ORIGIN}${path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": credentials.userAgent,
          },
        },
        "api",
      );
    };

    let response: Response;
    try {
      response = await request();
    } catch (error) {
      if (!(error instanceof RedditApiError) || error.status !== 401) throw error;
      this.accessToken = undefined;
      this.tokenExpiresAt = 0;
      response = await request();
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new RedditApiError("Reddit returned malformed JSON", "server", response.status);
    }
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    requestKind: "token" | "api",
  ): Promise<Response> {
    let lastError: RedditApiError | undefined;
    for (let attempt = 0; attempt <= this.config.retryLimit; attempt += 1) {
      if (attempt > 0) {
        const delay = lastError?.retryAfterMs ?? this.config.retryBaseDelayMs * 2 ** (attempt - 1);
        logResearchEvent("warn", "reddit_request_retry", {
          requestKind,
          category: lastError?.category,
          status: lastError?.status,
          attempt,
          delayMs: delay,
        });
        await this.sleep(delay);
      }
      try {
        const response = await this.performFetch(url, init);
        this.applyRateLimitHeaders(response.headers);
        if (response.ok) return response;
        const error = this.errorFromResponse(response, requestKind);
        if (!this.isRetryable(error) || attempt === this.config.retryLimit) throw error;
        lastError = error;
      } catch (error) {
        const redditError = this.toNetworkError(error);
        if (!this.isRetryable(redditError) || attempt === this.config.retryLimit) throw redditError;
        lastError = redditError;
      }
    }
    throw lastError || new RedditApiError("Reddit request failed", "network");
  }

  private async performFetch(url: string, init: RequestInit): Promise<Response> {
    await this.reserveRequestStart();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      const response = await this.fetchImplementation(url, { ...init, signal: controller.signal });
      return response;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new RedditApiError("Reddit request timed out", "network");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async reserveRequestStart(): Promise<void> {
    let release!: () => void;
    const previous = this.requestQueue;
    this.requestQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      if (this._requestCount >= this.maximumRequests) {
        throw new RedditApiError(
          `Reddit request limit reached (${this.maximumRequests})`,
          "rate_limit",
        );
      }
      const waitMs = Math.max(0, this.nextRequestAt - this.now());
      if (waitMs) await this.sleep(waitMs);
      this._requestCount += 1;
      this.nextRequestAt = this.now() + this.config.requestPacingMs;
    } finally {
      release();
    }
  }

  private applyRateLimitHeaders(headers: Headers): void {
    const remaining = Number(headers.get("x-ratelimit-remaining"));
    const resetSeconds = Number(headers.get("x-ratelimit-reset"));
    if (Number.isFinite(remaining) && remaining <= 0 && Number.isFinite(resetSeconds) && resetSeconds > 0) {
      this.nextRequestAt = Math.max(this.nextRequestAt, this.now() + resetSeconds * 1_000);
    }
  }

  private errorFromResponse(response: Response, requestKind: "token" | "api"): RedditApiError {
    const retryAfterHeader = response.headers.get("retry-after");
    const resetHeader = response.headers.get("x-ratelimit-reset");
    const retryAfter = retryAfterHeader === null ? undefined : Number(retryAfterHeader);
    const reset = resetHeader === null ? undefined : Number(resetHeader);
    const retryAfterMs = retryAfter !== undefined && Number.isFinite(retryAfter) && retryAfter >= 0
      ? retryAfter * 1_000
      : reset !== undefined && Number.isFinite(reset) && reset >= 0
        ? reset * 1_000
        : undefined;
    if (response.status === 401) {
      return new RedditApiError(
        requestKind === "token" ? "Reddit rejected the configured credentials" : "Reddit access token was rejected",
        "authentication",
        response.status,
      );
    }
    if (response.status === 403) return new RedditApiError("Reddit resource is forbidden", "authorization", 403);
    if (response.status === 404) return new RedditApiError("Reddit resource was not found", "validation", 404);
    if (response.status === 429) return new RedditApiError("Reddit rate limit reached", "rate_limit", 429, retryAfterMs);
    if (response.status >= 500) return new RedditApiError("Reddit server error", "server", response.status, retryAfterMs);
    return new RedditApiError(`Reddit request failed with status ${response.status}`, "validation", response.status);
  }

  private toNetworkError(error: unknown): RedditApiError {
    if (error instanceof RedditApiError) return error;
    return new RedditApiError(
      error instanceof Error && error.name === "AbortError"
        ? "Reddit request timed out"
        : "Reddit network request failed",
      "network",
    );
  }

  private isRetryable(error: RedditApiError): boolean {
    if (error.category === "rate_limit" && error.status === undefined) return false;
    return ["network", "server", "rate_limit"].includes(error.category);
  }
}
