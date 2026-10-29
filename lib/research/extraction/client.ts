import {
  requireOpenRouterConfiguration,
  type ExtractionConfig,
} from "../config.ts";
import { logResearchEvent } from "../logger.ts";
import type { RawSignalDocument } from "../types.ts";
import { buildExtractionUserPrompt, EXTRACTION_SYSTEM_PROMPT } from "./prompt.ts";
import { buildExtractionJsonSchema } from "./schema.ts";

const OPENROUTER_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

export type OpenRouterErrorCategory =
  | "authentication"
  | "payment"
  | "authorization"
  | "validation"
  | "rate_limit"
  | "network"
  | "server";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly category: OpenRouterErrorCategory,
    readonly status?: number,
    readonly retryAfterMs?: number,
    readonly retries = 0,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export interface OpenRouterUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface OpenRouterExtractionResult {
  output: unknown;
  model: string;
  usage: OpenRouterUsage;
  retryCount: number;
  inputTruncated: boolean;
  originalInputLength: number;
}

interface OpenRouterResponse {
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null };
    error?: { code?: number; message?: string; metadata?: { error_type?: string } };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
  error?: { code?: number; message?: string; metadata?: { error_type?: string } };
}

interface ClientDependencies {
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class OpenRouterExtractionClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    private readonly config: ExtractionConfig,
    dependencies: ClientDependencies = {},
  ) {
    this.fetchImplementation = dependencies.fetch || fetch;
    this.sleep = dependencies.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async extract(signal: RawSignalDocument, validationFeedback?: string): Promise<OpenRouterExtractionResult> {
    const credentials = requireOpenRouterConfiguration(this.config);
    const requestedEvidenceLength = Math.min(this.config.maximumEvidenceLength, 300);
    const { prompt, prepared } = buildExtractionUserPrompt(
      signal,
      this.config.maximumInputLength,
      requestedEvidenceLength,
      validationFeedback,
    );
    let lastError: OpenRouterError | undefined;
    for (let attempt = 0; attempt <= this.config.retryLimit; attempt += 1) {
      if (attempt > 0) {
        const delay = lastError?.retryAfterMs ?? this.config.retryBaseDelayMs * 2 ** (attempt - 1);
        logResearchEvent("warn", "openrouter_request_retry", {
          category: lastError?.category,
          status: lastError?.status,
          attempt,
          delayMs: delay,
        });
        await this.sleep(delay);
      }
      try {
        const response = await this.request(credentials.apiKey, credentials.model, prompt, requestedEvidenceLength);
        const payload = (await response.json().catch(() => null)) as OpenRouterResponse | null;
        if (!payload) throw new OpenRouterError("OpenRouter returned malformed JSON", "server", response.status);
        if (!response.ok || payload.error) throw this.responseError(response.status, payload.error, response.headers, attempt);
        const choice = payload.choices?.[0];
        if (choice?.error || choice?.finish_reason === "error") {
          throw this.responseError(choice.error?.code || 502, choice.error, response.headers, attempt);
        }
        const content = choice?.message?.content;
        if (!content) throw new OpenRouterError("OpenRouter returned no structured content", "server", 502, undefined, attempt);
        let output: unknown;
        try {
          output = JSON.parse(content);
        } catch {
          throw new OpenRouterError("OpenRouter structured content was not valid JSON", "validation", 422, undefined, attempt);
        }
        return {
          output,
          model: payload.model || credentials.model,
          usage: {
            inputTokens: payload.usage?.prompt_tokens || 0,
            outputTokens: payload.usage?.completion_tokens || 0,
            totalTokens: payload.usage?.total_tokens || 0,
            estimatedCost: payload.usage?.cost || 0,
          },
          retryCount: attempt,
          inputTruncated: prepared.truncated,
          originalInputLength: prepared.originalLength,
        };
      } catch (error) {
        const normalized = this.normalizeError(error, attempt);
        if (!this.isTransient(normalized) || attempt === this.config.retryLimit) throw normalized;
        lastError = normalized;
      }
    }
    throw lastError || new OpenRouterError("OpenRouter extraction failed", "server");
  }

  private async request(
    apiKey: string,
    model: string,
    prompt: string,
    requestedEvidenceLength: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      return await this.fetchImplementation(OPENROUTER_COMPLETIONS_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(this.config.siteUrl && { "HTTP-Referer": this.config.siteUrl }),
          ...(this.config.appName && { "X-Title": this.config.appName }),
        },
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0,
          max_tokens: this.config.maximumOutputTokens,
          messages: [
            { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "problem_extraction",
              strict: true,
              schema: buildExtractionJsonSchema(requestedEvidenceLength),
            },
          },
        }),
      });
    } catch (error) {
      if (controller.signal.aborted) throw new OpenRouterError("OpenRouter request timed out", "network", 408);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private responseError(
    status: number,
    error: OpenRouterResponse["error"],
    headers: Headers,
    retries: number,
  ): OpenRouterError {
    const retryHeader = headers.get("retry-after");
    const retryAfterMs = retryHeader !== null && Number.isFinite(Number(retryHeader))
      ? Number(retryHeader) * 1_000
      : undefined;
    const message = error?.message || `OpenRouter request failed with status ${status}`;
    if (status === 401) return new OpenRouterError(message, "authentication", status, undefined, retries);
    if (status === 402) return new OpenRouterError(message, "payment", status, undefined, retries);
    if (status === 403) return new OpenRouterError(message, "authorization", status, undefined, retries);
    if (status === 408) return new OpenRouterError(message, "network", status, retryAfterMs, retries);
    if (status === 429) return new OpenRouterError(message, "rate_limit", status, retryAfterMs, retries);
    if ([502, 503, 504].includes(status)) return new OpenRouterError(message, "server", status, retryAfterMs, retries);
    if (status >= 500) return new OpenRouterError(message, "server", status, retryAfterMs, retries);
    return new OpenRouterError(message, "validation", status, undefined, retries);
  }

  private normalizeError(error: unknown, retries: number): OpenRouterError {
    if (error instanceof OpenRouterError) {
      return new OpenRouterError(error.message, error.category, error.status, error.retryAfterMs, retries);
    }
    return new OpenRouterError("OpenRouter network request failed", "network", undefined, undefined, retries);
  }

  private isTransient(error: OpenRouterError): boolean {
    return ["network", "rate_limit", "server"].includes(error.category);
  }
}
