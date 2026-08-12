// Kariyer modülü — liste ve detay sayfasının PAYLAŞTIĞI parçalar (v6.89).
//
// Neden ayrı dosya: `page.tsx` bir route dosyasıdır ve Next.js'te özel export sözleşmesi vardır
// (default · metadata · dynamic …). Ortak bileşeni oradan import etmek kırılgan olur → paylaşılan
// her şey burada durur. Server component'tir ("use client" YOK): salt sunum, state gerektirmez.
import { Info } from "lucide-react";

/**
 * Kalıcı uyarı — liste ve detayda AYNI metin (kullanıcı onaylı, 2026-08-11).
 * ⚠️ KALDIRILAMAZ: modül idari süreç anlatır; yanlış plan hekimin gerçek kaybıdır (kaçırılan sınav
 * başvurusu, eksik belge, boşa apostil masrafı). Metin değişikliği kullanıcı onayı ister.
 */
export function CareerDisclaimer() {
  return (
    <p className="mt-5 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[11px] leading-relaxed text-[var(--c-ink-2)]">
      <Info size={14} className="mt-px shrink-0 text-amber-300" />
      <span>
        Bilgilendirme amaçlıdır; hukuki veya idari danışmanlık değildir. Süreçler ülke, eyalet ve
        başvuru tarihine göre değişir — işlem yapmadan önce resmî kaynağı doğrulayın.
      </span>
    </p>
  );
}

/** "11 Ağustos 2026" — kongre/akademik kartlarıyla aynı biçim (UTC: gün kayması olmasın). */
export function careerDate(d: Date) {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Ülke/bölge etiketi.
 * ⚠️ BAE'de TEK kod yoktur: Dubai (AE-DU / DHA) ile Abu Dhabi (AE-AZ / DOH) AYRI süreçlerdir —
 * tek "BAE" etiketi hekimi yanlış otoriteye yönlendirir.
 */
export const COUNTRY_LABEL: Record<string, string> = {
  DE: "Almanya",
  "AE-DU": "Dubai",
  "AE-AZ": "Abu Dhabi",
  SA: "Suudi Arabistan",
  GB: "Birleşik Krallık",
  TR: "Türkiye",
};
