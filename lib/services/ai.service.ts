import {
  AiProviderError,
  AiStreamChunk,
  AiStreamSession,
  generateWithProvider,
  streamWithProvider,
} from "@/lib/ai/genai-client";
import { gameGeneratorConfig } from "@/lib/ai/game-generator.config";
import {
  formatAiStreamMetadataTrailer,
  safeParseAiGameJson,
} from "@/lib/ai/json-repair";
import {
  AiProviderId,
  AiTaskType,
  getConfiguredAiProviders,
} from "@/lib/ai/providers.config";
import { getAiUsageAndLimit, recordAiUsage } from "@/lib/services/usage.service";
import { logActivity, touchUserLastActive } from "@/lib/services/activity.service";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class AiQuotaExceededError extends Error {
  readonly used: number;
  readonly limit: number;
  readonly requests: number;

  constructor(used: number, limit: number, requests: number) {
    super("AI usage limit reached for this period.");
    this.name = "AiQuotaExceededError";
    this.used = used;
    this.limit = limit;
    this.requests = requests;
  }
}

export class AiConfigurationError extends Error {
  constructor(
    message = "No AI providers are configured. Check your AI provider environment variables."
  ) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

export interface AiAttemptFailure {
  provider: AiProviderId;
  error: string;
}

export interface ExecuteAiRequest {
  userId: string;
  action: string;
  task: AiTaskType;
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: "application/json" | "text/plain";
  maxOutputTokens?: number;
  temperature?: number;
  usageMetadata?: Record<string, unknown>;
  posthogEvent?: string;
  posthogProperties?: Record<string, unknown>;
}

export interface ExecuteAiTextResult {
  text: string;
  tokensUsed: number;
  provider: AiProviderId;
  model: string;
  fallbackUsed: boolean;
}

export interface ExecuteAiJsonResult<T> {
  data: T;
  tokensUsed: number;
  provider: AiProviderId;
  model: string;
  fallbackUsed: boolean;
}

export interface ExecuteAiGameStreamRequest {
  userId: string;
  idea: string;
  questionCount: number;
  locale: "ar" | "en";
  usageMetadata?: Record<string, unknown>;
}

export interface ExecuteAiGameStreamResult {
  stream: ReadableStream<Uint8Array>;
  provider: AiProviderId;
  model: string;
  fallbackUsed: boolean;
}

function estimateTokens(inputChars: number, outputChars: number): number {
  return Math.max(1, Math.ceil((inputChars + outputChars) / 4));
}

function stripJsonMarkdownFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function getRequiredProviders(): AiProviderId[] {
  const providers = getConfiguredAiProviders();
  if (providers.length === 0) {
    throw new AiConfigurationError();
  }
  return providers;
}

/**
 * Centralized quota check enforced before every AI invocation.
 */
export async function assertAiQuota(userId: string) {
  const aiUsage = await getAiUsageAndLimit(userId);
  if (aiUsage.isOverLimit) {
    throw new AiQuotaExceededError(aiUsage.used, aiUsage.limit, aiUsage.requests);
  }
  return aiUsage;
}

async function trackPostHogAiEvent(
  userId: string,
  event: string,
  properties: Record<string, unknown>
): Promise<void> {
  try {
    const { getPostHogClient } = await import("@/lib/posthog-server");
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event,
      properties,
    });
    await posthog.shutdown();
  } catch (err) {
    console.error("[AI Service] Failed to track PostHog event:", err);
  }
}

async function recordUsageSafely(
  userId: string,
  tokensUsed: number,
  metadata: Record<string, unknown>
): Promise<void> {
  await recordAiUsage(userId, tokensUsed, metadata).catch((err) => {
    console.error("[AI Service] Failed to record AI usage:", err);
  });
}

async function runWithFallback<T>(
  providers: AiProviderId[],
  actionLabel: string,
  executor: (provider: AiProviderId) => Promise<T>
): Promise<{
  value: T;
  provider: AiProviderId;
  fallbackUsed: boolean;
  failures: AiAttemptFailure[];
}> {
  const failures: AiAttemptFailure[] = [];

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const isLastProvider = i === providers.length - 1;
    const maxAttempts = isLastProvider ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const value = await executor(provider);
        return {
          value,
          provider,
          fallbackUsed: i > 0,
          failures,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retryable =
          error instanceof AiProviderError ? error.retryableSameProvider : false;

        console.warn(
          `[AI Service] ${actionLabel} failed on "${provider}" (attempt ${attempt}/${maxAttempts}): ${message}`
        );

        if (attempt < maxAttempts && retryable) {
          await sleep(1200 + Math.random() * 400);
          continue;
        }

        failures.push({ provider, error: message });
        break;
      }
    }
  }

  const summary = failures.map((f) => `${f.provider}: ${f.error}`).join(" | ");
  throw new Error(`All configured AI providers failed (${summary})`);
}

async function finalizeAiUsageAndTelemetry(
  request: ExecuteAiRequest,
  meta: {
    provider: AiProviderId;
    model: string;
    totalTokens?: number;
    outputLength: number;
    fallbackUsed: boolean;
    failures: AiAttemptFailure[];
  }
): Promise<number> {
  const inputChars =
    request.prompt.length + (request.systemInstruction?.length ?? 0);
  const tokensUsed =
    meta.totalTokens && meta.totalTokens > 0
      ? meta.totalTokens
      : estimateTokens(inputChars, meta.outputLength);

  await recordUsageSafely(request.userId, tokensUsed, {
    action: request.action,
    provider: meta.provider,
    model: meta.model,
    fallbackUsed: meta.fallbackUsed,
    failedProviders: meta.failures.map((f) => f.provider),
    ...request.usageMetadata,
  });

  await Promise.all([
    touchUserLastActive(request.userId, undefined, true),
    logActivity({
      actorId: request.userId,
      targetUserId: request.userId,
      action: request.posthogEvent || "ai_text_generated",
      entityType: "ai",
      metadata: {
        action: request.action,
        tokensUsed,
        provider: meta.provider,
        model: meta.model,
      },
    }),
  ]);

  if (request.posthogEvent) {
    await trackPostHogAiEvent(request.userId, request.posthogEvent, {
      tokensUsed,
      provider: meta.provider,
      model: meta.model,
      fallbackUsed: meta.fallbackUsed,
      ...request.posthogProperties,
    });
  }

  return tokensUsed;
}

/**
 * Centralized text generation with quota enforcement, 3-tier failover,
 * token consumption recording, and optional telemetry.
 */
export async function executeAiText(
  request: ExecuteAiRequest
): Promise<ExecuteAiTextResult> {
  await assertAiQuota(request.userId);
  const providers = getRequiredProviders();

  const { value: result, fallbackUsed, failures } = await runWithFallback(
    providers,
    request.action,
    (provider) =>
      generateWithProvider(provider, {
        task: request.task,
        prompt: request.prompt,
        systemInstruction: request.systemInstruction,
        responseMimeType: request.responseMimeType,
        maxOutputTokens: request.maxOutputTokens,
        temperature: request.temperature,
      })
  );

  const tokensUsed = await finalizeAiUsageAndTelemetry(request, {
    provider: result.provider,
    model: result.model,
    totalTokens: result.totalTokens,
    outputLength: result.text.length,
    fallbackUsed,
    failures,
  });

  return {
    text: result.text,
    tokensUsed,
    provider: result.provider,
    model: result.model,
    fallbackUsed,
  };
}

/**
 * Centralized structured JSON generation. Parses JSON inside the provider loop
 * so malformed JSON triggers automatic failover to the next configured provider.
 */
export async function executeAiJson<T = Record<string, unknown>>(
  request: ExecuteAiRequest
): Promise<ExecuteAiJsonResult<T>> {
  await assertAiQuota(request.userId);
  const providers = getRequiredProviders();

  const { value, fallbackUsed, failures } = await runWithFallback(
    providers,
    request.action,
    async (provider) => {
      const result = await generateWithProvider(provider, {
        task: request.task,
        prompt: request.prompt,
        systemInstruction: request.systemInstruction,
        responseMimeType: "application/json",
        maxOutputTokens: request.maxOutputTokens,
        temperature: request.temperature,
      });

      const cleaned = stripJsonMarkdownFences(result.text);
      try {
        const data = JSON.parse(cleaned) as T;
        return { result, data };
      } catch (parseErr) {
        throw new AiProviderError(
          provider,
          `Invalid JSON returned: ${(parseErr as Error).message}`,
          { retryableSameProvider: true, cause: parseErr }
        );
      }
    }
  );

  const { result, data } = value;
  const tokensUsed = await finalizeAiUsageAndTelemetry(request, {
    provider: result.provider,
    model: result.model,
    totalTokens: result.totalTokens,
    outputLength: result.text.length,
    fallbackUsed,
    failures,
  });

  return {
    data,
    tokensUsed,
    provider: result.provider,
    model: result.model,
    fallbackUsed,
  };
}

async function openVerifiedStream(
  provider: AiProviderId,
  params: Parameters<typeof streamWithProvider>[1]
): Promise<{
  session: AiStreamSession;
  iterator: AsyncIterator<AiStreamChunk>;
  firstText: string;
  initialTokens?: number;
}> {
  const session = await streamWithProvider(provider, params);
  const iterator = session.stream[Symbol.asyncIterator]();
  let initialTokens: number | undefined;

  try {
    // Wait for the first non-empty text chunk before committing this provider to the HTTP stream
    while (true) {
      const next = await iterator.next();
      if (next.done) {
        throw new AiProviderError(provider, "Stream ended without producing text.", {
          retryableSameProvider: true,
        });
      }
      if (next.value.totalTokens !== undefined) {
        initialTokens = next.value.totalTokens;
      }
      if (next.value.text) {
        return {
          session,
          iterator,
          firstText: next.value.text,
          initialTokens,
        };
      }
    }
  } catch (error) {
    await iterator.return?.().catch(() => { });
    throw error;
  }
}

function isValidGeneratedGameOutput(rawOutput: string): boolean {
  try {
    const parsed = safeParseAiGameJson(rawOutput);
    return (
      Boolean(parsed) &&
      Array.isArray(parsed.scenarios) &&
      parsed.scenarios.length > 0 &&
      parsed.scenarios.some(
        (s: unknown) =>
          Boolean(s) &&
          typeof s === "object" &&
          Array.isArray((s as { choices?: unknown }).choices) &&
          ((s as { choices?: unknown[] }).choices?.length ?? 0) > 0
      )
    );
  } catch {
    return false;
  }
}

/**
 * Centralized game generation streaming with quota enforcement, safe pre-flush
 * 3-tier failover, and automatic token usage recording.
 * Only consumes user token quota when the stream completes with valid game JSON.
 */
export async function executeAiGameStream(
  request: ExecuteAiGameStreamRequest
): Promise<ExecuteAiGameStreamResult> {
  await assertAiQuota(request.userId);
  const providers = getRequiredProviders();

  const prompt = "Please generate the quiz game now according to the system instructions.";
  const systemInstruction = gameGeneratorConfig.getSystemPrompt(
    request.idea,
    request.questionCount,
    request.locale
  );

  const { value: verified, fallbackUsed, failures } = await runWithFallback(
    providers,
    "generateGameStream",
    (provider) =>
      openVerifiedStream(provider, {
        task: "game",
        prompt,
        systemInstruction,
        responseMimeType: gameGeneratorConfig.config.responseMimeType,
        maxOutputTokens: gameGeneratorConfig.config.maxOutputTokens,
        temperature: gameGeneratorConfig.config.temperature,
      })
  );

  const encoder = new TextEncoder();
  const inputChars = prompt.length + systemInstruction.length;
  let fullOutput = verified.firstText;
  let reportedTokens = verified.initialTokens;

  const computeTokens = () =>
    reportedTokens && reportedTokens > 0
      ? reportedTokens
      : estimateTokens(inputChars, fullOutput.length);

  const buildUsageMetadata = () => ({
    action: "generateGameStream",
    provider: verified.session.provider,
    model: verified.session.model,
    fallbackUsed,
    failedProviders: failures.map((f) => f.provider),
    questionCount: request.questionCount,
    ideaLength: request.idea.length,
    locale: request.locale,
    ...request.usageMetadata,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(verified.firstText));

        while (true) {
          const next = await verified.iterator.next();
          if (next.done) break;

          if (next.value.totalTokens !== undefined) {
            reportedTokens = next.value.totalTokens;
          }
          if (next.value.text) {
            fullOutput += next.value.text;
            controller.enqueue(encoder.encode(next.value.text));
          }
        }

        if (!isValidGeneratedGameOutput(fullOutput)) {
          console.warn(
            `[AI Service] Skipping token charge: "${verified.session.provider}" stream did not produce valid game JSON.`
          );
          controller.close();
          return;
        }

        const tokensUsed = computeTokens();
        controller.enqueue(encoder.encode(formatAiStreamMetadataTrailer({ tokensUsed })));
        controller.close();

        await Promise.all([
          recordUsageSafely(request.userId, tokensUsed, buildUsageMetadata()),
          touchUserLastActive(request.userId, undefined, true),
          logActivity({
            actorId: request.userId,
            targetUserId: request.userId,
            action: "ai_game_generated",
            entityType: "ai",
            metadata: {
              tokensUsed,
              questionCount: request.questionCount,
              provider: verified.session.provider,
              model: verified.session.model,
            },
          }),
          trackPostHogAiEvent(request.userId, "ai_game_generated", {
            tokensUsed,
            questionCount: request.questionCount,
            provider: verified.session.provider,
            model: verified.session.model,
            fallbackUsed,
          }),
        ]);
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      // Cancelled streams never consume user token quota
      await verified.iterator.return?.().catch(() => { });
    },
  });

  return {
    stream,
    provider: verified.session.provider,
    model: verified.session.model,
    fallbackUsed,
  };
}
