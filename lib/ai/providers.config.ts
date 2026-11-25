export type AiProviderId = "azure_openai" | "google_ai_studio" | "vertex_ai";

export type AiTaskType = "game" | "text";

export interface AiProviderStatus {
  id: AiProviderId;
  label: string;
  configured: boolean;
  gameModel: string;
  textModel: string;
}

const VALID_PROVIDERS = new Set<AiProviderId>([
  "azure_openai",
  "google_ai_studio",
  "vertex_ai",
]);

export const DEFAULT_AI_PROVIDER_ORDER = {
  primary: "azure_openai" as AiProviderId,
  secondary: "vertex_ai" as AiProviderId,
  backup: "google_ai_studio" as AiProviderId,
} as const;

export const DEFAULT_AI_MODELS: Record<AiProviderId, Record<AiTaskType, string>> = {
  google_ai_studio: {
    game: "gemini-3.6-flash",
    text: "gemini-3.5-flash-lite",
  },
  vertex_ai: {
    game: "gemini-2.5-flash",
    text: "gemini-2.0-flash-lite",
  },
  azure_openai: {
    game: "gpt-4o-mini",
    text: "gpt-4o-mini",
  },
};

function parseProviderId(raw: string | undefined): AiProviderId | null {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return null;
  if (VALID_PROVIDERS.has(normalized as AiProviderId)) {
    return normalized as AiProviderId;
  }
  console.warn(`[AI Config] Ignoring unknown AI provider "${raw}". Valid options: azure_openai, google_ai_studio, vertex_ai.`);
  return null;
}

/**
 * Checks whether the minimum required environment variables are set for a provider.
 */
export function isAiProviderConfigured(provider: AiProviderId): boolean {
  switch (provider) {
    case "google_ai_studio":
      return Boolean(process.env.GOOGLE_AI_STUDIO_API_KEY?.trim());
    case "azure_openai":
      return Boolean(
        process.env.AZURE_OPENAI_ENDPOINT?.trim() &&
          process.env.AZURE_OPENAI_API_KEY?.trim() &&
          (process.env.AZURE_OPENAI_GAME_DEPLOYMENT?.trim() ||
            process.env.AZURE_OPENAI_TEXT_DEPLOYMENT?.trim())
      );
    case "vertex_ai":
      return Boolean(process.env.VERTEX_AI_PROJECT_ID?.trim());
  }
}

/**
 * Resolves the configured 3-tier provider fallback order from environment variables.
 * Priority: AI_PRIMARY_PROVIDER -> AI_SECONDARY_PROVIDER -> AI_BACKUP_PROVIDER (defaults to google_ai_studio).
 * Unconfigured tiers are automatically skipped, and duplicate entries are deduplicated.
 */
export function getAiProviderOrder(): AiProviderId[] {
  const primary =
    process.env.AI_PRIMARY_PROVIDER !== undefined
      ? parseProviderId(process.env.AI_PRIMARY_PROVIDER)
      : DEFAULT_AI_PROVIDER_ORDER.primary;

  const secondary =
    process.env.AI_SECONDARY_PROVIDER !== undefined
      ? parseProviderId(process.env.AI_SECONDARY_PROVIDER)
      : DEFAULT_AI_PROVIDER_ORDER.secondary;

  const backup =
    process.env.AI_BACKUP_PROVIDER !== undefined
      ? parseProviderId(process.env.AI_BACKUP_PROVIDER) ?? DEFAULT_AI_PROVIDER_ORDER.backup
      : DEFAULT_AI_PROVIDER_ORDER.backup;

  const ordered = [primary, secondary, backup].filter(
    (p): p is AiProviderId => p !== null
  );

  // Deduplicate while preserving priority order
  return Array.from(new Set(ordered));
}

/**
 * Returns the ordered list of providers that actually have credentials configured.
 */
export function getConfiguredAiProviders(): AiProviderId[] {
  return getAiProviderOrder().filter(isAiProviderConfigured);
}

/**
 * Resolves the model / deployment name for a given provider and task type.
 */
export function getAiModelForProvider(provider: AiProviderId, task: AiTaskType): string {
  switch (provider) {
    case "google_ai_studio":
      if (task === "game") {
        return (
          process.env.GOOGLE_AI_STUDIO_GAME_MODEL?.trim() ||
          DEFAULT_AI_MODELS.google_ai_studio.game
        );
      }
      return (
        process.env.GOOGLE_AI_STUDIO_TEXT_MODEL?.trim() ||
        DEFAULT_AI_MODELS.google_ai_studio.text
      );

    case "vertex_ai":
      if (task === "game") {
        return (
          process.env.GEMINI_GAME_MODEL?.trim() ||
          DEFAULT_AI_MODELS.vertex_ai.game
        );
      }
      return (
        process.env.GEMINI_TEXT_MODEL?.trim() ||
        DEFAULT_AI_MODELS.vertex_ai.text
      );

    case "azure_openai":
      if (task === "game") {
        return (
          process.env.AZURE_OPENAI_GAME_DEPLOYMENT?.trim() ||
          process.env.AZURE_OPENAI_TEXT_DEPLOYMENT?.trim() ||
          DEFAULT_AI_MODELS.azure_openai.game
        );
      }
      return (
        process.env.AZURE_OPENAI_TEXT_DEPLOYMENT?.trim() ||
        process.env.AZURE_OPENAI_GAME_DEPLOYMENT?.trim() ||
        DEFAULT_AI_MODELS.azure_openai.text
      );
  }
}

export function getAiProvidersStatus(): AiProviderStatus[] {
  const labels: Record<AiProviderId, string> = {
    azure_openai: "Microsoft AI (Azure OpenAI)",
    google_ai_studio: "Google AI Studio",
    vertex_ai: "Google Vertex AI",
  };

  return getAiProviderOrder().map((id) => ({
    id,
    label: labels[id],
    configured: isAiProviderConfigured(id),
    gameModel: getAiModelForProvider(id, "game"),
    textModel: getAiModelForProvider(id, "text"),
  }));
}
