import { auth } from "@/auth";
import {
  AiConfigurationError,
  AiQuotaExceededError,
  executeAiGameStream,
} from "@/lib/services/ai.service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { idea, questionCount, locale } = await req.json();
    const resolvedLocale =
      typeof locale === "string" && locale.toLowerCase() === "en" ? "en" : "ar";

    // SECURITY: Prevent Denial of Wallet / AI Abuse
    const maxQuestions = 20;
    const maxIdeaLength = 1000;

    if (typeof questionCount !== "number" || questionCount < 1 || questionCount > maxQuestions) {
      return new Response(
        `Error: questionCount must be between 1 and ${maxQuestions}`,
        { status: 400 }
      );
    }

    if (typeof idea !== "string" || idea.trim().length === 0 || idea.length > maxIdeaLength) {
      return new Response(
        `Error: idea must be between 1 and ${maxIdeaLength} characters`,
        { status: 400 }
      );
    }

    const { stream } = await executeAiGameStream({
      userId: session.user.id,
      idea,
      questionCount,
      locale: resolvedLocale,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    if (error instanceof AiQuotaExceededError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          used: error.used,
          limit: error.limit,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    if (error instanceof AiConfigurationError) {
      console.error("AI Configuration Error:", error);
      return new Response(error.message, { status: 503 });
    }

    console.error("AI Streaming Error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate game";
    return new Response(message, { status: 500 });
  }
}
