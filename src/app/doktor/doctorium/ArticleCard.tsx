import Link from "next/link";
// ⚠️ categoryLabel/KIND_LABEL BİLİNÇLİ "@/lib/doctorium-labels"ten (değil "@/lib/doctorium"ten):
// bu kart FeedLoadMore.tsx (client bileşen, sonsuz kaydırma) üzerinden İSTEMCİ paketine de
// giriyor — lib/doctorium.ts `db` (Prisma) içe aktarır, oradan DEĞER import etmek build'i kırar.
// `type FeedItem` type-only olduğu için erimede kaybolur, sorun yok.
import { categoryLabel, KIND_LABEL } from "@/lib/doctorium-labels";
import type { FeedItem } from "@/lib/doctorium";
import { extractExcerpt } from "@/lib/hukuk-keywords";
import { SaveButton } from "./SaveButton";
import { CoverArt, hasThumb } from "./CoverArt";
import { Sparkles } from "lucide-react";

/**
 * Doctorium içerik kartı — SENTEZ düzeni (saha taraması + kullanıcı seçimi, 2026-08-19).
 *
 * 10 ajanlı meslek-akışı taraması (Doximity · UpToDate · QxMD · STAT/JAMA · Lexpera · Bloomberg ·
 * Linear/Carbon · Guardian/FT · Türkiye platformları) dokuz bağımsız yakınsama üretti; kullanıcı
 * bunlardan üç yönü seçti (kaynak künyesi · display tipografi · ağırlık ritmi). Sonuç:
 *
 *   · KÜNYE = kaynağın KİMLİĞİ: plaka + kalın kaynak adı + tarih satırı. Tür ve branş ÇİPLERİ
 *     KALKTI — türü kaynağın kendi adı söyler (PubMed · Resmî Gazete · Yargıtay). Doximity'de
 *     (ABD doktorlarının ~%85'i) tür çipi, branş çipi ve renk şeridi hiç yok; hiyerarşiyi yalnız
 *     ölçü/ağırlık + boşluk taşıyor.
 *   · BAŞLIK = aura-display, AĞIRLIK KADEMELİ (lead 23 / mid 17 / min 15px). Guardian'da 452 kart
 *     ölçüldü: lider ile sıradan kart farkı yalnız 1,65 kat, ama VAR. Anti-örnek CNN Lite: 101
 *     kalem tek ölçü → sakin değil düz liste. Tek tipe inmek monotonluğu KURUMSALLAŞTIRIR.
 *   · ÇİZGİ = yalnız öğeler ARASINDA. Carbon'un kuralı: çizgi nesnelerin arasına konur, içine
 *     değil; Polaris'te kart içi ayraç varsayılan KAPALI. Eski kartın dört çizgi katmanı
 *     (dış kenarlık + 3px şerit + künye altı + aksiyon üstü) BİRE indi.
 *   · KUTU YOK, GÖLGE YOK. Ölçülen 452 Guardian kartının tamamı transparan, radius 0.
 *     Carbon: "Do not add drop shadows to tiles."
 *
 * ⚠️ SÜPERSEDE: 2026-08-16 "künye/gövde/aksiyon üç bölge" düzeni ve 3px MODULE_ACCENT şeridi bu
 * sürümde kalktı (kullanıcı kararı 2026-08-19 — sentez onayı). Modül kimliğinin taşıyıcısı artık
 * KAYNAK ADI. Şeridi geri eklemek isteyen önce o kararı yeniden açmalı.
 *
 * 🔴 "2 dk klinik özet" BAĞLANTISI kalktı: akademik akış ürünlerinin incelemesi bunu "en kötü orta
 * yol" diye adlandırdı (yer kaplıyor, bilgi vermiyor). Özetin varlığı künye satırında mono bir
 * İŞARET olarak duruyor; özetin kendisi detay sayfasında yaşamaya devam ediyor.
 *
 * `saved` null ise Kaydet düğmesi hiç çizilmez (personel/anonim — koşullu-href ilkesi).
 * `weight` varsayılanı "min"dir: Kaydettiklerim gibi ritimsiz listeler eşit ağırlıkta akar.
 */

export type CardWeight = "lead" | "mid" | "min";

/**
 * TÜR ETİKETİ — künyenin ilk öğesi, mono ve RENKLİ METİN (dolgu YOK).
 *
 * ⚠️ Bu, kalkan çipin geri dönüşü DEĞİL. Fark yapısal: çip dolgulu bir yüzeydi (renk yüzey
 * boyuyordu), bu ise künye satırına gömülü düz metin — PubMed'in rozetleri künyenin İÇİNE
 * metin olarak koyma deseni ("Review.", "Free article.").
 *
 * NEDEN GERİ GELDİ (kullanıcı bildirimi 2026-08-19, canlı görünüm): Doximity'nin çipsiz kartı
 * işliyor çünkü onun akışında HER ŞEY AYNI TÜR (haber). Doctorium sekiz türü tek akışta
 * karıştırıyor; tür sinyali olmadan akış "karmaşa" olarak okunuyor. Saha taramasının kuralı
 * "renk yok" değil, "renk HİYERARŞİ taşımaz" idi — tür kimliği taşıması meşru (Bloomberg'de
 * renk = işlev; JAMA/STAT'te kicker = tek eksen).
 *
 * TEK EKSEN: yalnız içerik TÜRÜ. Branş ve kategori burada BASILMAZ — iki eksen aynı anda
 * yarışınca (eski kartın hatası) tarama zorlaşır.
 */
const KIND_COLOR: Record<string, string> = {
  makale: "#34d399",   // akademik
  doktrin: "#a5b4fc",  // hukuk doktrini — akademik hukuk, içtihattan ayrışır
  ictihat: "#fb7185",  // yargı kararı
  mevzuat: "#fbbf24",  // Resmî Gazete
  haber: "#a78bfa",    // sektörel
  ilac: "#22d3ee",     // klinik çalışma
  lansman: "#22d3ee",  // klinik faz
  uyari: "#fb7185",    // geri çekme — aciliyet (renk DESTEKÇİ; asıl sinyal emir kipi başlık + künye no)
  etkinlik: "var(--c-ink-2)",
  kariyer: "#60a5fa",
};

/** Ağırlık kademesi — ölçülmüş dar merdiven (uçtan uca 1,53x). Ağırlıklar 500/600 (700 yok). */
const TITLE_CLASS: Record<CardWeight, string> = {
  lead: "mt-3 text-[23px] font-semibold leading-[1.2] tracking-[-0.02em]",
  mid: "mt-2.5 text-[17px] font-semibold leading-[1.32] tracking-[-0.018em]",
  min: "mt-2 text-[15px] font-medium leading-[1.38] tracking-[-0.014em]",
};

/** Özet yalnız lead ve mid'de; min kademe başlık + künyeden ibarettir (alan sayısı düşer). */
const SUMMARY_MAX: Record<CardWeight, number> = { lead: 210, mid: 130, min: 0 };

export function formatDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Plaka yazısı — kaynak adının kısaltması. Türkçe yerel büyük harf ZORUNLU: varsayılan
 * toUpperCase() "iletişim"i "ILETIŞIM" yapar (i→I), Türkçe'de i→İ olmalı. Bkz. taramanın
 * TMMOB/Medimagazin bulgusu.
 */
export function plateText(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  const abbr = /\(([^)]{2,5})\)/.exec(clean)?.[1];
  if (abbr) return abbr.toLocaleUpperCase("tr-TR").slice(0, 4);
  const words = clean
    .split(" ")
    .filter((w) => w.length > 1 && !/^(the|of|and|for|ve|ile|için|dergisi)$/i.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toLocaleUpperCase("tr-TR");
  return clean.slice(0, 2).toLocaleUpperCase("tr-TR");
}

/**
 * Künye ikinci satırı: tarih + tek bir ayırt edici referans. İçtihatta esas/karar numarası
 * (Türk profesyonelinin taradığı künye sırası: daire → esas → karar → tarih), akademikte DOI.
 * İkisi aynı anda basılmaz — çip enflasyonunun satır-içi hali olurdu.
 */
function metaRef(item: FeedItem): { text: string; mono: boolean } | null {
  if (item.kind === "ictihat") {
    const e = /E\.\s*[\d/]+(?:\s*·?\s*K\.\s*[\d/]+)?/.exec(item.title)?.[0];
    if (e) return { text: e, mono: true };
  }
  if (item.doi) return { text: `doi.org/${item.doi}`, mono: true };
  if (item.category && item.module === "sektorel") {
    const c = categoryLabel(item.category);
    if (c) return { text: c, mono: false };
  }
  return null;
}

/** Kaynak görseli yalnız LEAD kademede. Uluslararası kaynaklarda bilinçli yok (v6.99.5 kararı:
 *  o kaynakların og/RSS görselleri düşük kaliteydi) — detay sayfasındaki aynı allowlist. */
const NO_IMAGE_SOURCES = new Set(["medscape", "medicalxpress", "who"]);

export function ArticleCard({
  item,
  saved,
  weight = "min",
}: {
  item: FeedItem;
  saved: boolean | null;
  weight?: CardWeight;
}) {
  const href =
    item.module === "etkinlik" ? `/doktor/doctorium/etkinlik/${item.id}`
    : item.module === "kariyer" ? `/doktor/doctorium/kariyer/${item.id}`
    : `/doktor/doctorium/${item.id}`;

  const ref = metaRef(item);
  const showImage = weight === "lead" && !!item.imageUrl && !NO_IMAGE_SOURCES.has(item.source);

  // İçtihatta özet yerine KARARIN ALINTISI (Lexpera bulgusu: alıntı başlık işlevi görür ve
  // ham kesme yapılmaz — eşleşen bağlamdan seçilir). Diğerlerinde kaynak özeti.
  const excerpt = item.kind === "ictihat" ? extractExcerpt(item.summary) : null;
  const limit = SUMMARY_MAX[weight];
  const summary =
    excerpt ??
    (limit > 0 && item.summary
      ? item.summary.length > limit
        ? `${item.summary.slice(0, limit - 1).trimEnd()}…`
        : item.summary
      : null);

  return (
    // Kutu YOK: ayrım yalnız öğeler arasındaki saç çizgi (liste ilk öğesinde çizilmez).
    <li className="min-w-0 border-t border-[var(--c-hairline)] py-[17px] first:border-t-0 first:pt-1">
      {/* ── KÜNYE: kaynağın kimliği açar (çip yok) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Akademik + branşlı içerikte branş sembolü (bilgi taşır); kalanında kaynak plakası. */}
          <CoverArt item={item} size="thumb" />
          <PlateFallback item={item} />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold leading-[1.3] text-[var(--c-ink)]">
              {item.sourceName}
            </div>
            <div className="mt-px flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-[var(--c-ink-3)]">
              {/* Tür etiketi künyenin İLK öğesi: göz kaynağı okuduktan sonra "bu ne" sorusunu
                  burada yanıtlar. Mono + renkli METİN; dolgulu çip değil. */}
              <span
                className="aura-mono text-[11px] font-semibold tracking-[0.06em]"
                style={{ color: KIND_COLOR[item.kind] ?? "var(--c-ink-2)" }}
              >
                {(KIND_LABEL[item.kind] ?? item.kind).toLocaleUpperCase("tr-TR")}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatDate(item.publishedAt)}</span>
              {ref && (
                <>
                  <span aria-hidden="true">·</span>
                  {item.doi && item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="aura-mono max-w-full truncate text-[11.5px] text-[var(--c-accent-stronger)] hover:underline"
                    >
                      {ref.text}
                    </a>
                  ) : (
                    <span className={ref.mono ? "aura-mono text-[11.5px]" : ""}>{ref.text}</span>
                  )}
                </>
              )}
              {/* Klinik özet İŞARETİ — rakip bir çağrı değil, bilgi. Özet detay sayfasında. */}
              {item.hasAiSummary && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="aura-mono inline-flex items-center gap-1 text-[11px] text-emerald-300">
                    <Sparkles size={10} aria-hidden="true" /> Klinik özet
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {saved != null && <SaveButton articleId={item.id} initialSaved={saved} />}
      </div>

      {showImage && (
        /* Dış hotlink: next/image görseli SUNUCUMUZDAN geçirir (kopya = telif); detay
           sayfasındaki ham img ile aynı gerekçe. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl!}
          alt=""
          className="mt-3 block h-[180px] w-full rounded-[10px] border border-[var(--c-hairline)] object-cover"
        />
      )}

      {/* ── BAŞLIK: ağırlık kademeli display tipografi */}
      <Link
        href={href}
        className={`aura-display block text-[var(--c-ink)] hover:underline hover:underline-offset-[3px] ${TITLE_CLASS[weight]}`}
      >
        {item.title}
      </Link>

      {item.authors && weight !== "min" && (
        <p className="mt-1 text-[12.5px] text-[var(--c-ink-3)]">{item.authors}</p>
      )}

      {summary && (
        excerpt ? (
          // Karar alıntısı: sol ince çizgiyle işaretlenir (blok alıntı dili), kutu değil.
          <p className="mt-2 border-l-2 border-[var(--c-hairline)] pl-3 text-[14px] leading-relaxed text-[var(--c-ink-2)]">
            {excerpt}
          </p>
        ) : (
          <p
            className={`mt-2 leading-relaxed text-[var(--c-ink-2)] ${
              weight === "lead" ? "text-[14.5px]" : "text-[13.5px]"
            }`}
          >
            {summary}
          </p>
        )
      )}
    </li>
  );
}

/**
 * Kaynak plakası — CoverArt "thumb" yalnız AKADEMİK + ÇÖZÜLEBİLEN branşlı içerikte sembol
 * döndürür (branş ikonu bilgi taşır); kalan tüm kaynaklarda bu plaka devreye girer.
 * Koşul CoverArt'ın kendi `hasThumb` yüklemine bağlıdır — kopya mantık ikisinin de
 * çizilmediği (plakasız künye) sessiz duruma yol açıyordu.
 */
function PlateFallback({ item }: { item: FeedItem }) {
  if (hasThumb(item)) return null;
  return <SourcePlate name={item.sourceName} />;
}

/**
 * Kaynak plakası — Etkinlik ve Kariyer listeleri de aynı künye dilini kullanır
 * (kutuları kalktığında ArticleCard ile aynı gramere geçtiler).
 */
export function SourcePlate({ name }: { name: string }) {
  return (
    <div
      aria-hidden="true"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--c-hairline)] bg-[var(--c-surface-2)] text-[11px] font-bold tracking-[0.02em] text-[var(--c-ink-2)]"
    >
      <span className="aura-display">{plateText(name)}</span>
    </div>
  );
}
