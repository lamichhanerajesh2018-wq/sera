import {
  requireDuplicateJudgeConfiguration,
  requireEmbeddingConfiguration,
  type DeduplicationConfig,
} from "../config.ts";
import { OpenRouterError, type OpenRouterUsage } from "../extraction/client.ts";
import { logResearchEvent } from "../logger.ts";
import type { ProblemMentionDocument, UniqueProblemDocument } from "../types.ts";
import { buildDuplicateJudgePrompt, DUPLICATE_JUDGE_SYSTEM_PROMPT } from "./prompt.ts";
import { DUPLICATE_JUDGE_JSON_SCHEMA, parseDuplicateJudgeOutput, type DuplicateJudgeOutput } from "./schema.ts";
import { validateEmbeddingVector } from "./text.ts";

const EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

interface ClientDependencies {
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

interface UsagePayload {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
  usage: Pick<OpenRouterUsage, "inputTokens" | "totalTokens" | "estimatedCost">;
  retryCount: number;
}

export interface DuplicateJudgeResult {
  output: DuplicateJudgeOutput;
  model: string;
  usage: OpenRouterUsage;
  retryCount: number;
}

abstract class OpenRouterDeduplicationBase {
  protected readonly fetchImplementation: typeof fetch;
  protected readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(protected readonly config: DeduplicationConfig, dependencies: ClientDependencies = {}) {
    this.fetchImplementation = dependencies.fetch || fetch;
    this.sleep = dependencies.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  protected async requestWithRetries(url: string, body: unknown): Promise<{
    payload: Record<string, unknown>;
    retries: number;
  }> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new OpenRouterError("Missing OPENROUTER_API_KEY", "authentication", 401);
    let lastError: OpenRouterError | undefined;
    for (let attempt = 0; attempt <= this.config.retryLimit; attempt += 1) {
      if (attempt > 0) {
        const delay = lastError?.retryAfterMs ?? this.config.retryBaseDelayMs * 2 ** (attempt - 1);
        logResearchEvent("warn", "openrouter_deduplication_retry", {
          category: lastError?.category, status: lastError?.status, attempt, delayMs: delay,
        });
        await this.sleep(delay);
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
      try {
        const response = await this.fetchImplementation(url, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(this.config.siteUrl && { "HTTP-Referer": this.config.siteUrl }),
            ...(this.config.appName && { "X-Title": this.config.appName }),
          },
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (!payload) throw new OpenRouterError("OpenRouter returned malformed JSON", "server", response.status);
        if (!response.ok || payload.error) {
          const apiError = payload.error as { message?: string } | undefined;
          throw this.httpError(response.status, apiError?.message, response.headers, attempt);
        }
        return { payload, retries: attempt };
      } catch (error) {
        const normalized = controller.signal.aborted
          ? new OpenRouterError("OpenRouter request timed out", "network", 408, undefined, attempt)
          : this.normalizeError(error, attempt);
        if (!this.isTransient(normalized) || attempt === this.config.retryLimit) throw normalized;
        lastError = normalized;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError || new OpenRouterError("OpenRouter request failed", "server");
  }

  private httpError(status: number, message: string | undefined, headers: Headers, retries: number) {
    const retryHeader = headers.get("retry-after");
    const retryAfterMs = retryHeader !== null && Number.isFinite(Number(retryHeader))
      ? Number(retryHeader) * 1_000 : undefined;
    const text = message || `OpenRouter request failed with status ${status}`;
    if (status === 401) return new OpenRouterError(text, "authentication", status, undefined, retries);
    if (status === 402) return new OpenRouterError(text, "payment", status, undefined, retries);
    if (status === 403) return new OpenRouterError(text, "authorization", status, undefined, retries);
    if (status === 408) return new OpenRouterError(text, "network", status, retryAfterMs, retries);
    if (status === 429) return new OpenRouterError(text, "rate_limit", status, retryAfterMs, retries);
    if (status >= 500) return new OpenRouterError(text, "server", status, retryAfterMs, retries);
    return new OpenRouterError(text, "validation", status, undefined, retries);
  }

  private normalizeError(error: unknown, retries: number) {
    if (error instanceof OpenRouterError) {
      return new OpenRouterError(error.message, error.category, error.status, error.retryAfterMs, retries);
    }
    return new OpenRouterError("OpenRouter network request failed", "network", undefined, undefined, retries);
  }

  private isTransient(error: OpenRouterError) {
    return ["network", "rate_limit", "server"].includes(error.category);
  }

  protected usage(payload: Record<string, unknown>): UsagePayload {
    return (payload.usage || {}) as UsagePayload;
  }
}

export class OpenRouterEmbeddingClient extends OpenRouterDeduplicationBase {
  async embed(texts: string[]): Promise<EmbeddingResult> {
    if (!texts.length || texts.length > this.config.embeddingBatchSize) {
      throw new Error(`Embedding batch must contain 1-${this.config.embeddingBatchSize} texts`);
    }
    const credentials = requireEmbeddingConfiguration(this.config);
    const { payload, retries } = await this.requestWithRetries(EMBEDDINGS_URL, {
      model: credentials.embeddingModel,
      input: texts,
      encoding_format: "float",
    });
    const data = payload.data;
    if (!Array.isArray(data) || data.length !== texts.length) {
      throw new OpenRouterError("OpenRouter embedding response count did not match input", "validation", 422, undefined, retries);
    }
    const ordered = [...data].sort((left, right) =>
      Number((left as { index?: number }).index || 0) - Number((right as { index?: number }).index || 0));
    const embeddings = ordered.map((item) => validateEmbeddingVector((item as { embedding?: unknown }).embedding));
    const dimensions = embeddings[0].length;
    for (const embedding of embeddings) validateEmbeddingVector(embedding, dimensions);
    const usage = this.usage(payload);
    return {
      embeddings,
      model: typeof payload.model === "string" ? payload.model : credentials.embeddingModel,
      dimensions,
      usage: {
        inputTokens: usage.prompt_tokens || 0,
        totalTokens: usage.total_tokens || usage.prompt_tokens || 0,
        estimatedCost: usage.cost || 0,
      },
      retryCount: retries,
    };
  }
}

export class OpenRouterDuplicateJudgeClient extends OpenRouterDeduplicationBase {
  async judge(
    mention: ProblemMentionDocument,
    candidate: UniqueProblemDocument,
    similarity: number,
  ): Promise<DuplicateJudgeResult> {
    const credentials = requireDuplicateJudgeConfiguration(this.config);
    const { payload, retries } = await this.requestWithRetries(COMPLETIONS_URL, {
      model: credentials.duplicateJudgeModel,
      stream: false,
      temperature: 0,
      messages: [
        { role: "system", content: DUPLICATE_JUDGE_SYSTEM_PROMPT },
        { role: "user", content: buildDuplicateJudgePrompt(mention, candidate, similarity) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "duplicate_problem_judgment", strict: true, schema: DUPLICATE_JUDGE_JSON_SCHEMA },
      },
    });
    const choices = payload.choices;
    const content = Array.isArray(choices)
      ? (choices[0] as { message?: { content?: string } } | undefined)?.message?.content
      : undefined;
    if (!content) throw new OpenRouterError("Duplicate judge returned no structured content", "server", 502, undefined, retries);
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch {
      throw new OpenRouterError("Duplicate judge content was not valid JSON", "validation", 422, undefined, retries);
    }
    let output: DuplicateJudgeOutput;
    try { output = parseDuplicateJudgeOutput(parsed); } catch (error) {
      throw new OpenRouterError(
        error instanceof Error ? error.message : "Duplicate judge schema validation failed",
        "validation", 422, undefined, retries,
      );
    }
    const usage = this.usage(payload);
    return {
      output,
      model: typeof payload.model === "string" ? payload.model : credentials.duplicateJudgeModel,
      usage: {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        estimatedCost: usage.cost || 0,
      },
      retryCount: retries,
    };
  }
}
