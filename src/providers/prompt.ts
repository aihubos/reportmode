import type { ProviderContext } from "./types.js";

export function buildSystemPrompt(): string {
  return `You are Report Mode, a source-grounded magazine report architect.
Return ONLY valid JSON matching ReportDocument v1.
Do not invent sources. Use only provided source ids.
Separate fact, analysis, forecast, and rumor clearly.
Write in the requested language.
Do not return HTML. Return structured JSON only.`;
}

export function buildUserPrompt(ctx: ProviderContext): string {
  const sourceBlock = ctx.sources
    .map(
      (s) =>
        `[${s.id}] ${s.kind} | ${s.title} | ${s.publisher} | ${s.url || "(no public URL)"}\nexcerpt: ${s.excerpt.slice(0, 1800)}`,
    )
    .join("\n\n");

  return `Create a ReportDocument JSON with this exact top-level shape:
{
  "schemaVersion": "1",
  "id": "will-be-overwritten",
  "slug": "english-kebab-slug",
  "title": string,
  "subtitle": string,
  "category": string,
  "language": string,
  "author": string,
  "createdAt": "ISO-like string ok",
  "updatedAt": "ISO-like string ok",
  "status": "generated",
  "summary": string,
  "verdict": string,
  "heroEyebrow": string,
  "metrics": [{"label": string, "value": string, "note"?: string}],
  "sections": [{"id": string, "heading": string, "kind": "fact"|"analysis"|"forecast"|"rumor", "body": string, "bullets": string[], "sourceIds": string[]}],
  "pros": string[],
  "cons": string[],
  "decisions": [{"id": string, "title": string, "body": string}],
  "timeline": [{"date": string, "title": string, "body": string}],
  "quotes": string[],
  "sources": [{"id": string, "kind": "web"|"local"|"note", "title": string, "publisher": string, "url"?: string, "accessedAt": string, "publishedAt"?: string, "note"?: string}],
  "tags": string[]
}

Topic: ${ctx.request.topic}
Purpose: ${ctx.request.purpose}
Audience: ${ctx.request.audience}
Language: ${ctx.request.language}
Category hint: ${ctx.request.category || "(choose a short category)"}
Author: ${ctx.request.author || "Jeremy"}
Extra notes:
${ctx.request.notes || "(none)"}

Local file notes:
${ctx.fileNotes || "(none)"}

Sources:
${sourceBlock || "(no urls; rely only on notes/files and mark uncertainty carefully)"}

Rules:
- sources array must include all provided sources with same ids when urls exist
- every section must set kind correctly
- include at least 3 sections, 2 decisions, and pros/cons when evidence supports them
- keep body concise and executive-friendly
`;
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("AI 응답에서 JSON을 찾지 못했습니다.");
  }
}
