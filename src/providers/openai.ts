import { ReportDocumentSchema } from "../schema/report.js";
import { loadConfig } from "../lib/config.js";
import type { Provider, ProviderContext } from "./types.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
  extractJsonObject,
} from "./prompt.js";

async function callOpenAICompatible(args: {
  apiKey: string;
  baseUrl: string;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const res = await fetch(`${args.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI API 오류: HTTP ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI 응답이 비어 있습니다.");
  return content;
}

export const openaiProvider: Provider = {
  name: "openai",
  async generate(ctx: ProviderContext) {
    const config = loadConfig();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY 키가 없습니다.");
    const model =
      ctx.model ||
      process.env.REPORTMODE_DEFAULT_MODEL ||
      config.providers.openai?.defaultModel ||
      "gpt-4.1-mini";
    const system = buildSystemPrompt();
    const user = buildUserPrompt(ctx);
    let text = await callOpenAICompatible({
      apiKey,
      baseUrl: "https://api.openai.com/v1",
      model,
      system,
      user,
    });
    try {
      return ReportDocumentSchema.parse(extractJsonObject(text));
    } catch (err) {
      text = await callOpenAICompatible({
        apiKey,
        baseUrl: "https://api.openai.com/v1",
        model,
        system,
        user:
          user +
          `\n\nPrevious response was invalid: ${(err as Error).message}. Return corrected JSON only.`,
      });
      return ReportDocumentSchema.parse(extractJsonObject(text));
    }
  },
};

export const openaiCompatibleProvider: Provider = {
  name: "openai-compatible",
  async generate(ctx: ProviderContext) {
    const config = loadConfig();
    const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY;
    if (!apiKey) throw new Error("OPENAI_COMPATIBLE_API_KEY 키가 없습니다.");
    const baseUrl =
      process.env.OPENAI_COMPATIBLE_BASE_URL || "https://api.openai.com/v1";
    const model =
      ctx.model ||
      process.env.OPENAI_COMPATIBLE_MODEL ||
      config.providers["openai-compatible"]?.defaultModel ||
      "gpt-4.1-mini";
    const system = buildSystemPrompt();
    const user = buildUserPrompt(ctx);
    let text = await callOpenAICompatible({
      apiKey,
      baseUrl,
      model,
      system,
      user,
    });
    try {
      return ReportDocumentSchema.parse(extractJsonObject(text));
    } catch (err) {
      text = await callOpenAICompatible({
        apiKey,
        baseUrl,
        model,
        system,
        user:
          user +
          `\n\nPrevious response was invalid: ${(err as Error).message}. Return corrected JSON only.`,
      });
      return ReportDocumentSchema.parse(extractJsonObject(text));
    }
  },
};

