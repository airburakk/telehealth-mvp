import Link from "next/link";
import { Scale, Search, X, ChevronRight } from "lucide-react";
import type { LegalTabKey } from "@/lib/doctorium";
import { HUKUK_KEYWORDS } from "@/lib/hukuk-keywords";

// Hukuk arama kutusu (v6.132) — page.tsx'ten ÇIKARILDI (2026-08-23; landing V2 "Sağlık Hukuku"
// bölümü aynı bileşeni `demo` modunda gösterir; kopya = drift). Sunucu bileşeni: arama düz bir
// GET formu, JavaScript gerektirmez ve sonuç URL'de taşınır (paylaşılabilir, geri tuşu çalışır).
//
// Örnek anahtar kelimeler <details> içinde ve YALNIZ içtihatta: sözlük kararlara göre kurulmuş
// (tazminat, aydınlatılmış onam, komplikasyon…), mevzuat ve doktrinde karşılığı yok. Onlarda
// boş bir açılır bölüm yerine ne aradığını söyleyen tek satır ipucu durur.
//
// ⚠️ İki süzgeç AYRI eksendir: sözlük çipi (?k=) kararın METNİNDE deterministik desen arar;
// arama kutusu (?q=) başlıkta VE metinde serbest arar. Aynı anda kullanılabilirler.
//
// `demo` (landing): anonim ziyaretçi — form ve çipler `demoHref`'e (Doctorium giriş kapısı) gider,
// ipucu "giriş yapınca arar" der. Sahte sonuç üretilmez; örnek sonuçları çağıran gerçek veriden çizer.

/** Hukuk alt-sekmesi başına arama kutusu metinleri — üçü aynı kutuyu paylaşır, dili değişir. */
export const LEGAL_BOX: Record<LegalTabKey, { title: string; placeholder: string; hint: string }> = {
  mevzuat: {
    title: "Mevzuatta ara",
    placeholder: "Tebliğ, yönetmelik adı veya metinde geçen ifade",
    hint: "Resmî Gazete ve OHSAD kayıtlarının başlığında ve özetinde arar.",
  },
  ictihat: {
    title: "İçtihat arşivinde ara",
    placeholder: "Daire, esas no veya karar metninde geçen ifade",
    hint: "Kararın başlığında ve metninde arar; anahtar kelime çipleriyle birlikte kullanılabilir.",
  },
  doktrin: {
    title: "Doktrinde ara",
    placeholder: "Makale başlığı, yazar veya konu",
    hint: "TR-Dizin kayıtlarının başlığında ve dizin özetinde arar.",
  },
};

export function LegalSearchBox({
  tab, query, activeKeyword, demo,
}: {
  tab: LegalTabKey;
  query: string | null;
  activeKeyword: string | null;
  /** Landing demo modu: tüm hedefler giriş kapısına; açık "giriş yapınca arar" ipucu. */
  demo?: { href: string };
}) {
  const t = LEGAL_BOX[tab];
  // Kanonik URL: varsayılan sekme (mevzuat) h parametresi TAŞIMAZ — mevcut link disiplini.
  const base = tab === "mevzuat" ? "/doktor/doctorium?m=mevzuat" : `/doktor/doctorium?m=mevzuat&h=${tab}`;
  const clearHref = demo ? demo.href : activeKeyword ? `${base}&k=${activeKeyword}` : base;
  const action = demo ? demo.href.split("?")[0] : "/doktor/doctorium";
  const demoNext = demo ? new URLSearchParams(demo.href.split("?")[1] ?? "").get("next") : null;

  return (
    <section className="mt-4 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--c-ink)]">
        <Scale size={16} className="text-rose-300" /> {t.title}
      </h2>

      <form action={action} method="get" className="mt-3 flex gap-2">
        {demo ? (
          demoNext && <input type="hidden" name="next" value={demoNext} />
        ) : (
          <>
            <input type="hidden" name="m" value="mevzuat" />
            {tab !== "mevzuat" && <input type="hidden" name="h" value={tab} />}
            {activeKeyword && <input type="hidden" name="k" value={activeKeyword} />}
          </>
        )}
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder={t.placeholder}
          aria-label={t.title}
          className="min-w-0 flex-1 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface-2)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none focus:border-rose-400/50"
        />
        <button
          type="submit"
          // bg-rose-600 + beyaz (4.9:1) — eski rose-500/85 + koyu metin 3.88 AA altıydı (axe, 2026-08-23)
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-500"
        >
          <Search size={15} /> Ara
        </button>
      </form>

      {query && !demo && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--c-ink-2)]">
          <span>
            &ldquo;<strong className="text-[var(--c-ink)]">{query}</strong>&rdquo; için sonuçlar
          </span>
          <Link href={clearHref} className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 hover:underline">
            <X size={11} /> aramayı temizle
          </Link>
        </p>
      )}
      {demo && (
        <p className="mt-2 text-[12px] text-[var(--c-ink-2)]">
          Örnek: &ldquo;<strong className="text-[var(--c-ink)]">{query}</strong>&rdquo; — aşağıdaki sonuçlar gerçek arşivden. Arama, giriş yapınca çalışır.
        </p>
      )}

      {tab === "ictihat" ? (
        <details className="group mt-3" open={!!demo}>
          <summary className="cursor-pointer list-none text-[12px] font-semibold text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
            <span className="inline-flex items-center gap-1.5">
              <ChevronRight size={13} className="transition-transform group-open:rotate-90" />
              Örnek anahtar kelimeler
            </span>
          </summary>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {HUKUK_KEYWORDS.map((kw) => {
              const on = activeKeyword === kw.key;
              const q = query ? `&q=${encodeURIComponent(query)}` : "";
              const href = demo ? demo.href : on ? `${base}${q}` : `${base}&k=${kw.key}${q}`;
              return (
                <Link
                  key={kw.key}
                  href={href}
                  aria-current={on ? "true" : undefined}
                  className={`aura-mono inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    on
                      ? "bg-rose-500/20 text-rose-200 shadow-[inset_0_0_0_1px_#fb7185]"
                      : "bg-rose-500/[0.08] text-rose-300/90 hover:bg-rose-500/15"
                  }`}
                >
                  {kw.label}
                  {on && !demo && <X size={11} />}
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
            Anahtar kelime, kararın <strong>metninde</strong> deterministik olarak aranır; arama
            kutusu ise başlıkta ve metinde serbest arar. İkisi birlikte kullanılabilir.
          </p>
        </details>
      ) : (
        <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--c-ink-3)]">{t.hint}</p>
      )}
    </section>
  );
}
