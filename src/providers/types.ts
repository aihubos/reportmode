import type { GenerateRequest, ReportDocument } from "../schema/report.js";
import type { CollectedSource } from "../lib/sources.js";

export type ProviderContext = {
  request: GenerateRequest;
  sources: CollectedSource[];
  fileNotes: string;
  model?: string;
};

export type Provider = {
  name: string;
  generate(ctx: ProviderContext): Promise<ReportDocument>;
};

