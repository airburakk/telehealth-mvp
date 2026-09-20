import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AURA_CANONICAL_URL } from "@/lib/brand";
import { auraLegalDoc, type AuraLegalLang, type AuraLegalSlug } from "@/lib/aura-legal";
import { resolveLegalDisplay, LEGAL_CANONICAL_LINK_TR, LEGAL_DISPLAY_NOTE_TR, LEGAL_DISPLAY_PARTIAL_TR } from "@/lib/aura-legal/display";
import { LEGAL_SHELL_UI_TR_VALUES } from "@/lib/aura-legal/shell-ui";
import { resolveLegalBody } from "@/lib/legal-approval";
import { getTranslations } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AuraLegalMarkdown } from "./AuraLegalMarkdown";
import { AuraLegalShell, type LegalShellDisplay } from "./AuraLegalShell";

// AURA hukuki sayfa fabrikası (kod Paket A, v6.268 · 2026-09-13) — her `src/app/<slug>/page.tsx` üç satırdır (Doctorium
// legal-page deseni). Metadata dile göre: `?lang=en` → EN başlık/açıklama, og:locale en_US; canonical DAİMA TR yolu
// (auraglobalcare.com/<slug>), hreflang alternatifleri tr + en. Yayımsız belge (A03 yayın şartı) → 404 + noindex.
//
// Paket 7 (v6.285, 👤 karar A): GÖSTERİM dili hastanın arayüz dilidir (`?lang=<kod|ad>`; yoksa oturumlu hastanın profil dili) —
// TR/EN dışı dilde gövde TR kanonikten paragraf paragraf ÇEVRİLİR (lib/legal-translate, önbellekli), kabuk "bağlayıcı metin
// Türkçe" notunu taşır ve kanonik metne bağlanır; çeviri sayfaları noindex (makine çevirisi dizine girmez). Motor yoksa EN kanonik.
// 7-C (v6.286): gövde lib/legal-approval resolveLegalBody'den — geçerli hukukçu onayı varsa DONDURULMUŞ metin (rozet "İncelenmiş
// çeviri · tarih"), yoksa otomatik çeviri (rozet "henüz incelenmedi").
//
// Next 16: `searchParams` Promise'tir — hem generateMetadata hem sayfa await eder. Sayfa dinamik render olur (query okur).

export type LegalSearchParams = Promise<{ lang?: string | string[] }>;

export function auraLegalGenerateMetadata(slug: AuraLegalSlug) {
  return async function generateMetadata({ searchParams }: { searchParams: LegalSearchParams }): Promise<Metadata> {
    const doc = auraLegalDoc(slug);
    if (!doc) throw new Error(`Hukuki belge bulunamadı: ${slug}`);
    const d = resolveLegalDisplay((await searchParams).lang);
    const lang = d.canonical;
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
      // Yayımsız → tam noindex; çeviri görünümü → noindex (dizinde yalnız kanonik TR/EN).
      robots: !doc.published ? { index: false, follow: false } : d.translated ? { index: false, follow: true } : undefined,
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
  /** Gövde altına eklenecek düğüm (ör. /kvkk-basvuru formu) — kanonik belge dili + gösterim dili adıyla çağrılır; sunucuda çözülür. */
  children?: (lang: AuraLegalLang, displayLang: string) => ReactNode;
}) {
  const doc = auraLegalDoc(slug);
  if (!doc || !doc.published) notFound();
  const sp = await searchParams;
  // Gösterim dili: ?lang → yoksa oturumlu HASTANIN profil dili → yoksa TR. (Sayfa herkese açık; oturum okuması ucuz.)
  let fallback: string | null = null;
  if (!sp.lang) {
    const user = await getCurrentUser();
    if (user?.role === "PATIENT") {
      fallback = (await db.user.findUnique({ where: { id: user.id }, select: { patientLanguage: true } }))?.patientLanguage ?? null;
    }
  }
  const d = resolveLegalDisplay(sp.lang, fallback);

  let markdown = doc.body[d.canonical];
  let display: LegalShellDisplay | null = null;
  if (d.translated) {
    const body = await resolveLegalBody(slug, d.display);
    if (body) {
      markdown = body.markdown;
      const ui = await getTranslations(d.display, [...LEGAL_SHELL_UI_TR_VALUES, LEGAL_DISPLAY_NOTE_TR, LEGAL_DISPLAY_PARTIAL_TR, LEGAL_CANONICAL_LINK_TR, doc.title.tr]);
      display = {
        name: d.display, code: d.code, partial: body.partial, ui, title: ui[doc.title.tr] ?? doc.title.en,
        status: body.status, reviewedAt: body.reviewedAt?.toISOString() ?? null,
      };
    }
    // motor yoksa: EN kanonik gövde (d.canonical = en), kabuk EN — eski davranış
  }
  return (
    <AuraLegalShell slug={slug} lang={d.canonical} display={display}>
      <AuraLegalMarkdown markdown={markdown} />
      {children?.(d.canonical, d.display)}
    </AuraLegalShell>
  );
}
