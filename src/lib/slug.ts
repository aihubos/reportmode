export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "report";
}

export function makeReportId(
  dateCode: string,
  slug: string,
  existing: string[] = [],
): string {
  let candidate = `${dateCode}-${slug}`;
  if (!existing.includes(candidate)) return candidate;
  let n = 2;
  while (existing.includes(`${candidate}-${String(n).padStart(2, "0")}`)) {
    n += 1;
  }
  return `${candidate}-${String(n).padStart(2, "0")}`;
}

