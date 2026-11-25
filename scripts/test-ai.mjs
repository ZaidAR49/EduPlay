import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const ts = require("typescript");

const ROOT_DIR = process.cwd();
const CACHE_DIR = path.join(ROOT_DIR, "node_modules", ".cache", "ai-test");

function compileAiModules() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const files = [
    path.join(ROOT_DIR, "lib", "ai", "providers.config.ts"),
    path.join(ROOT_DIR, "lib", "ai", "genai-client.ts"),
  ];

  const program = ts.createProgram(files, {
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
    skipLibCheck: true,
    outDir: CACHE_DIR,
  });

  const emitResult = program.emit();
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  if (diagnostics.length > 0) {
    const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => ROOT_DIR,
      getCanonicalFileName: (f) => f,
      getNewLine: () => "\n",
    });
    throw new Error(`TypeScript compilation failed:\n${formatted}`);
  }
}

async function testSingleProvider(providerId, modules) {
  const {
    isAiProviderConfigured,
    getAiModelForProvider,
  } = modules.config;
  const { generateWithProvider, streamWithProvider } = modules.client;

  const configured = isAiProviderConfigured(providerId);
  const textModel = getAiModelForProvider(providerId, "text");
  const gameModel = getAiModelForProvider(providerId, "game");

  if (!configured) {
    return {
      provider: providerId,
      status: "SKIPPED",
      detail: "Missing required environment variables",
      models: `${textModel} / ${gameModel}`,
    };
  }

  const startedAt = Date.now();

  try {
    // 1. Test non-streaming JSON generation (used by ai.actions.ts)
    const textResult = await generateWithProvider(providerId, {
      task: "text",
      prompt: 'Reply ONLY with valid JSON: {"status":"ok"}',
      responseMimeType: "application/json",
      maxOutputTokens: 1024,
      temperature: 0,
      timeoutMs: 25_000,
    });

    const cleaned = textResult.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    JSON.parse(cleaned);

    // 2. Test streaming generation (used by /api/generate)
    const streamSession = await streamWithProvider(providerId, {
      task: "game",
      prompt: 'Reply ONLY with valid JSON: {"stream":"ok"}',
      systemInstruction: "Output valid JSON only.",
      responseMimeType: "application/json",
      maxOutputTokens: 1024,
      temperature: 0,
      timeoutMs: 25_000,
    });

    let streamedText = "";
    for await (const chunk of streamSession.stream) {
      if (chunk.text) streamedText += chunk.text;
    }
    if (!streamedText.trim()) {
      throw new Error("Streaming endpoint returned empty output.");
    }

    const elapsedMs = Date.now() - startedAt;
    return {
      provider: providerId,
      status: "PASS",
      detail: `OK in ${elapsedMs}ms (tokens: ${textResult.totalTokens ?? "est"})`,
      models: `${textModel} / ${gameModel}`,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    return {
      provider: providerId,
      status: "FAIL",
      detail: `Failed in ${elapsedMs}ms -> ${message}`,
      models: `${textModel} / ${gameModel}`,
    };
  }
}

async function main() {
  loadEnvConfig(ROOT_DIR);
  compileAiModules();

  const modules = {
    config: require(path.join(CACHE_DIR, "providers.config.js")),
    client: require(path.join(CACHE_DIR, "genai-client.js")),
  };

  const order = modules.config.getAiProviderOrder();
  const activeChain = modules.config.getConfiguredAiProviders();

  console.log("\n=== AI Providers Health Check ===");
  console.log("Configured priority order :", order.join(" -> ") || "(none)");
  console.log("Active fallback chain     :", activeChain.join(" -> ") || "(none)");
  console.log("");

  const allProviders = ["azure_openai", "google_ai_studio", "vertex_ai"];
  const results = [];

  for (const providerId of allProviders) {
    process.stdout.write(`Testing ${providerId}... `);
    const res = await testSingleProvider(providerId, modules);
    results.push(res);
    console.log(`[${res.status}] (${res.models})`);
    console.log(`  ${res.detail}\n`);
  }

  const passedInChain = activeChain.filter((id) =>
    results.some((r) => r.provider === id && r.status === "PASS")
  );

  console.log("=== Summary ===");
  console.log(
    `Working providers in active fallback chain: ${
      passedInChain.length > 0 ? passedInChain.join(", ") : "NONE"
    }`
  );

  if (passedInChain.length === 0) {
    console.error("\nNo working AI providers are available in your active chain.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test script error:", err);
  process.exit(1);
});
