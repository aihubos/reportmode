import { z } from "zod";

export const ReportStatusSchema = z.enum([
  "draft",
  "generated",
  "published",
  "publish_failed",
]);

export const SectionKindSchema = z.enum([
  "fact",
  "analysis",
  "forecast",
  "rumor",
]);

export const SourceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["web", "local", "note"]).default("web"),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url().optional(),
  publishedAt: z.string().optional(),
  accessedAt: z.string().min(1),
  note: z.string().optional(),
});

export const ReportTableSchema = z
  .object({
    columns: z.array(z.string().min(1)).min(2),
    rows: z.array(z.array(z.string().min(1)).min(2)).min(1),
  })
  .superRefine((table, ctx) => {
    table.rows.forEach((row, index) => {
      if (row.length !== table.columns.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rows", index],
          message: "표의 모든 행은 열 개수와 같아야 합니다.",
        });
      }
    });
  });

export const SectionSchema = z.object({
  id: z.string().min(1),
  heading: z.string().min(1),
  kind: SectionKindSchema,
  body: z.string().min(1),
  bullets: z.array(z.string()).default([]),
  table: ReportTableSchema.optional(),
  sourceIds: z.array(z.string()).default([]),
});

export const DecisionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});

export const MetricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  note: z.string().optional(),
});

export const TimelineItemSchema = z.object({
  date: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});

export const ReportDocumentSchema = z.object({
  schemaVersion: z.literal("1"),
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().default(""),
  category: z.string().min(1),
  language: z.string().default("ko"),
  author: z.string().default("Jeremy"),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  status: ReportStatusSchema.default("draft"),
  summary: z.string().min(1),
  verdict: z.string().min(1),
  heroEyebrow: z.string().optional(),
  metrics: z.array(MetricSchema).default([]),
  sections: z.array(SectionSchema).min(1),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  decisions: z.array(DecisionSchema).default([]),
  timeline: z.array(TimelineItemSchema).default([]),
  quotes: z.array(z.string()).default([]),
  sources: z.array(SourceSchema).min(1),
  tags: z.array(z.string()).default([]),
  provider: z.string().optional(),
  model: z.string().optional(),
});

export type ReportDocument = z.infer<typeof ReportDocumentSchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type SectionKind = z.infer<typeof SectionKindSchema>;

export const GenerateRequestSchema = z.object({
  topic: z.string().min(1),
  purpose: z.string().default("의사결정 지원 보고서"),
  audience: z.string().default("경영진"),
  language: z.string().default("ko"),
  category: z.string().optional(),
  urls: z.array(z.string().url()).default([]),
  files: z.array(z.string()).default([]),
  notes: z.string().default(""),
  provider: z
    .enum(["agent", "openai", "anthropic", "gemini", "openai-compatible"])
    .default("agent"),
  model: z.string().optional(),
  author: z.string().optional(),
  draft: z.boolean().default(false),
  document: ReportDocumentSchema.optional(),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const ManifestItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  category: z.string(),
  summary: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: ReportStatusSchema,
  path: z.string(),
  url: z.string(),
  displayDate: z.string(),
  sourceCount: z.number(),
  tags: z.array(z.string()).default([]),
  coverImage: z.string().optional(),
  coverAlt: z.string().optional(),
  coverFocalPointX: z.number().min(0).max(100).optional(),
});

export type ManifestItem = z.infer<typeof ManifestItemSchema>;
