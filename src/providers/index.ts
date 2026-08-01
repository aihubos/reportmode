import { agentProvider } from "./agent.js";
import { anthropicProvider } from "./anthropic.js";
import { geminiProvider } from "./gemini.js";
import {
  openaiCompatibleProvider,
  openaiProvider,
} from "./openai.js";
import type { Provider } from "./types.js";

const providers: Record<string, Provider> = {
  agent: agentProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  "openai-compatible": openaiCompatibleProvider,
};

export function getProvider(name: string): Provider {
  const p = providers[name];
  if (!p) {
    throw new Error(
      `지원하지 않는 공급자입니다: ${name}. 사용 가능: ${Object.keys(providers).join(", ")}`,
    );
  }
  return p;
}

export function listProviders(): string[] {
  return Object.keys(providers);
}

