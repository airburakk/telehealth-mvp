// Advisory only: no network, AI, DB write, filtering, title replacement or date synthesis.
export type PublishedAtBasis = "online-publication" | "issue-date" | "first-publication" | "year-month" | "source-created-date" | "unknown";
export interface ArticleMetadata {
  source: string; externalId: string; title: string; titleOriginal?: string | null;
  doi: string | null; url: string | null;
  publishedAt?: Date | null; createdAt?: Date | null; publishedAtBasis?: PublishedAtBasis;
}
export interface VerifiedArticleReference {
  doi: string; title: string; sourceUrl: string;
}
export interface MetadataFinding {
  code: string; field: string; message: string;
}

const plainTitle = (s: string) => s.replace(/<\/?(?:i|b|em|strong|sub|sup)>/gi, "").replace(/\s+/g, " ").trim().replace(/\.$/, "");
const normalizedDoi = (doi: string) => doi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").toLowerCase();
const isDoi = (doi: string) => /^10\.\d{4,9}\/\S+$/i.test(doi);

export function inspectArticleMetadata(metadata: ArticleMetadata, reference?: VerifiedArticleReference) {
  const findings: MetadataFinding[] = [];
  const add = (code: string, field: string, message: string) => findings.push({ code, field, message });
  const original = plainTitle(metadata.titleOriginal ?? metadata.title);
  // A dangling phrase is a review signal, never a rejection. Short complete titles are fine.
  if (/^(?:Detection|Effect|Effects|Impact)\s+of$/i.test(original)) {
    add("possible-incomplete-title", "title", "Başlık tamamlanmamış olabilir; kaynak künyesiyle insan incelemesi gerekir.");
  }
  if (!original) add("empty-title", "title", "Özgün başlık boş; kaynakla karşılaştırılmalı.");
  const doi = metadata.doi ? normalizedDoi(metadata.doi) : null;
  if (doi && !isDoi(doi)) add("doi-format-review", "doi", "DOI biçimi incelenmeli; mevcut değer korunur.");
  let url: URL | null = null;
  if (metadata.url) {
    try { url = new URL(metadata.url); } catch { add("source-url-invalid", "url", "Kaynak adresi ayrıştırılamadı."); }
    if (url && !["https:", "http:"].includes(url.protocol)) add("source-url-protocol-review", "url", "Kaynak adresinin protokolü incelenmeli.");
    if (url && ["doi.org", "dx.doi.org"].includes(url.hostname.toLowerCase()) && doi) {
      let linkedDoi: string;
      try { linkedDoi = normalizedDoi(decodeURIComponent(url.pathname.slice(1))); } catch { linkedDoi = ""; }
      if (linkedDoi !== doi) add("doi-url-mismatch", "url", "DOI alanı ve DOI bağlantısı farklı; kaynak eşleşmesi gerekir.");
    }
  } else if (doi) add("source-url-missing", "url", "DOI var, kaynak adresi yok; inceleme önerilir.");

  if (reference) {
    let referenceUrlValid = false;
    try { referenceUrlValid = new URL(reference.sourceUrl).protocol === "https:"; } catch { /* no verified identity */ }
    const referenceDoi = normalizedDoi(reference.doi);
    if (!doi || !isDoi(referenceDoi) || doi !== referenceDoi || !referenceUrlValid) {
      add("reference-identity-unconfirmed", "doi", "Referans DOI/kaynak kimliği eşleşmedi; başlık düzeltmesi önerilemez.");
    } else if (original !== plainTitle(reference.title)) {
      add("source-title-mismatch", "titleOriginal", "Aynı DOI için özgün başlık doğrulanmış referanstan farklı; otomatik onarım yapılmaz.");
    }
  }
  for (const field of ["publishedAt", "createdAt"] as const) {
    const value = metadata[field];
    if (value && Number.isNaN(value.getTime())) add("invalid-date", field, "Tarih ayrıştırılamadı; yeni tarih üretilmez.");
  }
  if (metadata.publishedAtBasis === "source-created-date") add("publication-date-fallback", "publishedAt", "Yayın tarihi alanı sağlayıcı kayıt tarihi yedeğinden geliyor; ilk yayın tarihi olduğu varsayılmamalı.");
  if (metadata.publishedAtBasis === "year-month") add("publication-date-month-precision", "publishedAt", "Kaynak yalnız yıl/ay veriyor; saklanan ayın ilk günü gerçek yayın günü olarak doğrulanmış değil.");
  return {
    status: findings.length ? "human-review" : "no-local-finding",
    findings,
    dates: {
      publishedAt: { value: metadata.publishedAt ?? null, role: "publication-field", basis: metadata.publishedAtBasis ?? "unknown" },
      createdAt: { value: metadata.createdAt ?? null, role: "local-ingest-time" },
    },
    repair: null,
  } as const;
}

/** Non-destructive ingest hook. Never blocks even when an observational sink fails. */
export function reportArticleMetadataQuality(
  metadata: ArticleMetadata,
  sink: (event: { source: string; externalId: string; findings: MetadataFinding[] }) => void =
    (event) => console.warn("[doctorium-metadata-review]", event),
): void {
  try {
    const { findings } = inspectArticleMetadata(metadata);
    if (findings.length) sink({ source: metadata.source, externalId: metadata.externalId, findings });
  } catch { /* Quality observation must not alter ingestion availability. */ }
}
