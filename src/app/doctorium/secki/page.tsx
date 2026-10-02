import type { Metadata } from "next";
import { SeckiPage } from "@/components/aura/doctorium-secki/SeckiPage";
import { DOCTORIUM_CANONICAL_URL } from "@/lib/brand";
import { SECKI_COPY } from "@/lib/doctorium-secki/copy";
import { buildSeckiView } from "@/lib/doctorium-secki/view";
import { loadPublicDigest } from "@/lib/social-digest-public";

// /doctorium/secki — herkese açık GÜNLÜK SEÇKİ (v6.315, 2026-10-02; 👤 "bio'daki seçki sayfasını yapalım").
// Doctorium deploy'unda kısa adres doctorium.tr/secki (next.config rewrite), canonical DAİMA doctorium.tr/secki — AURA host'unda da
// servis edilir ama içeriğin markası Doctorium'dur (hukuki sayfalarla aynı desen).
// Veri: sabah kartıyla AYNI seçki (lib/social-digest-public: sabit an 07:45 TR). ISR 10 dk — DB yükü sınırlı (bio trafiği); DB hatasında
// sayfa 500 vermez, kendi hata durumunu çizer; SAHTE/örnek içerik ASLA gösterilmez (günlük seçkide uydurma haber dürüst olmaz).
export const revalidate = 600;

const URL = `${DOCTORIUM_CANONICAL_URL}/secki`;

export const metadata: Metadata = {
  title: SECKI_COPY.metaTitle,
  description: SECKI_COPY.metaDescription,
  alternates: { canonical: URL },
  openGraph: { type: "website", url: URL, siteName: "Doctorium", title: SECKI_COPY.ogTitle, description: SECKI_COPY.metaDescription, locale: "tr_TR" },
  twitter: { card: "summary", title: SECKI_COPY.ogTitle, description: SECKI_COPY.metaDescription },
};

export default async function Page() {
  let view = null;
  try {
    view = buildSeckiView(await loadPublicDigest());
  } catch (e) {
    console.warn("[secki] seçki yüklenemedi:", e instanceof Error ? e.message : e);
  }
  return <SeckiPage view={view} />;
}
