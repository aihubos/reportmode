export const ADMIN_ACTIONS = ["hide", "unhide", "make_private", "delete"] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

export function normalizeAdminAction(value: unknown): AdminAction | "" {
  const action = typeof value === "string" ? value : "";
  return (ADMIN_ACTIONS as readonly string[]).includes(action) ? action as AdminAction : "";
}

export function chunkReportIds(values: unknown[], size = 50) {
  const unique = Array.from(new Set(values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().slice(0, 120))
    .filter(Boolean)));
  const safeSize = Math.max(1, Math.trunc(size));
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += safeSize) {
    chunks.push(unique.slice(index, index + safeSize));
  }
  return chunks;
}
