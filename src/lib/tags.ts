const BLOCKED_TAG_KEYS = new Set([
  "ai report",
  "agent",
  "draft",
  "external",
  "generated",
  "general",
  "jeremy style",
  "n a",
  "none",
  "official",
  "published",
  "report",
  "reports",
  "sample",
  "source",
  "source ledger",
  "tag",
  "tags",
  "temporary",
  "temporary chat",
  "test",
  "unknown",
  "untitled",
  "공식 발표",
  "기타",
  "보고서",
]);

const TAG_ALIASES = new Map<string, string>([
  ["ai", "AI"],
  ["ai ecosystem", "AI Ecosystem"],
  ["ai agent", "AI 에이전트"],
  ["ai 에이전트", "AI 에이전트"],
  ["aip", "AIP"],
  ["apple", "Apple"],
  ["apple silicon", "Apple Silicon"],
  ["automation", "자동화"],
  ["beginner", "입문"],
  ["chatgpt", "ChatGPT"],
  ["codex", "Codex"],
  ["comfyui", "ComfyUI"],
  ["comparison", "비교"],
  ["dario amodei", "다리오 아모데이"],
  ["데미스 하사비스", "데미스 하사비스"],
  ["데미스 허사비스", "데미스 하사비스"],
  ["demis hassabis", "데미스 하사비스"],
  ["deep dive", "심층분석"],
  ["dongtan", "동탄"],
  ["elon musk", "일론 머스크"],
  ["family", "가족"],
  ["fact check", "팩트체크"],
  ["gemini", "Gemini"],
  ["guide", "가이드"],
  ["hermes", "Hermes"],
  ["hermes agent", "Hermes"],
  ["human in the loop", "Human-in-the-loop"],
  ["llm wiki", "LLM Wiki"],
  ["local llm", "로컬 LLM"],
  ["m5 max", "M5 Max"],
  ["mlx", "MLX"],
  ["obsidian", "Obsidian"],
  ["ollama", "Ollama"],
  ["openai", "OpenAI"],
  ["palantir", "Palantir"],
  ["pltr", "Palantir"],
  ["sam altman", "샘 알트만"],
  ["샘 올트먼", "샘 알트만"],
  ["second brain", "세컨드 브레인"],
  ["self hosted", "셀프호스팅"],
  ["prompt", "프롬프트"],
  ["samsung", "Samsung"],
  ["tesla", "Tesla"],
]);

function compactTagText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lookupKey(value: unknown): string {
  return compactTagText(value)
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[._/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function tagFilterKey(value: unknown): string {
  return lookupKey(value).replace(/\s+/g, "-");
}

function sourceTags(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(",");
  return [];
}

export function sanitizeTags(value: unknown, maxTags = 12): string[] {
  const unique = new Map<string, string>();
  for (const source of sourceTags(value)) {
    const raw = compactTagText(source);
    const rawKey = lookupKey(raw);
    if (!raw || !rawKey || rawKey.length < 2 || /^\d+$/.test(rawKey)) continue;
    const canonical = TAG_ALIASES.get(rawKey) || raw;
    const key = tagFilterKey(canonical);
    if (!key || BLOCKED_TAG_KEYS.has(rawKey) || BLOCKED_TAG_KEYS.has(lookupKey(canonical))) continue;
    if (!unique.has(key)) unique.set(key, canonical);
  }
  return Array.from(unique.values()).slice(0, Math.max(0, maxTags));
}
