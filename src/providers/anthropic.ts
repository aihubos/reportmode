import { ReportDocumentSchema } from "../schema/report.js";
import { loadConfig } from "../lib/config.js";
import type { Provider, ProviderContext } from "./types.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
  extractJsonObject,
} from "./prompt.js";

export const anthropicProvider: Provider = {
  name: "anthropic",
  async generate(ctx: ProviderContext) {
    const config = loadConfig();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY 키가 없습니다.");
    const model =
      ctx.model ||
      process.env.REPORTMODE_DEFAULT_MODEL ||
      config.providers.anthropic?.defaultModel ||
      "claude-sonnet-4-20250514";
    const system = buildSystemPrompt();
    const user = buildUserPrompt(ctx);

    async function call(prompt: string): Promise<string> {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          temperature: 0.3,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        throw new Error(
          `Anthropic API 오류: HTTP ${res.status} ${await res.text()}`,
        );
      }
      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = data.content?.find((c) => c.type === "text")?.text;
      if (!text) throw new Error("Anthropic 응답이 비어 있습니다.");
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

