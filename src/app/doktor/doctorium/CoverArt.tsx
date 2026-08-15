import type { FeedItem } from "@/lib/doctorium";

/**
 * Doctorium kapak görseli (v6.99 — kullanıcı kararı 2026-08-15: A + C yerleşimi).
 *
 * KODDAN ÜRETİLİR: dış istek yok (CSP/performans etkilenmez), telif yok, tema-duyarlı.
 * Desen içeriğin KİMLİĞİNDEN (id) türetilir — aynı kart her açılışta aynı görseli alır,
 * farklı kartlar farklıdır. Fotoğraf/AI görseli BİLİNÇLİ yok: klinik içerikte "gerçek gibi
 * görünen sahte" riski + ajans telifi (vault output/doctorium-akis-genisletme-2026-08-15.md §6).
 *
 * Renk daima BÖLÜM rengidir (ArticleCard MODULE_EYEBROW hex'leriyle birebir) ve kapak kendi
 * kutusunda yaşar — "kulvar/bölüm rengi yüzey boyamaz" kuralı korunur. Desen ailesi içerik
 * türüne bağlı: akademik=veri eğrisi · hukuk=belge satırı (tokmak/terazi fotoğraf klişesi yok) ·
 * sektörel=dalga · ilaç=molekül halkaları · kongre=tarih bloğu · kariyer=basamak.
 *
 * İki boy: "card" (72×72, akış kartının sol künyesi — A) · "band" (geniş üst bant, detay — C).
 */

// ArticleCard MODULE_EYEBROW ile birebir aynı hex'ler (tek kaynak orası; kongre tema-ink).
const MODULE_COLOR: Record<string, string> = {
  akademik: "#34d399",
  sektorel: "#a78bfa",
  ilac: "#22d3ee",
  mevzuat: "#fb7185",
  kongre: "var(--c-ink)",
  kariyer: "#60a5fa",
};

/** Deterministik ucuz hash (djb2) — kripto değil, yalnız desen çeşitlemesi için. */
function hashOf(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** hash'ten [min,max] aralığında değer — desen parametreleri buradan türetilir. */
function pick(h: number, salt: number, min: number, max: number): number {
  const x = (h ^ (salt * 2654435761)) >>> 0;
  return min + (x % 1000) / 1000 * (max - min);
}

/**
 * Kapak künye damgası: içtihatta esas no; kalanında kaynak adı. Uzun ad kelime ORTASINDAN
 * kesilmez ("AMERICAN S" çirkindi — 2026-08-15 canlı tur): önce parantez içi kısaltma denenir
 * ("… (ASCO)" → ASCO), yoksa sığan tam kelimeler alınır, o da yoksa ilk kelime kırpılır.
 */
function stampOf(item: Pick<FeedItem, "kind" | "title" | "sourceName">, max: number): string {
  if (item.kind === "ictihat") {
    const e = /E\.\s*[\d/]+/.exec(item.title)?.[0];
    if (e) return e.toUpperCase();
  }
  const name = item.sourceName.replace(/\s+/g, " ").trim();
  const abbr = /\(([^)]{2,12})\)/.exec(name)?.[1];
  if (abbr && abbr.length <= max) return abbr.toUpperCase();
  const words = name.toUpperCase().split(" ");
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  return out || words[0].slice(0, max);
}

/** Desen ailesi — viewBox 0 0 100 100 üzerinde çizilir, iki boyda da aynı çizim ölçeklenir. */
function pattern(family: string, h: number, c: string) {
  switch (family) {
    case "veri": // akademik — veri eğrisi + halka
      return (
        <g stroke={c} strokeOpacity=".45" fill="none" strokeWidth="1.6">
          <circle cx={pick(h, 1, 22, 40)} cy={pick(h, 2, 24, 44)} r={pick(h, 3, 12, 20)} />
          <circle cx={pick(h, 4, 58, 76)} cy={pick(h, 5, 52, 68)} r={pick(h, 6, 18, 28)} strokeOpacity=".3" />
          <path d={`M-4 ${pick(h, 7, 68, 84)} L${pick(h, 8, 24, 36)} ${pick(h, 9, 40, 56)} L${pick(h, 10, 48, 62)} ${pick(h, 11, 52, 66)} L104 ${pick(h, 12, 18, 36)}`} />
        </g>
      );
    case "belge": // hukuk — belge satırı soyutlaması
      return (
        <g stroke={c} strokeOpacity=".4" fill="none" strokeWidth="1.6">
          <path d={`M16 20 H${pick(h, 1, 68, 86)}`} />
          <path d={`M16 36 H${pick(h, 2, 44, 64)}`} />
          <path d={`M16 52 H${pick(h, 3, 60, 82)}`} />
          <path d={`M16 68 H${pick(h, 4, 36, 56)}`} />
        </g>
      );
    case "dalga": // sektörel — akış dalgaları
      return (
        <g stroke={c} strokeOpacity=".38" fill="none" strokeWidth="1.4">
          <path d={`M-4 ${pick(h, 1, 60, 76)} C 24 ${pick(h, 2, 28, 46)}, 44 ${pick(h, 3, 70, 92)}, 66 ${pick(h, 4, 42, 58)} S 92 ${pick(h, 5, 16, 34)}, 108 ${pick(h, 6, 44, 62)}`} />
          <path d={`M-4 ${pick(h, 7, 78, 94)} C 28 ${pick(h, 8, 48, 64)}, 48 ${pick(h, 9, 88, 104)}, 70 ${pick(h, 10, 58, 74)} S 96 ${pick(h, 11, 36, 52)}, 108 ${pick(h, 12, 62, 80)}`} />
        </g>
      );
    case "molekul": // ilaç & cihaz — molekül halkaları
      return (
        <g stroke={c} strokeOpacity=".45" fill="none" strokeWidth="1.5">
          <circle cx={pick(h, 1, 26, 40)} cy={pick(h, 2, 52, 68)} r={pick(h, 3, 12, 18)} />
          <circle cx={pick(h, 4, 58, 74)} cy={pick(h, 5, 26, 42)} r={pick(h, 6, 16, 24)} />
          <path d={`M${pick(h, 7, 36, 46)} ${pick(h, 8, 46, 56)} L${pick(h, 9, 52, 62)} ${pick(h, 10, 36, 46)}`} />
        </g>
      );
    case "basamak": // kariyer — yükselen basamaklar
      return (
        <g stroke={c} strokeOpacity=".42" fill="none" strokeWidth="1.6">
          <path d={`M12 ${pick(h, 1, 76, 86)} H34 V${pick(h, 2, 56, 66)} H56 V${pick(h, 3, 36, 46)} H78 V${pick(h, 4, 16, 26)} H96`} />
        </g>
      );
    default: // kongre — tarih bloğu çerçevesi
      return (
        <g stroke={c} strokeOpacity=".35" fill="none" strokeWidth="1.5">
          <rect x="20" y="18" width={pick(h, 1, 52, 62)} height={pick(h, 2, 52, 62)} rx="8" />
          <path d={`M20 ${pick(h, 3, 34, 42)} H${20 + pick(h, 1, 52, 62)}`} />
        </g>
      );
  }
}

function familyOf(item: Pick<FeedItem, "module" | "kind">): string {
  if (item.module === "akademik") return "veri";
  if (item.module === "mevzuat") return "belge"; // mevzuat + içtihat + doktrin — tek belge ailesi
  if (item.module === "ilac") return "molekul";
  if (item.module === "kariyer") return "basamak";
  if (item.module === "kongre") return "tarih";
  return "dalga"; // sektörel + bilinmeyen
}

export function CoverArt({
  item,
  size,
}: {
  item: Pick<FeedItem, "id" | "module" | "kind" | "title" | "sourceName">;
  size: "card" | "band";
}) {
  const c = MODULE_COLOR[item.module] ?? "var(--c-ink-3)";
  const h = hashOf(item.id);
  const fam = familyOf(item);
  const stamp = stampOf(item, size === "band" ? 26 : 10);

  if (size === "card") {
    return (
      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl" aria-hidden="true">
        <svg viewBox="0 0 100 100" width="72" height="72" role="presentation">
          <rect width="100" height="100" fill={c} fillOpacity=".1" />
          {pattern(fam, h, c)}
          <text x="10" y="91" fontFamily="ui-monospace,Menlo,monospace" fontSize="10.5" fill={c} fillOpacity=".9" letterSpacing="1">
            {stamp}
          </text>
        </svg>
      </div>
    );
  }

  // band — detay sayfası üst bandı. preserveAspectRatio="none": desen genişliğe yayılır.
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--c-hairline)]" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="block h-[120px] w-full" preserveAspectRatio="none" role="presentation">
        <rect width="100" height="100" fill={c} fillOpacity=".09" />
        {pattern(fam, h, c)}
      </svg>
      <div
        className="aura-mono border-t px-4 py-1.5 text-[10px] font-bold tracking-[0.16em]"
        style={{ color: c, borderColor: "var(--c-hairline)", background: "var(--c-surface)" }}
      >
        {stamp}
      </div>
    </div>
  );
}
