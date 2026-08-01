const SEOUL = "Asia/Seoul";

function seoulParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

export function nowIsoKst(date = new Date()): string {
  const p = seoulParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+09:00`;
}

export function yymmdd(date = new Date()): string {
  const p = seoulParts(date);
  return `${p.year.slice(2)}${p.month}${p.day}`;
}

export function displayDateFromIso(iso: string): string {
  const d = new Date(iso);
  const p = seoulParts(d);
  return `${p.year.slice(2)}${p.month}${p.day}`;
}

export function prettyDateFromIso(iso: string): string {
  const d = new Date(iso);
  const p = seoulParts(d);
  return `${p.year}.${p.month}.${p.day} KST`;
}

export function parseFlexibleDate(input?: string): Date {
  if (!input) return new Date();
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

