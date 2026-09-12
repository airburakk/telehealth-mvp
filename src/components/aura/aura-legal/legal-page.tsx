import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AURA_CANONICAL_URL } from "@/lib/brand";
import { auraLegalDoc, auraLegalLang, type AuraLegalLang, type AuraLegalSlug } from "@/lib/aura-legal";
import { AuraLegalMarkdown } from "./AuraLegalMarkdown";
import { AuraLegalShell } from "./AuraLegalShell";

// AURA hukuki sayfa fabrikası (kod Paket A, v6.268 · 2026-09-13) — her `src/app/<slug>/page.tsx` üç satırdır (Doctorium
// legal-page deseni). Metadata dile göre: `?lang=en` → EN başlık/açıklama, og:locale en_US; canonical DAİMA TR yolu
// (auraglobalcare.com/<slug>), hreflang alternatifleri tr + en. Yayımsız belge (A03 yayın şartı) → 404 + noindex.
//
// Next 16: `searchParams` Promise'tir — hem generateMetadata hem sayfa await eder. Sayfa dinamik render olur (query okur);
// hukuki metin sabit, maliyet önemsiz.

export type LegalSearchParams = Promise<{ lang?: string | string[] }>;

export function auraLegalGenerateMetadata(slug: AuraLegalSlug) {
  return async function generateMetadata({ searchParams }: { searchParams: LegalSearchParams }): Promise<Metadata> {
    const doc = auraLegalDoc(slug);
    if (!doc) throw new Error(`Hukuki belge bulunamadı: ${slug}`);
    const lang = auraLegalLang((await searchParams).lang);
    const canonical = `${AURA_CANONICAL_URL}${doc.path}`;
    const url = lang === "en" ? `${canonical}?lang=en` : canonical;
    return {
      title: doc.title[lang], // layout şablonu → "<başlık> · AURA"
      description: doc.description[lang],
      alternates: { canonical, languages: { tr: canonical, en: `${canonical}?lang=en` } },
      openGraph: {
        type: "article",
        siteName: "AURA",
        title: `${doc.title[lang]} · AURA`,
        description: doc.description[lang],
        url,
        locale: lang === "en" ? "en_US" : "tr_TR",
        alternateLocale: [lang === "en" ? "tr_TR" : "en_US"],
      },
      robots: doc.published ? undefined : { index: false, follow: false },
    };
  };
}

export async function AuraLegalPage({
  slug,
  searchParams,
  children,
}: {
  slug: AuraLegalSlug;
  searchParams: LegalSearchParams;
  /** Gövde altına eklenecek düğüm (ör. /kvkk-basvuru formu) — belge diliyle çağrılır; sunucuda çözülür, kabuğa hazır düğüm gider. */
  children?: (lang: AuraLegalLang) => ReactNode;
}) {
  const doc = auraLegalDoc(slug);
  if (!doc || !doc.published) notFound();
  const lang = auraLegalLang((await searchParams).lang);
  return (
    <AuraLegalShell slug={slug} lang={lang}>
      <AuraLegalMarkdown markdown={doc.body[lang]} />
      {children?.(lang)}
    </AuraLegalShell>
  );
}
