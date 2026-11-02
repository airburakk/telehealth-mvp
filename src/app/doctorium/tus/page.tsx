import type { Metadata } from "next";
import { TusPublicPage } from "@/components/aura/doctorium-tus/TusPublicPage";
import { StructuredData } from "@/components/aura/structured-data";
import { DOCTORIUM_CANONICAL_URL, IS_DOCTORIUM_DEPLOY } from "@/lib/brand";
import { TUS_PUBLIC_COPY } from "@/lib/doctorium-tus-public/copy";
import { buildTusPublicView, parsePeriodParam, tusDatasetJsonLd } from "@/lib/doctorium-tus-public/view";
import { approvedTusSummaries } from "@/lib/tus-data";

// /doctorium/tus — herkese açık TUS taban puanları ve kontenjanları (v6.358, 2026-10-29; 👤 "Önerilerle uygula" — taslak
// vault output/doctorium-tus-herkese-acik-sayfa-taslak-2026-10-29.md). /secki deseni: Doctorium deploy'unda kısa adres doctorium.tr/tus
// (next.config rewrite), canonical DAİMA doctorium.tr/tus — dönem parametreli sürümler de köke canonical (tek indeks adayı).
// Veri: YALNIZ onaylı ÖSYM dönemleri (approvedTusSummaries — approvedAt kapısı); DB yok. `?donem=` searchParams'ı sayfayı istek-başı
// çizime çevirir; maliyeti statik JSON okumasıdır. Portal TUS sayfası (/doktor/doctorium/tus) ayrı ve girişli kalır.
const URL = `${DOCTORIUM_CANONICAL_URL}/tus`;
const c = TUS_PUBLIC_COPY;

export const metadata: Metadata = {
  // `absolute`: segment şablonu (" · Doctorium") ikinci kez eklenmesin — başlık markayı zaten taşır.
  title: { absolute: c.metaTitle },
  description: c.metaDescription,
  alternates: { canonical: URL },
  openGraph: { type: "website", url: URL, siteName: "Doctorium", title: c.ogTitle, description: c.metaDescription, locale: "tr_TR" },
  twitter: { card: "summary", title: c.ogTitle, description: c.metaDescription },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ donem?: string | string[] }> }) {
  const periods = approvedTusSummaries();
  const { donem } = await searchParams;
  const view = buildTusPublicView(periods, parsePeriodParam(donem, periods));
  const dataset = tusDatasetJsonLd(periods, URL, { name: c.datasetName, description: c.datasetDescription });
  return (
    <>
      {/* JSON-LD yalnız onaylı statik veriden kurulur (kullanıcı girdisi girmez); "<" yine de kaçırılır. */}
      {dataset ? <StructuredData json={JSON.stringify(dataset).replace(/</g, "\\u003c")} /> : null}
      <TusPublicPage view={view} basePath={IS_DOCTORIUM_DEPLOY ? "/tus" : "/doctorium/tus"} />
    </>
  );
}
