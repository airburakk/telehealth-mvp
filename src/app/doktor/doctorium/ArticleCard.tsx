import Link from "next/link";
import { KIND_LABEL, categoryLabel, branchLabel, type FeedItem } from "@/lib/doctorium";
import { branchColor } from "@/lib/branch-visuals";
import { extractKeywords, extractLawRefs, extractExcerpt } from "@/lib/hukuk-keywords";
import { SaveButton } from "./SaveButton";
import { CoverArt } from "./CoverArt";
import { ExternalLink, Sparkles } from "lucide-react";

/**
 * Doctorium içerik kartı — KÜNYE düzeni (Editoryal tur, 2026-08-16; 5. tur kullanıcı kararı:
 * kart görünümü TÜM listelerde TEKTİR — Akışım'daki kart, bölüm sekmesindekiyle birebir aynı.
 * Bölüm etiketi (eyebrow) hiçbir kartta basılmaz; bölüm kimliği 3px kenar şeridi + tür çipi +
 * [akademikte 32px branş sembolü] taşır. 2026-08-14 standart düzeni ile v6.99 sol künye-kapağını
 * SÜPERSEDE eder; 3px bölüm şeridi + hairline aksiyon satırı korunur):
 *
 *   · KÜNYE (kartın tepesi): [akademikte 32px branş sembolü] + anahtar-kelime çipleri; sağda
 *     Kaydet. Alt sınırı, alttaki aksiyon çizgisinin simetriği olan ÜST ÇİZGİDİR — kart üç
 *     bölge okunur: künye / gövde / aksiyonlar.
 *   · Webp semboller kartlarda YOK (satırda tekrar "duvar kağıdı" üretiyordu); sembol yalnız
 *     branş ikonu taşıyan akademik içerikte (bilgi taşır — CoverArt "thumb" branşsızda null).
 *   · ROZET DİYETİ: tür çipi + EN FAZLA 1 bağlam çipi (ilk branş, yoksa kategori). Özgün başlık
 *     dahil kalan meta detay sayfasında (sıkı satır kararı). Mikro tip tabanı 12px.
 *
 * `saved` null ise Kaydet düğmesi hiç çizilmez (personel/anonim — koşullu-href ilkesi).
 */

// Bölüm kimliği → 3px kenar şeridinin rengi — bant (DoctoriumSidebar) ve üst alan (MODULE_HEAD)
// hex'leriyle birebir. (Etiket metinleri 5. turda kalktı; renk, şeritte yaşamaya devam eder.)
const MODULE_ACCENT: Record<string, string> = {
  akademik: "#34d399",
  sektorel: "#a78bfa",
  ilac: "#22d3ee",
  mevzuat: "#fb7185",
  kongre: "var(--c-ink)", // beyaz kimlik = tema-duyarlı ink (bant kararıyla aynı)
  kariyer: "#60a5fa",
};

export const KIND_STYLE: Record<string, string> = {
  makale: "bg-violet-500/15 text-violet-300",
  ilac: "bg-emerald-500/15 text-emerald-300",
  mevzuat: "bg-amber-500/15 text-amber-300",
  haber: "bg-sky-500/15 text-sky-300",
  ictihat: "bg-rose-500/15 text-rose-300", // v6.86 — mevzuat amber'ından ayrışsın (aynı modülde yaşarlar)
  doktrin: "bg-indigo-500/15 text-indigo-300", // v6.91 — akademik hukuk makalesi (TR-Dizin)
  kongre: "bg-[var(--c-surface-2)] text-[var(--c-ink-2)]", // 2026-08-14 — akış kartı
  kariyer: "bg-blue-500/15 text-blue-300", // 2026-08-14 — akış kartı
};

export function formatDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// İçtihat kartının anahtar-kelime bölgesi: alıntı + kanun maddeleri + terim çipleri.
// Tamamı item.summary'den render anında türetilir — ek kolon/sorgu yok (arşiv küçük; string
// taraması ucuz. Hacim büyürse ingest'te kolona alınır — bilinçli erteleme).
function IctihatCardMeta({ summary }: { summary: string }) {
  const excerpt = extractExcerpt(summary);
  const laws = extractLawRefs(summary);
  const keywords = extractKeywords(summary);
  if (!excerpt && !laws.length && !keywords.length) return null;
  return (
    <div className="mt-1.5">
      {excerpt && <p className="text-xs leading-relaxed text-[var(--c-ink-2)]">{excerpt}</p>}
      {(laws.length > 0 || keywords.length > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {laws.map((l) => (
            <span key={l} className="aura-mono rounded-full bg-[var(--c-surface-2)] px-2 py-0.5 text-[11px] text-[var(--c-ink-2)]">
              {l}
            </span>
          ))}
          {keywords.map((k) => (
            <Link
              key={k.key}
              href={`/doktor/doctorium?m=mevzuat&h=ictihat&k=${k.key}`}
              className="aura-mono rounded-full bg-rose-500/[0.08] px-2 py-0.5 text-[11px] font-semibold text-rose-300/90 hover:bg-rose-500/15"
            >
              {k.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ArticleCard({ item, saved }: { item: FeedItem; saved: boolean | null }) {
  const accent = MODULE_ACCENT[item.module] ?? "var(--c-ink-3)";
  // Kongre/kariyer akış kartları kendi detay rotalarına gider (kariyer'de id = slug).
  const href =
    item.module === "kongre" ? `/doktor/doctorium/kongre/${item.id}`
    : item.module === "kariyer" ? `/doktor/doctorium/kariyer/${item.id}`
    : `/doktor/doctorium/${item.id}`;
  // Çizgi-altı detay linki tür-uygun etiketle ("Detay" jeneriği bilinçli yok); akademikte bu
  // işlevi "2 dk klinik özet" görür.
  const detailLabel =
    item.module === "akademik" ? null
    : item.kind === "ictihat" ? "Kararı oku →"
    : item.module === "kongre" ? "Kongre kartı →"
    : item.module === "kariyer" ? "Süreç adımları →"
    : "Devamını oku →";
  // ROZET DİYETİ: tür + tek bağlam. Branş varsa branş (kişisel akışın anlamlı ekseni),
  // yoksa kategori. Diğer branşlar/kategori detay sayfasında yaşar.
  const ctxBranch = item.branchSlugs[0] ?? null;
  const ctxCategory = !ctxBranch ? categoryLabel(item.category) : null;

  return (
    <li
      className="min-w-0 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-2.5"
      style={{ borderInlineStart: `3px solid ${accent}` }}
    >
      {/* ── KÜNYE */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <CoverArt item={item} size="thumb" />
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_STYLE[item.kind] ?? KIND_STYLE.haber}`}>
              {KIND_LABEL[item.kind] ?? item.kind}
            </span>
            {ctxBranch && (
              <span className="aura-mono rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ color: branchColor(branchLabel(ctxBranch)), background: `${branchColor(branchLabel(ctxBranch))}1f` }}>
                {branchLabel(ctxBranch)}
              </span>
            )}
            {ctxCategory && (
              <span className="aura-mono rounded-full bg-[var(--c-surface-2)] px-2 py-0.5 text-[11px] text-[var(--c-ink-2)]">
                {ctxCategory}
              </span>
            )}
          </div>
        </div>
        {saved != null && <SaveButton articleId={item.id} initialSaved={saved} />}
      </div>
      <div className="mt-2 border-b border-[var(--c-hairline)]" aria-hidden="true" />

      {/* ── GÖVDE (sıkı ritim — özgün başlık detay sayfasında yaşar) */}
      <Link href={href} className="mt-2 block text-[15px] font-semibold leading-snug text-[var(--c-ink)] hover:underline">
        {item.title}
      </Link>
      {item.authors && <p className="mt-0.5 text-xs text-[var(--c-ink-3)]">{item.authors}</p>}
      <p className="mt-0.5 text-xs text-[var(--c-ink-3)]">
        {item.sourceName} · {formatDate(item.publishedAt)}
      </p>

      {item.kind === "ictihat" && <IctihatCardMeta summary={item.summary} />}
      {/* Doktrin: dizin özeti · Kongre: tarih/şehir/kapsam satırı · Kariyer: süreç özeti. */}
      {["doktrin", "kongre", "kariyer"].includes(item.kind) && item.summary && (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--c-ink-2)]">
          {item.summary.length > 160 ? `${item.summary.slice(0, 159).trimEnd()}…` : item.summary}
        </p>
      )}

      {/* ── AKSİYONLAR (Post-Op deseni — hairline + hyperlinkler) */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--c-hairline)] pt-2">
        {item.module === "akademik" && (
          <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:underline">
            <Sparkles size={12} /> {item.hasAiSummary ? "Klinik özet" : "2 dk klinik özet"}
          </Link>
        )}
        {detailLabel && (
          <Link href={href} className="text-xs font-semibold text-[var(--c-ink-2)] hover:text-[var(--c-ink)] hover:underline">
            {detailLabel}
          </Link>
        )}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer nofollow"
            className="inline-flex min-w-0 max-w-full items-center gap-1 text-xs text-[var(--c-accent-stronger)] hover:underline">
            <ExternalLink size={12} className="shrink-0" />
            <span className="aura-mono truncate">{item.doi ? `doi.org/${item.doi}` : "kaynağı aç"}</span>
          </a>
        )}
      </div>
    </li>
  );
}
