// Sağlık Turizmi — AURA-dışı sorumluluk bildirimi (A08 madde B; 👤 R12 12.09.2026: B.3 metni yürürlükte — kod Paket D,
// v6.274, 2026-09-19). Tek doğruluk kaynağı VAULT: output/aura-hukuki-belgeler/A08 → `_yayin-kesiti.py` →
// lib/aura-legal/texts/turizm-bildirimi.ts (TR kanonik + EN ikinci kanonik; ELLE DÜZENLENMEZ). Burası yalnız alıntıyı
// başlık + gövdeye ayırır ve düz metne indirir (bildirim gövdesi ve onay ekranı markdown çizmez).
// Eski 12.07.2026 metni (A08 B.1 "eski metin") SÜPERSEDE: "cezai sorumluluk" ifadesi çıktı, AURA'nın kastı / ağır ihmali
// saklı tutuldu, "kaydınıza işlenir" cümlesi eklendi. Gösterim (A08 B.2): SaglikTurizmiPlanner onay ekranı (TR/EN
// kanonik doğrudan; diğer dillerde çalışma-anı çevirisi bilgilendirme amaçlıdır) + api/patient/tourism-request bildirimi
// (TOURISM_DISCLAIMER, hasta dilinde) + denetim zinciri kaydı (TOURISM_DISCLAIMER_NOTICE, tarih-saatli).
import type { ConsentLang } from "./consent-lang";
import { plainLegalText } from "./consent-lang";
import { TURIZM_BILDIRIMI_TR, TURIZM_BILDIRIMI_EN } from "./aura-legal/texts/turizm-bildirimi";

export const TOURISM_DISCLAIMER_VERSION = "1.0"; // = A08 belge sürümü; metin değişirse artar (bildirim kaydı sürümü taşır)

export interface TourismDisclaimer {
  title: string;
  body: string;
}

/** Alıntı: ilk paragraf = kalın başlık, kalan = gövde. Satır içi sert kırılmalar boşluğa iner (tek paragraf). */
function split(md: string): TourismDisclaimer {
  const [title, ...rest] = plainLegalText(md).split(/\n\s*\n/);
  return {
    title: (title ?? "").replace(/\s+/g, " ").trim(),
    body: rest.join("\n\n").replace(/[ \t]*\n(?!\n)[ \t]*/g, " ").trim(),
  };
}

export const TOURISM_DISCLAIMER: Record<ConsentLang, TourismDisclaimer> = {
  tr: split(TURIZM_BILDIRIMI_TR),
  en: split(TURIZM_BILDIRIMI_EN),
};

export function tourismDisclaimer(lang: ConsentLang): TourismDisclaimer {
  return TOURISM_DISCLAIMER[lang];
}

/** Geriye uyum (TR kanonik) — useT sözlükleri ve eski çağıranlar bu sabitleri okur. */
export const TOURISM_DISCLAIMER_TITLE = TOURISM_DISCLAIMER.tr.title;
export const TOURISM_DISCLAIMER_BODY = TOURISM_DISCLAIMER.tr.body;
