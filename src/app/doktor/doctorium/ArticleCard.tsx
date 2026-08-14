import Link from "next/link";
import { KIND_LABEL, categoryLabel, branchLabel, type FeedItem } from "@/lib/doctorium";
import { branchColor } from "@/lib/branch-visuals";
import { extractKeywords, extractLawRefs, extractExcerpt } from "@/lib/hukuk-keywords";
import { SaveButton } from "./SaveButton";
import {
  ExternalLink, FlaskConical, Gavel, Scale, Library, Pill, Building2, Sparkles,
  CalendarClock, TrendingUp,
} from "lucide-react";

/**
 * Doctorium içerik kartı — STANDART düzen (kullanıcı kararları 2026-08-14, 3. tur; Post-Op
 * kartı [RecoveryList] birebir örnek):
 *   · SOL KAPAK BÖLMESİ YOK — kartın sol kenarında 3px BÖLÜM-RENGİ şeridi (borderInlineStart,
 *     Post-Op'un lane şeridi deseni). Her içerik ait olduğu bölümün rengini alır; akademikte
 *     branş rengi KULLANILMAZ — tüm akademik zümrüt (kullanıcı kararı).
 *   · Üst satır: küçük BÖLÜM SEMBOLÜ başlığın yanında (Post-Op avatar deseni) + bölüm etiketi;
 *     sağda Kaydet. Sembol tür-bazlı (terazi=mevzuat · çekiç=içtihat · kütüphane=doktrin),
 *     renk bölüm-bazlı.
 *   · Altında tür + anahtar kelimeler (Makale/Haber/İçtihat… + kategori + branşlar), başlık,
 *     alt-başlıklar (özgün başlık · yazarlar · kaynak+tarih), içtihat/doktrin meta.
 *   · Altta hairline ÇİZGİ; altında hyperlinkler: 2 dk klinik özet (akademik) · Kaynağı aç.
 *     "Detay" linki KALDIRILDI (başlık zaten detaya götürür).
 *
 * `saved` null ise Kaydet düğmesi hiç çizilmez (personel/anonim — koşullu-href ilkesi).
 */

// Bölüm kimliği: [etiket, renk] — bant (DoctoriumSidebar) ve üst alan (MODULE_HEAD) hex'leriyle birebir.
const MODULE_EYEBROW: Record<string, [string, string]> = {
  akademik: ["AKADEMİK", "#34d399"],
  sektorel: ["SEKTÖREL", "#a78bfa"],
  ilac: ["İLAÇ & CİHAZ", "#22d3ee"],
  mevzuat: ["HUKUK", "#fb7185"],
  kongre: ["KONGRE", "var(--c-ink)"], // beyaz kimlik = tema-duyarlı ink (bant kararıyla aynı)
  kariyer: ["KARİYER", "#60a5fa"],
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

// Bölüm sembolü — tür-bazlı ayrım hukuk ailesinde yaşar (sembol kararı 2026-08-14:
// terazi=mevzuat · çekiç=içtihat · kütüphane=doktrin).
function moduleIcon(item: FeedItem) {
  if (item.kind === "ictihat") return Gavel;
  if (item.kind === "doktrin") return Library;
  if (item.module === "mevzuat") return Scale;
  if (item.module === "ilac") return Pill;
  if (item.module === "sektorel") return Building2;
  if (item.module === "kongre") return CalendarClock;
  if (item.module === "kariyer") return TrendingUp;
  return FlaskConical;
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
            <span key={l} className="aura-mono rounded-full bg-[var(--c-surface-2)] px-2 py-0.5 text-[10px] text-[var(--c-ink-2)]">
              {l}
            </span>
          ))}
          {keywords.map((k) => (
            <Link
              key={k.key}
              href={`/doktor/doctorium?m=mevzuat&h=ictihat&k=${k.key}`}
              className="aura-mono rounded-full bg-rose-500/[0.08] px-2 py-0.5 text-[10px] font-semibold text-rose-300/90 hover:bg-rose-500/15"
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
  const [eyebrow, accent] = MODULE_EYEBROW[item.module] ?? [item.module.toUpperCase(), "var(--c-ink-3)"];
  const Icon = moduleIcon(item);
  // Kongre/kariyer akış kartları kendi detay rotalarına gider (kariyer'de id = slug).
  // Kaydet HEPSİNDE var (2026-08-14, 2. tur — save API + savedFeed üç kaynaklı).
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
  return (
    <li
      className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3.5"
      style={{ borderInlineStart: `3px solid ${accent}` }}
    >
      {/* Üst satır — Post-Op deseni: küçük bölüm sembolü + etiket yan yana · sağda Kaydet */}
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2">
          <Icon size={16} strokeWidth={1.9} style={{ color: accent }} />
          <span className="aura-mono text-[10px] font-bold tracking-[0.16em]" style={{ color: accent }}>
            {eyebrow}
          </span>
        </span>
        {saved != null && <SaveButton articleId={item.id} initialSaved={saved} />}
      </div>

      {/* Tür + diğer anahtar kelimeler */}
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${KIND_STYLE[item.kind] ?? KIND_STYLE.haber}`}>
          {KIND_LABEL[item.kind] ?? item.kind}
        </span>
        {categoryLabel(item.category) && (
          <span className="aura-mono rounded-full bg-[var(--c-surface-2)] px-2 py-0.5 text-[10px] text-[var(--c-ink-2)]">
            {categoryLabel(item.category)}
          </span>
        )}
        {item.branchSlugs.slice(0, 2).map((s) => (
          <span key={s} className="aura-mono rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: branchColor(branchLabel(s)), background: `${branchColor(branchLabel(s))}1f` }}>
            {branchLabel(s)}
          </span>
        ))}
      </div>

      {/* Başlık + alt-başlıklar */}
      <Link href={href} className="mt-1.5 block text-sm font-semibold leading-snug text-[var(--c-ink)] hover:underline">
        {item.title}
      </Link>
      {item.titleOriginal && <p className="mt-0.5 text-[11px] italic text-[var(--c-ink-3)]">{item.titleOriginal}</p>}
      {item.authors && <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">{item.authors}</p>}
      <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">
        {item.sourceName} · {formatDate(item.publishedAt)}
      </p>

      {item.kind === "ictihat" && <IctihatCardMeta summary={item.summary} />}
      {/* Doktrin: dizin özeti · Kongre: tarih/şehir/kapsam satırı · Kariyer: süreç özeti. */}
      {["doktrin", "kongre", "kariyer"].includes(item.kind) && item.summary && (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--c-ink-2)]">
          {item.summary.length > 220 ? `${item.summary.slice(0, 219).trimEnd()}…` : item.summary}
        </p>
      )}

      {/* Çizgi + hyperlink satırı (Post-Op deseni) — HER kartta (2026-08-14, 2. tur). */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--c-hairline)] pt-2.5">
        {item.module === "akademik" && (
          <Link href={href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:underline">
            <Sparkles size={12} /> {item.hasAiSummary ? "Klinik özet" : "2 dk klinik özet"}
          </Link>
        )}
        {detailLabel && (
          <Link href={href} className="text-[11px] font-semibold text-[var(--c-ink-2)] hover:text-[var(--c-ink)] hover:underline">
            {detailLabel}
          </Link>
        )}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer nofollow"
            className="inline-flex max-w-full items-center gap-1 text-[11px] text-[var(--c-accent-stronger)] hover:underline">
            <ExternalLink size={12} className="shrink-0" />
            <span className="aura-mono truncate">{item.doi ? `doi.org/${item.doi}` : "kaynağı aç"}</span>
          </a>
        )}
      </div>
    </li>
  );
}
