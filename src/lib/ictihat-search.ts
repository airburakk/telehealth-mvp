import type { Prisma } from "@prisma/client";
import { keywordByKey } from "./hukuk-keywords";

export const ICTIHAT_PAGE_SIZE = 40;
export const ICTIHAT_MAX_PAGE = 100;
export function ictihatSearchInput(raw: unknown, page: unknown, key?: unknown) {
  const query = typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim().replace(/\s+/g, " ") : "";
  const error = raw != null && typeof raw !== "string" ? "Tek bir arama ifadesi girin."
    : query.length > 80 ? "Arama en fazla 80 karakter olabilir."
    : query.length === 1 ? "En az 2 karakter girin." : null;
  const value = typeof page === "string" && /^\d{1,3}$/.test(page) ? Number(page) : 1;
  return { query: query.slice(0, 80), error, page: Math.min(ICTIHAT_MAX_PAGE, Math.max(1, value)), keyword: typeof key === "string" ? keywordByKey(key) : null };
}

export function ictihatWhere(query: string, patterns: string[] = [], createdSince?: Date): Prisma.NewsArticleWhereInput {
  const literal = query.replace(/[\\%_]/g, "\\$&");
  return { module: "mevzuat", category: "ictihat", ...(createdSince ? { createdAt: { gte: createdSince } } : {}), AND: [
    ...(query ? [{ OR: [{ title: { contains: literal, mode: "insensitive" as const } }, { summary: { contains: literal, mode: "insensitive" as const } }] }] : []),
    ...(patterns.length ? [{ OR: patterns.map(p => ({ summary: { contains: p, mode: "insensitive" as const } })) }] : []),
  ] };
}

export function ictihatHref(query: string, page = 1, key?: string | null, onlyNew = false) {
  const params = new URLSearchParams({ m: "mevzuat", h: "ictihat" });
  if (query) params.set("q", query);
  if (keywordByKey(key)) params.set("k", key!);
  if (onlyNew) params.set("n", "1");
  if (page > 1) params.set("ip", String(page));
  return `/doktor/doctorium?${params}`;
}

/** Literal Turkish case folding with offsets into the original text. No regex
 * constructed from user input, no HTML parsing, and at most 20 highlights. */
export function literalParts(text: string, query: string): { text: string; match: boolean }[] {
  if (!query) return [{ text, match: false }];
  let folded = "", offset = 0;
  const starts: number[] = [], ends: number[] = [];
  for (const c of text) {
    const lower = c.toLocaleLowerCase("tr-TR");
    for (let j = 0; j < lower.length; j++) { starts.push(offset); ends.push(offset + c.length); }
    folded += lower; offset += c.length;
  }
  const needle = query.toLocaleLowerCase("tr-TR"), parts: { text: string; match: boolean }[] = [];
  let from = 0, search = 0, count = 0;
  while (count < 20) {
    const at = folded.indexOf(needle, search);
    if (at < 0) break;
    const start = starts[at], end = ends[at + needle.length - 1];
    if (start > from) parts.push({ text: text.slice(from, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    from = end; search = at + needle.length; count++;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts.length ? parts : [{ text, match: false }];
}

export function ictihatExcerpt(text: string, query: string) {
  const parts = literalParts(text, query);
  const first = parts.findIndex(p => p.match);
  const at = first < 0 ? 0 : parts.slice(0, first).reduce((n, p) => n + p.text.length, 0);
  const start = Math.max(0, at - 65), end = Math.min(text.length, start + 240);
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
