import type { Metadata } from "next";
import { DOCTORIUM_CANONICAL_URL } from "@/lib/brand";
import { legalDoc, type LegalSlug } from "@/lib/doctorium-legal";
import { LegalShell } from "./LegalShell";

// Beş hukuki sayfanın ortak fabrikası (v6.210): her `src/app/doctorium/<slug>/page.tsx` iki satırdır.
// Metadata: sekme "<title> · Doctorium" (segment layout şablonu), canonical DAİMA doctorium.tr —
// AURA host'unda da servis edilir ama belgenin markası Doctorium'dur (lib/brand DOCTORIUM_CANONICAL_URL
// notu: SITE_URL "bu deploy kendini nerede sanıyor"u söyler, canonical "içeriğin markası nerede yaşıyor"u).
export function legalMetadata(slug: LegalSlug): Metadata {
  const doc = legalDoc(slug);
  if (!doc) throw new Error(`Hukuki belge bulunamadı: ${slug}`);
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: `${DOCTORIUM_CANONICAL_URL}${doc.path}` },
    openGraph: { type: "article", title: `${doc.title} · Doctorium`, description: doc.description, url: `${DOCTORIUM_CANONICAL_URL}${doc.path}`, locale: "tr_TR" },
  };
}

export function LegalPage({ slug }: { slug: LegalSlug }) {
  const doc = legalDoc(slug);
  if (!doc) throw new Error(`Hukuki belge bulunamadı: ${slug}`);
  return <LegalShell doc={doc} />;
}
