import { GoogleGenAI } from "@google/genai";
import { AiProviderId, AiTaskType, getAiModelForProvider } from "./providers.config";

export interface AiGenerationParams {
  task: AiTaskType;
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: "application/json" | "text/plain";
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface AiGenerationResult {
  text: string;
  totalTokens?: number;
  provider: AiProviderId;
  model: string;
}

export interface AiStreamChunk {
  text?: string;
  totalTokens?: number;
}

export interface AiStreamSession {
  provider: AiProviderId;
  model: string;
  stream: AsyncIterable<AiStreamChunk>;
}

export class AiProviderError extends Error {
  readonly provider: AiProviderId;
  readonly status?: number;
  readonly retryableSameProvider: boolean;

  constructor(
    provider: AiProviderId,
    message: string,
    options?: { status?: number; retryableSameProvider?: boolean; cause?: unknown }
  ) {
    super(`[${provider}] ${message}`, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AiProviderError";
    this.provider = provider;
    this.status = options?.status;
    this.retryableSameProvider = options?.retryableSameProvider ?? false;
  }
}

export function getVertexAiClient(): GoogleGenAI {
  const projectId = process.env.VERTEX_AI_PROJECT_ID?.trim();
  const location = process.env.VERTEX_AI_LOCATION?.trim() || "global";
  const clientEmail = process.env.VERTEX_AI_CLIENT_EMAIL?.trim();
  // Handle literal '\n' strings that might be passed from .env
  const privateKey = process.env.VERTEX_AI_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId) {
    throw new AiProviderError("vertex_ai", "VERTEX_AI_PROJECT_ID is not set.");
  }

  return new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location,
    ...(clientEmail && privateKey
      ? {
          googleAuthOptions: {
            credentials: {
              client_email: clientEmail,
              private_key: privateKey,
            },
          },
        }
      : {}),
  });
}

export function getGoogleAiStudioClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY?.trim();
  if (!apiKey) {
    throw new AiProviderError("google_ai_studio", "GOOGLE_AI_STUDIO_API_KEY is not set.");
  }

  return new GoogleGenAI({ apiKey });
}

/**
 * Legacy helper preserved for backwards compatibility.
 * Prefer `executeAiGeneration` / `executeAiGameStream` from `@/lib/services/ai.service`.
 */
export function getGenAIClient(): GoogleGenAI {
  return getVertexAiClient();
}

function getGeminiClientForProvider(provider: "google_ai_studio" | "vertex_ai"): GoogleGenAI {
  return provider === "google_ai_studio" ? getGoogleAiStudioClient() : getVertexAiClient();
}

function extractHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const err = error as Record<string, unknown>;
  if (typeof err.status === "number") return err.status;
  if (typeof err.statusCode === "number") return err.statusCode;
  if (typeof err.code === "number") return err.code;
  return undefined;
}

function isTransientHttpStatus(status?: number): boolean {
  if (!status) return false;
  return status === 408 || status === 429 || status >= 500;
}

function wrapGeminiError(provider: "google_ai_studio" | "vertex_ai", error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  const status = extractHttpStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  const retryable =
    isTransientHttpStatus(status) ||
    /timeout|timed out|ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|rate limit|429|503/i.test(message);

  return new AiProviderError(provider, message, {
    status,
    retryableSameProvider: retryable,
    cause: error,
  });
}

function buildGeminiConfig(params: AiGenerationParams): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (params.systemInstruction) config.systemInstruction = params.systemInstruction;
  if (params.responseMimeType) config.responseMimeType = params.responseMimeType;
  if (params.maxOutputTokens !== undefined) config.maxOutputTokens = params.maxOutputTokens;
  if (params.temperature !== undefined) config.temperature = params.temperature;
  return config;
}

async function callGeminiText(
  provider: "google_ai_studio" | "vertex_ai",
  params: AiGenerationParams
): Promise<AiGenerationResult> {
  const model = getAiModelForProvider(provider, params.task);
  const ai = getGeminiClientForProvider(provider);
  const config = buildGeminiConfig(params);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: params.prompt,
      ...(Object.keys(config).length > 0 ? { config } : {}),
    });

    const text = response.text?.trim();
    if (!text) {
      throw new AiProviderError(provider, "Model returned an empty response.", {
        retryableSameProvider: true,
      });
    }

    return {
      text,
      totalTokens: response.usageMetadata?.totalTokenCount,
      provider,
      model,
    };
  } catch (error) {
    throw wrapGeminiError(provider, error);
  }
}

async function callGeminiStream(
  provider: "google_ai_studio" | "vertex_ai",
  params: AiGenerationParams
): Promise<AiStreamSession> {
  const model = getAiModelForProvider(provider, params.task);
  const ai = getGeminiClientForProvider(provider);
  const config = buildGeminiConfig(params);

  try {
    const responseStream = await ai.models.generateContentStream({
      model,
      contents: params.prompt,
      ...(Object.keys(config).length > 0 ? { config } : {}),
    });

    async function* iterate(): AsyncIterable<AiStreamChunk> {
      try {
        for await (const chunk of responseStream) {
          yield {
            text: chunk.text || undefined,
            totalTokens: chunk.usageMetadata?.totalTokenCount,
          };
        }
      } catch (error) {
        throw wrapGeminiError(provider, error);
      }
    }

    return {
      provider,
      model,
      stream: iterate(),
    };
  } catch (error) {
    throw wrapGeminiError(provider, error);
  }
}

type AzureApiMode = "chat_completions" | "responses";

interface AzureRequestTarget {
  mode: AzureApiMode;
  url: string;
}

function stripApiVersionParam(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.searchParams.delete("api-version");
  return url.toString();
}

function buildAzureRequestTarget(
  rawEndpoint: string,
  deployment: string,
  apiVersion: string
): AzureRequestTarget {
  const trimmed = rawEndpoint.trim().replace(/\/+$/, "");

  // Azure AI Foundry / OpenAI v1 Responses API (never accepts ?api-version)
  if (/\/responses(\?.*)?$/i.test(trimmed)) {
    const isV1Path = /\/v1\/responses(\?.*)?$/i.test(trimmed);
    return {
      mode: "responses",
      url: isV1Path ? stripApiVersionParam(trimmed) : trimmed,
    };
  }

  // Direct Chat Completions URL pasted in full
  if (/\/chat\/completions(\?.*)?$/i.test(trimmed)) {
    const isV1Path = /\/v1\/chat\/completions(\?.*)?$/i.test(trimmed);
    if (isV1Path) {
      return { mode: "chat_completions", url: stripApiVersionParam(trimmed) };
    }
    if (trimmed.includes("api-version=")) {
      return { mode: "chat_completions", url: trimmed };
    }
    const separator = trimmed.includes("?") ? "&" : "?";
    return {
      mode: "chat_completions",
      url: `${trimmed}${separator}api-version=${encodeURIComponent(apiVersion)}`,
    };
  }

  // OpenAI-compatible /v1 base path (e.g. https://.../openai/v1 or /api/projects/.../openai/v1)
  if (/\/v1$/i.test(trimmed)) {
    return { mode: "chat_completions", url: `${trimmed}/chat/completions` };
  }

  // Azure AI Model Inference /models base path
  if (/\/models$/i.test(trimmed)) {
    return {
      mode: "chat_completions",
      url: `${trimmed}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
    };
  }

  // Classic Azure OpenAI resource root (https://<resource>.openai.azure.com)
  return {
    mode: "chat_completions",
    url: `${trimmed}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
  };
}

function resolveAzurePrompts(params: AiGenerationParams): {
  systemContent: string;
  userPrompt: string;
  isJsonMode: boolean;
} {
  const isJsonMode = params.responseMimeType === "application/json";
  let systemContent = params.systemInstruction?.trim() || "";

  // OpenAI json_object mode requires the word "json" to appear in the messages/input
  if (isJsonMode && !/json/i.test(`${systemContent}\n${params.prompt}`)) {
    systemContent = systemContent
      ? `${systemContent}\nRespond strictly in valid JSON.`
      : "Respond strictly in valid JSON.";
  }

  return { systemContent, userPrompt: params.prompt, isJsonMode };
}

function buildAzureRequestBody(
  mode: AzureApiMode,
  deployment: string,
  params: AiGenerationParams,
  stream: boolean,
  includeStreamUsage = true
): Record<string, unknown> {
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim() || "2024-10-21";
  const isReasoningModel = /^(o1|o3|o4|gpt-5)/i.test(deployment);
  const { systemContent, userPrompt, isJsonMode } = resolveAzurePrompts(params);

  if (mode === "responses") {
    const body: Record<string, unknown> = {
      model: deployment,
      input: userPrompt,
      stream,
    };

    if (systemContent) {
      body.instructions = systemContent;
    }
    if (isJsonMode) {
      body.text = { format: { type: "json_object" } };
    }
    if (params.temperature !== undefined && !isReasoningModel) {
      body.temperature = params.temperature;
    }
    if (params.maxOutputTokens !== undefined) {
      body.max_output_tokens = params.maxOutputTokens;
    }
    return body;
  }

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemContent) {
    messages.push({ role: "system", content: systemContent });
  }
  messages.push({ role: "user", content: userPrompt });

  const body: Record<string, unknown> = {
    model: deployment,
    messages,
    stream,
  };

  if (stream && includeStreamUsage) {
    body.stream_options = { include_usage: true };
  }

  if (isJsonMode) {
    body.response_format = { type: "json_object" };
  }

  if (params.temperature !== undefined && !isReasoningModel) {
    body.temperature = params.temperature;
  }

  if (params.maxOutputTokens !== undefined) {
    const useLegacyMaxTokens =
      !isReasoningModel && /^(2023-|2024-0[1-8]-)/.test(apiVersion);
    if (useLegacyMaxTokens) {
      body.max_tokens = params.maxOutputTokens;
    } else {
      body.max_completion_tokens = params.maxOutputTokens;
    }
  }

  return body;
}

async function fetchAzureEndpoint(
  deployment: string,
  params: AiGenerationParams,
  stream: boolean,
  includeStreamUsage = true
): Promise<{ response: Response; mode: AzureApiMode }> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim() || "2024-10-21";

  if (!endpoint || !apiKey) {
    throw new AiProviderError(
      "azure_openai",
      "AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY is not set."
    );
  }

  const target = buildAzureRequestTarget(endpoint, deployment, apiVersion);
  const timeoutMs = params.timeoutMs ?? (stream ? 90_000 : 45_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(
        buildAzureRequestBody(target.mode, deployment, params, stream, includeStreamUsage)
      ),
      signal: controller.signal,
    });
    return { response, mode: target.mode };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    throw new AiProviderError(
      "azure_openai",
      isAbort
        ? `Request timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error),
      { retryableSameProvider: true, cause: error }
    );
  } finally {
    clearTimeout(timer);
  }
}

async function readAzureError(response: Response): Promise<never> {
  const errorText = await response.text().catch(() => "");
  const snippet = errorText.slice(0, 500) || response.statusText || `HTTP ${response.status}`;
  throw new AiProviderError("azure_openai", `HTTP ${response.status}: ${snippet}`, {
    status: response.status,
    retryableSameProvider: isTransientHttpStatus(response.status),
  });
}

function extractResponsesApiText(data: {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}): string | undefined {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const chunks: string[] = [];
  for (const item of data.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) {
        chunks.push(part.text);
      }
    }
  }
  const combined = chunks.join("").trim();
  return combined || undefined;
}

async function callAzureText(params: AiGenerationParams): Promise<AiGenerationResult> {
  const deployment = getAiModelForProvider("azure_openai", params.task);
  const { response, mode } = await fetchAzureEndpoint(deployment, params, false, false);

  if (!response.ok) {
    await readAzureError(response);
  }

  if (mode === "responses") {
    const data = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        type?: string;
        content?: Array<{ type?: string; text?: string }>;
      }>;
      usage?: { total_tokens?: number };
    };
    const text = extractResponsesApiText(data);
    if (!text) {
      throw new AiProviderError("azure_openai", "Model returned an empty response.", {
        retryableSameProvider: true,
      });
    }
    return {
      text,
      totalTokens: data.usage?.total_tokens,
      provider: "azure_openai",
      model: deployment,
    };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { total_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new AiProviderError("azure_openai", "Model returned an empty response.", {
      retryableSameProvider: true,
    });
  }

  return {
    text,
    totalTokens: data.usage?.total_tokens,
    provider: "azure_openai",
    model: deployment,
  };
}

function parseAzureSseLine(rawLine: string, mode: AzureApiMode): AiStreamChunk | null {
  const line = rawLine.trim();
  if (!line || !line.startsWith("data:")) return null;

  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    // Ignore malformed keep-alive or partial metadata frames
    return null;
  }

  if (mode === "responses") {
    const eventType = parsed.type;
    if (eventType === "response.output_text.delta" && typeof parsed.delta === "string") {
      return { text: parsed.delta || undefined };
    }
    if (eventType === "response.completed") {
      const resp = parsed.response as { usage?: { total_tokens?: number } } | undefined;
      if (resp?.usage?.total_tokens !== undefined) {
        return { totalTokens: resp.usage.total_tokens };
      }
    }
    if (eventType === "error" || eventType === "response.failed") {
      const errObj = parsed.error as { message?: string } | undefined;
      throw new AiProviderError(
        "azure_openai",
        errObj?.message || "Responses API stream failed.",
        { retryableSameProvider: true }
      );
    }
    return null;
  }

  const choices = parsed.choices as
    | Array<{ delta?: { content?: string | null } }>
    | undefined;
  const usage = parsed.usage as { total_tokens?: number } | undefined;
  const text = choices?.[0]?.delta?.content || undefined;
  const totalTokens = usage?.total_tokens;
  if (!text && totalTokens === undefined) return null;
  return { text, totalTokens };
}

async function callAzureStream(params: AiGenerationParams): Promise<AiStreamSession> {
  const deployment = getAiModelForProvider("azure_openai", params.task);
  let { response, mode } = await fetchAzureEndpoint(deployment, params, true, true);

  // Some Azure model inference / older API versions reject stream_options
  if (mode === "chat_completions" && !response.ok && response.status === 400) {
    const errBody = await response.clone().text().catch(() => "");
    if (/stream_options/i.test(errBody)) {
      ({ response, mode } = await fetchAzureEndpoint(deployment, params, true, false));
    }
  }

  if (!response.ok) {
    await readAzureError(response);
  }

  if (!response.body) {
    throw new AiProviderError("azure_openai", "Azure response body is empty.", {
      retryableSameProvider: true,
    });
  }

  const body = response.body;

  async function* iterate(): AsyncIterable<AiStreamChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const parsedChunk = parseAzureSseLine(rawLine, mode);
          if (parsedChunk) yield parsedChunk;
        }
      }

      const trailingChunk = parseAzureSseLine(buffer, mode);
      if (trailingChunk) yield trailingChunk;
    } finally {
      reader.releaseLock();
    }
  }

  return {
    provider: "azure_openai",
    model: deployment,
    stream: iterate(),
  };
}

export async function generateWithProvider(
  provider: AiProviderId,
  params: AiGenerationParams
): Promise<AiGenerationResult> {
  switch (provider) {
    case "google_ai_studio":
    case "vertex_ai":
      return callGeminiText(provider, params);
    case "azure_openai":
      return callAzureText(params);
  }
}

export async function streamWithProvider(
  provider: AiProviderId,
  params: AiGenerationParams
): Promise<AiStreamSession> {
  switch (provider) {
    case "google_ai_studio":
    case "vertex_ai":
      return callGeminiStream(provider, params);
    case "azure_openai":
      return callAzureStream(params);
  }
}
