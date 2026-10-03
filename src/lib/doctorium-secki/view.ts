// "Günlük Seçki" sayfasının SAF görünüm modeli (v6.315, 2026-10-02) — DB/React bağımlılığı yok, birim testli.
// Kaynak: lib/social-digest-public.loadPublicDigest (sabah kartıyla aynı seçki). Bileşen yalnız bunu çizer.
import type { PublicDigest } from "@/lib/social-digest-public";
import { trDateLabel } from "@/lib/tr-date-label";

// v6.317: tarih etiketi ortak modüle taşındı (lib/tr-date-label); burada geriye uyum için yeniden dışa aktarılır.
export { trDateLabel };

/** Yalnız http/https bağlantı (javascript: vb. reddedilir); aksi null. Kaynak URL'i ingest edilen veridir → savunmacı. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Bağlantının görünen alan adı ("www." atılır) — okurun nereye gideceğini önceden görmesi için. */
export function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

export interface SeckiItemView {
  id: string;
  /** Akış etiketi ("Akademik", "İlaç & Cihaz", …) — kartla aynı. */
  kicker: string;
  /** Yalnız akademikte ve günün branşıyla eşleştiyse dolu (kartla aynı). */
  branchLabel: string | null;
  title: string;
  source: string;
  // 🔴 ÖZET YOK (bilinçli, 02.10 ölçümü): seçkideki 160 karakterlik teaser özet sayfaya UYGUN DEĞİL — akademik özetler çoğu zaman İNGİLİZCE
  // ve bölüm başlığı yapışık ("BackgroundGas flaring…"), KLİMİK kaleminin özeti site menüsü artığı ("…Klimik Dernek Kurullar Dernek Tüzüğü…"),
  // Resmî Gazete kalemlerinin özeti BOŞ. Sabah kartı da bu yüzden özetsizdir. Veri kalitesi düzelmeden marka sayfasında GÖSTERİLMEZ
  // (başlık + kaynak + bağlantı, teaser kuralının asgarisi). Geri eklemek için buraya `summary` + SeckiPage'e paragraf + test.
  href: string | null;
  host: string | null;
}

export interface SeckiView {
  day: string;
  dateLabel: string;
  rotationLabel: string;
  items: SeckiItemView[];
}

export function buildSeckiView(d: PublicDigest): SeckiView {
  return {
    day: d.day,
    dateLabel: trDateLabel(d.day),
    rotationLabel: d.rotation.label,
    items: d.items.map((it) => {
      const href = safeHttpUrl(it.url);
      return {
        id: it.id,
        kicker: it.streamLabel,
        branchLabel: it.branch?.label ?? null,
        title: it.title,
        source: it.sourceName,
        href,
        host: href ? hostOf(href) : null,
      };
    }),
  };
}
