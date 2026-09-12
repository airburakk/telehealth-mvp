// AURA hukuki belge kaydı — GÖVDELİ (kod Paket A, v6.268 · 2026-09-13). Hafif rota/başlık kaydı: ./routes.ts.
//
// Gövdeler vault'tan üretilir: `output/aura-hukuki-belgeler/_yayin-kesiti.py` → texts/<slug>.ts (TR + EN). Buradaki
// metin YAYIN KESİTİDİR (H1/sürüm satırı/kimlik notu ve A07 iç işleyiş bölümü yok; kimlik etiketleri yer tutucuda).
// Tüketenler: /<slug> sayfaları (components/aura/aura-legal/legal-page) · tests/unit/aura-legal.test.ts · kod Paket B
// (ekran = hash: aydınlatma TR/EN dizeleri GENERAL_KVKK v4 onam kaydına hash'lenecek — dil başına ayrı hash, S4).
//
// ⚠️ Saf sabit modül: db/auth ağacına dokunmaz. Client bileşenden İMPORT ETME (metin bundle'a girer) — routes.ts'i kullan.
import { AYDINLATMA_TR, AYDINLATMA_EN } from "./texts/aydinlatma";
import { KOSULLAR_TR, KOSULLAR_EN } from "./texts/kosullar";
import { TELE_SAGLIK_TR, TELE_SAGLIK_EN } from "./texts/tele-saglik";
import { CEREZ_TR, CEREZ_EN } from "./texts/cerez";
import { KVKK_BASVURU_TR, KVKK_BASVURU_EN } from "./texts/kvkk-basvuru";
import { AURA_LEGAL_ROUTES, type AuraLegalLang, type AuraLegalRoute, type AuraLegalSlug } from "./routes";

export * from "./routes";

export interface AuraLegalDoc extends AuraLegalRoute {
  /** Markdown gövde (lib/doctorium-legal/markdown alt kümesi) — dil başına. */
  body: Record<AuraLegalLang, string>;
}

const BODIES: Record<AuraLegalSlug, Record<AuraLegalLang, string>> = {
  aydinlatma: { tr: AYDINLATMA_TR, en: AYDINLATMA_EN },
  kosullar: { tr: KOSULLAR_TR, en: KOSULLAR_EN },
  "tele-saglik": { tr: TELE_SAGLIK_TR, en: TELE_SAGLIK_EN },
  cerez: { tr: CEREZ_TR, en: CEREZ_EN },
  "kvkk-basvuru": { tr: KVKK_BASVURU_TR, en: KVKK_BASVURU_EN },
};

export const AURA_LEGAL_DOCS: readonly AuraLegalDoc[] = AURA_LEGAL_ROUTES.map((r) => ({ ...r, body: BODIES[r.slug] }));

export function auraLegalDoc(slug: string): AuraLegalDoc | null {
  return AURA_LEGAL_DOCS.find((d) => d.slug === slug) ?? null;
}
