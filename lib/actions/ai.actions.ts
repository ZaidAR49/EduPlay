"use server";

import { auth } from "@/auth";
import { executeAiJson, executeAiText } from "@/lib/services/ai.service";

export async function improveTextAction(text: string, context: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const prompt = `You are an expert copywriter and educator for educational applications.
Your task is to enhance and polish the provided text for: "${context}".

Current text:
"${text}"

CRITICAL RULES:
1. PRESERVE THE INPUT LANGUAGE: Do NOT enforce or translate into any specific language. You MUST improve and return the text in the EXACT SAME language that the user entered (whether it is Arabic, English, French, Chinese, Spanish, or any other language). Never translate the text into a different language.
2. ENHANCE QUALITY: Make it professional, engaging, clear, and inspiring for students and educators while maintaining the original meaning and tone.
3. OUTPUT FORMAT: Output ONLY the improved text. Do NOT include explanations, preambles, notes, or surrounding quotes.`;

  const result = await executeAiText({
    userId: session.user.id,
    action: "improveTextAction",
    task: "text",
    prompt,
    usageMetadata: { context },
    posthogEvent: "ai_organization_improved",
    posthogProperties: { context },
  });

  return result.text || text;
}

export async function improveOrganizationFormAction(
  formData: Record<string, string>
): Promise<Record<string, string>> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const prompt = `You are an expert copywriter and educator for educational applications.
Your task is to enhance all text fields in the following organization settings form.

Current form data:
${JSON.stringify(formData, null, 2)}

CRITICAL RULES:
1. PRESERVE THE INPUT LANGUAGE: Do NOT enforce or translate into any specific language. For each text field, you MUST improve and return the text in the EXACT SAME language that was provided (whether Arabic, English, French, Chinese, Spanish, or any other language). Never translate values to a different language.
2. PRESERVE STRUCTURE: Keep the exact same JSON keys and structure. Do not rename, add, or remove keys.
3. ENHANCE QUALITY: Make all texts professional, cohesive, engaging, and suitable for students and educators.
4. OUTPUT FORMAT: Output ONLY valid raw JSON matching the original keys. No markdown code fences (no \`\`\`), no preamble, no commentary.`;

  const result = await executeAiJson<Record<string, string>>({
    userId: session.user.id,
    action: "improveOrganizationFormAction",
    task: "text",
    prompt,
    posthogEvent: "ai_organization_improved",
  });

  return result.data;
}
