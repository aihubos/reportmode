import { z } from "zod";

export const UploadedReportMetaSchema = z.object({
  schemaVersion: z.literal("1"),
  id: z.string().regex(/^\d{6}-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(160),
  category: z.string().min(1).max(40),
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
  summary: z.string().min(1).max(500),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  status: z.literal("published"),
  sourceName: z.string().min(1).max(240),
  sourceCount: z.number().int().min(0).max(9999).default(0),
  entry: z.literal("index.html"),
});

export type UploadedReportMeta = z.infer<typeof UploadedReportMetaSchema>;

export const UploadedReportRegistrySchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  reports: z.array(UploadedReportMetaSchema),
});

export type UploadedReportRegistry = z.infer<
  typeof UploadedReportRegistrySchema
>;

