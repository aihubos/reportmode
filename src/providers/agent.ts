import { ReportDocumentSchema } from "../schema/report.js";
import type { Provider, ProviderContext } from "./types.js";

export const agentProvider: Provider = {
  name: "agent",
  async generate(ctx: ProviderContext) {
    if (!ctx.request.document) {
      throw new Error(
        "agent 모드는 Hermes/Codex가 만든 ReportDocument JSON이 필요합니다. reportmode import 를 사용하세요.",
      );
    }
    return ReportDocumentSchema.parse(ctx.request.document);
  },
};

