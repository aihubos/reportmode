import { ReportDocumentSchema } from "../schema/report.js";
import { loadConfig } from "../lib/config.js";
import type { Provider, ProviderContext } from "./types.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
  extractJsonObject,
} from "./prompt.js";

export const geminiProvider: Provider = {
  name: "gemini",
  async generate(ctx: ProviderContext) {
    const config = loadConfig();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY 키가 없습니다.");
    const model =
      ctx.model ||
      process.env.REPORTMODE_DEFAULT_MODEL ||
      config.providers.gemini?.defaultModel ||
      "gemini-2.5-flash";
    const system = buildSystemPrompt();
    const user = buildUserPrompt(ctx);

    async function call(prompt: string): Promise<string> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      });
      if (!res.ok) {
        throw new Error(
          `Gemini API 오류: HTTP ${res.status} ${await res.text()}`,
        );
      }
      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const text = data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("");
      if (!text) throw new Error("Gemini 응답이 비어 있습니다.");
      return text;
    }

    let text = await call(user);
    try {
      return ReportDocumentSchema.parse(extractJsonObject(text));
    } catch (err) {
      text = await call(
        user +
          `\n\nPrevious response was invalid: ${(err as Error).message}. Return corrected JSON only.`,
      );
      return ReportDocumentSchema.parse(extractJsonObject(text));
    }
  },
};

