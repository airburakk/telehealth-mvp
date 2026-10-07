import type { Prisma } from "@prisma/client";

export const ACADEMIC_PAGE_SIZE = 40;
export const ACADEMIC_MAX_PAGE = 100;
export function academicSearchInput(raw: unknown, page: unknown) {
  const query = typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim().replace(/\s+/g, " ") : "";
  const error = raw != null && typeof raw !== "string" ? "Tek bir arama ifadesi girin."
    : query.length > 120 ? "Arama en fazla 120 karakter olabilir."
    : query.length > 0 && query.length < 3 ? "En az 3 karakter girin." : null;
  const value = typeof page === "string" && /^\d{1,3}$/.test(page) ? Number(page) : 1;
  return { query: query.slice(0, 120), error, page: Math.min(ACADEMIC_MAX_PAGE, Math.max(1, value)) };
}

export function academicWhere(branches: string[], query: string, createdSince?: Date): Prisma.NewsArticleWhereInput {
  // Prisma binds values. Escape LIKE metacharacters so '%'/'_' remain literal text.
  const literal = query.replace(/[\\%_]/g, "\\$&");
  const fields = ["title", "titleOriginal", "sourceName", "source", "summary", "summaryOriginal"] as const;
  return {
    module: "akademik",
    ...(createdSince ? { createdAt: { gte: createdSince } } : {}),
    AND: [
      ...(branches.length ? [{ OR: branches.map(s => ({ branchSlugs: { contains: `"${s}"` } })) }] : []),
      ...(query ? [{ OR: fields.map(field => ({ [field]: { contains: literal, mode: "insensitive" as const } })) }] : []),
    ],
  };
}

export function academicHref(query: string, page = 1, onlyNew = false) {
  const params = new URLSearchParams({ m: "akademik" });
  if (query) params.set("q", query);
  if (onlyNew) params.set("n", "1");
  if (page > 1) params.set("ap", String(page));
  return `/doktor/doctorium?${params}`;
}
