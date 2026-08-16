import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuraMark } from "@/components/PortamedLogo";

// /doctorium tanıtım landing'i (kullanıcı kararı 2026-08-16) — giriş yapmamış hekime/öğrenciye
// Doctorium'u anlatır. Fikir kaynağı kullanıcının Codex taslağı; kit hizası bizde: aura-display/
// aura-mono fontları (Space Grotesk EKLENMEDİ), gerçek AuraMark zümrüt sembol, iddia disiplini
// (ölçülmemiş "iki dakika" iddiası ATILDI; "AI özeti işaretli" kanıtı doctorium/[id] sayfasındaki
// yapay-zekâ uyarı kutusudur; puan≠nakit v6.88 dili; öğrenci kısıtları v6.95 dili).
// ALMAŞIK koyu/açık bölüm ritmi (kullanıcı kararı 2026-08-16, 5. tur — AURA vitrini deseni:
// çift-koyu açılış [hero+güven] → olanaklar A → hukuk K → puanlar A → öğrenci K → final A →
// footer K); tema toggle'ına bağlanmaz, açık bölümler style={LIGHT} ile bölüm-bazlı (landing
// sözleşmesi — kendi üst barı + footer; global krom Header.tsx listesiyle gizli). Tamamen server
// component: etkileşim yok, animasyon saf CSS (globals.css .doctorium-prism-*). Tek dil TR.

// Codex taslağının paleti; CoverArt plaka koyusu (#0d0e10) zemin olarak korunur.
// --dl-body: bölüm gövde grisi — açık/koyu almaşıkta (aşağıda LIGHT) yeniden bağlanır,
// bu yüzden gövde metinleri sabit hex DEĞİL bu değişkeni kullanır.
const PALETTE = {
  "--dl-bg": "#0d0e10",
  "--dl-panel": "#161719",
  "--dl-ink": "#f4f5f3",
  "--dl-muted": "#9da1a6",
  "--dl-body": "#aeb2b6",
  "--dl-line": "rgba(255,255,255,.12)",
  "--dl-emerald": "#34d399",
  "--dl-rose": "#fb7185",
  "--dl-amber": "#c6a664",
  // AURA marka turkuazı — PortamedLogo TONES.brand.main ile aynı ton ("by AURA" imzası).
  "--dl-cyan": "#28C8D8",
} as CSSProperties;

// AÇIK bölüm seti (kullanıcı kararı 2026-08-16, 5. tur: "aura gibi bir bölüm siyah bir bölüm
// beyaz"). Değerler vitrinin .aura-light rol token'larından birebir (globals.css): beyaz zemin ·
// stone-900 ink · stone-600/500 gövde/mikro · stone-50 panel · %10 siyah hairline. Zümrüt metin
// karşılığı #047857 = .doctorium-ium'un gündüz değeri (beyazda AA). Açık bölüme style={LIGHT}
// vermek yeterli — içerik var(--dl-*) kullandığından otomatik uyar. Ritim AURA vitriniyle aynı:
// çift-koyu açılış (hero + güven bandı) → olanaklar A → hukuk K → puanlar A → öğrenci K →
// final A → footer K. CTA dolgu butonları temadan BAĞIMSIZ sabit marka zümrüdü (aşağıda).
const LIGHT = {
  "--dl-bg": "#ffffff",
  "--dl-panel": "#f7f8f5",
  "--dl-ink": "#171a18",
  "--dl-muted": "#6b6660",
  "--dl-body": "#57534e",
  "--dl-line": "rgba(0,0,0,.1)",
  "--dl-emerald": "#047857",
  "--dl-amber": "#8a6a26",
  "--dl-cyan": "#0d6470",
} as CSSProperties;

const FEATURES = [
  {
    no: "01",
    title: "Akademik",
    lead: "Hakemli yayınları branşınıza göre izleyin.",
    body: "Kısa klinik özeti okuyun; gerektiğinde tek tıkla özgün makaleye gidin.",
  },
  {
    no: "02",
    title: "Sektörel gündem",
    lead: "Mesleğinizi etkileyen gelişmeleri kaçırmayın.",
    body: "Doktor hakları, yönetim, teknoloji ve küresel sağlık gündemi düzenli bir akışta.",
  },
  {
    no: "03",
    title: "Kongre ve kariyer",
    lead: "Bildiri ve erken kayıt tarihlerini görün.",
    body: "Kongre takvimi, yurt dışı denklik ve akademik yükselme süreçleri — ilan değil, süreç bilgisi.",
  },
  {
    no: "04",
    title: "İlaç ve cihaz",
    lead: "Ruhsat, geri çekme ve klinik fazlar tek yerde.",
    body: "Prospektüs bilgisine arama ile ulaşın; bölgesel geçerlilik notları görünür kalır.",
  },
];

const TRUST = [
  { title: "Kaynağa bağlı bilgi", body: "Özetin ardından özgün yayına geçin." },
  { title: "Branşa göre akış", body: "Akışınız seçtiğiniz branşlara göre kurulur." },
  { title: "Kaydet ve geri dön", body: "Kişisel mesleki arşiviniz." },
  { title: "AI özeti açıkça işaretli", body: "Özet, kaynağın yerini almaz." },
];

// Mono mikro etiket — landing'in durak dili. caps=false: "Doctorium" geçen etiketlerde
// marka yazımı korunur (kullanıcı kuralı 2026-08-16: D büyük kalanlar küçük, UPPERCASE yok).
function Eyebrow({ children, color = "var(--dl-emerald)", caps = true }: { children: React.ReactNode; color?: string; caps?: boolean }) {
  return (
    <div className={`aura-mono text-[11px] font-semibold ${caps ? "uppercase tracking-[0.2em]" : "tracking-[0.14em]"}`} style={{ color }}>
      {children}
    </div>
  );
}

function DoctoriumWord({ className = "" }: { className?: string }) {
  return (
    <span className={`aura-display font-medium tracking-tight text-[var(--dl-ink)] ${className}`}>
      Doctor<span className="text-[var(--dl-emerald)]">ium</span>
    </span>
  );
}

// Metin içi marka lockup'ı (kullanıcı kuralı 2026-08-16): "Doctorium" geçen her metinde
// Doctor beyaz(ink) + ium zümrüt. İSTİSNA: zümrüt zeminli CTA butonları — orada iki tonlu
// lockup okunmaz (zemin=ium rengi), buton metni tek ton koyu kalır.
function DoctoriumInline() {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[var(--dl-ink)]">Doctor</span>
      <span className="text-[var(--dl-emerald)]">ium</span>
    </span>
  );
}

// "by AURA" imzası (kullanıcı kararı 2026-08-16, 4. tur): "by" düz metin (link DEĞİL); AURA,
// sitenin GERÇEK wordmark PNG'sidir (PortamedLogo ile aynı varlıklar) ve yalnız O tıklanabilir →
// AURA vitrin ana sayfası (/). `light`: açık bölümde lacivert wordmark varyantı (beyaz PNG
// beyaz zeminde görünmez — PortamedLogo'nun logo-word-light/dark ayrımının bölüm karşılığı).
// Yükseklik em-tabanlı: eyebrow/üst bar/footer hangi puntoda kullanırsa oraya ölçeklenir.
function ByAura({ light = false }: { light?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[var(--dl-ink)]">by</span>{" "}
      <Link
        href="/"
        className="inline-block transition-opacity duration-200 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-cyan)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={light ? "/aura-word-light.png" : "/aura-word-dark.png"}
          alt="AURA"
          className="inline-block h-[0.95em] w-auto align-[-0.12em]"
        />
      </Link>
    </span>
  );
}

export function DoctoriumLanding() {
  return (
    <div lang="tr" style={PALETTE} className="min-h-dvh bg-[var(--dl-bg)] text-[var(--dl-ink)]">
      {/* ── Üst bar ── */}
      <header className="sticky top-0 z-20 border-b border-[var(--dl-line)] bg-[color-mix(in_srgb,var(--dl-bg)_86%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-[72px] w-full max-w-6xl items-center gap-6 px-5">
          <div className="flex items-center gap-2.5">
            <AuraMark size={30} tone="emerald" />
            <DoctoriumWord className="text-[22px]" />
            <span className="aura-mono mt-1 hidden text-[10px] sm:inline">
              <ByAura />
            </span>
          </div>
          <nav aria-label="Bölümler" className="ml-auto hidden items-center gap-6 text-sm text-[#c7c9cc] md:flex">
            <a href="#olanaklar" className="transition-colors hover:text-[var(--dl-ink)]">Olanaklar</a>
            <a href="#hukuk" className="transition-colors hover:text-[var(--dl-ink)]">Hukuk</a>
            <a href="#puanlar" className="transition-colors hover:text-[var(--dl-ink)]">Puanlar</a>
            <a href="#ogrenci" className="transition-colors hover:text-[var(--dl-ink)]">Tıp öğrencileri</a>
          </nav>
          <div className="ml-auto flex items-center gap-2.5 md:ml-0">
            <Link
              href="/kurumsal-giris"
              className="hidden min-h-[44px] items-center rounded-xl border border-[var(--dl-line)] px-4 text-sm font-semibold transition-colors hover:border-[var(--dl-emerald)]/55 sm:inline-flex"
            >
              Giriş yap
            </Link>
            <Link
              href="/kayit"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#34d399] px-4 text-sm font-semibold text-[#04342c] transition-colors hover:bg-[#5fe3b0]"
            >
              Doctorium&apos;a katıl
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-40 top-24 h-[480px] w-[480px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(52,211,153,.09), transparent 68%)" }}
          />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:pb-24 lg:pt-24">
            <div>
              <Eyebrow caps={false}><DoctoriumInline /> <ByAura /></Eyebrow>
              <h1 className="aura-display mt-5 max-w-[820px] text-[clamp(44px,5.6vw,72px)] font-medium leading-[1.02] tracking-tight">
                <span className="block">Hekimin</span>
                {/* Prizma: üç sıfat sırayla döner; ekran okuyucuya tek cümle (aria-label),
                    yüzler dekoratif. Reduced-motion'da ilk yüz sabit (globals.css). */}
                <span className="doctorium-prism-shell" role="img" aria-label="Yeni, profesyonel ve kişiselleştirilmiş">
                  <span className="doctorium-prism" aria-hidden>
                    <span className="doctorium-prism-face">Yeni</span>
                    <span className="doctorium-prism-face">Profesyonel</span>
                    <span className="doctorium-prism-face">Kişiselleştirilmiş</span>
                  </span>
                </span>
                <span className="block">Çalışma Alanı.</span>
              </h1>
              <p className="mt-6 max-w-[620px] text-[19px] leading-relaxed text-[#b9bdc1]">
                Branşınızdaki hakemli yayınları kısa klinik özetlerle takip edin; sektörel gündemi,
                hukuku, kongreleri ve kariyer yollarını tek yerde yönetin.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/kayit"
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#34d399] px-6 text-base font-semibold text-[#04342c] transition-colors hover:bg-[#5fe3b0]"
                >
                  Doctorium&apos;a katıl
                  <ArrowRight aria-hidden size={17} />
                </Link>
                <a
                  href="#olanaklar"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--dl-line)] px-6 text-base font-semibold transition-colors hover:border-[var(--dl-emerald)]/55"
                >
                  Neler sunuyor?
                </a>
              </div>
              <p className="mt-5 text-xs text-[#777c82]">
                Doğrulanmış hekim ve tıp öğrencisi üyeliği — belge incelemesiyle.
              </p>
            </div>

            {/* Ürün önizleme kartı — temsili görünüm; uydurma metrik YOK, mono etiket açıkça söyler. */}
            <div
              aria-label="Doctorium akış örnek görünümü"
              className="rounded-3xl border border-[var(--dl-line)] bg-[#111315] p-5 shadow-[0_40px_100px_rgba(0,0,0,.35)] lg:rotate-1"
            >
              <div className="flex items-center justify-between px-1 pb-4">
                <div className="flex items-center gap-2">
                  <AuraMark size={20} tone="emerald" />
                  <DoctoriumWord className="text-[17px]" />
                </div>
                <span className="aura-mono rounded-lg border border-[var(--dl-line)] px-2.5 py-1.5 text-[9px] uppercase tracking-[0.14em] text-[var(--dl-muted)]">
                  Örnek görünüm
                </span>
              </div>
              <div className="flex gap-5 border-b border-[var(--dl-line)] px-1 text-xs">
                <span className="border-b-2 border-[var(--dl-emerald)] pb-2.5 text-[var(--dl-ink)]">Akışım</span>
                <span className="pb-2.5 text-[#81868c]">Akademik</span>
                <span className="pb-2.5 text-[#81868c]">Sektörel</span>
                <span className="pb-2.5 text-[#81868c]">Hukuk</span>
              </div>
              <div className="px-1 pb-2 pt-5">
                <Eyebrow>Akışım</Eyebrow>
                <div className="aura-display mt-1 text-xl font-medium tracking-tight">Sizin için seçilenler</div>
              </div>
              <article className="mt-2 rounded-xl border border-[var(--dl-line)] border-l-[3px] border-l-[var(--dl-emerald)] bg-[var(--dl-panel)] p-4">
                <div className="aura-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--dl-emerald)]">
                  Akademik
                </div>
                <h3 className="mt-1.5 text-sm font-medium leading-snug">
                  Branşınızdan güncel bir hakemli yayın
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[#9ca1a6]">
                  Kısa klinik özet; kaynak ve yayın tarihi kartın üzerinde, özgün makale bir tık ötede.
                </p>
                <div className="mt-3 flex justify-between text-[9px] text-[#737980]">
                  <span>Hakemli kaynak</span>
                  <span className="font-semibold text-[var(--dl-emerald)]">Özeti oku →</span>
                </div>
              </article>
              <article className="mt-2.5 rounded-xl border border-[var(--dl-line)] border-l-[3px] border-l-[#a78bfa] bg-[var(--dl-panel)] p-4">
                <div className="aura-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#a78bfa]">
                  Sektörel
                </div>
                <h3 className="mt-1.5 text-sm font-medium leading-snug">
                  Sağlık hizmetlerinde yeni düzenlemeler
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[#9ca1a6]">
                  Mesleki pratiğinizi etkileyebilecek gelişmeler, kaynağı ve yayın tarihiyle birlikte.
                </p>
                <div className="mt-3 flex justify-between text-[9px] text-[#737980]">
                  <span>Kaynak bağlantılı</span>
                  <span className="font-semibold text-[var(--dl-emerald)]">İncele →</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ── Güven bandı ── */}
        <section className="border-y border-[var(--dl-line)]">
          <div className="mx-auto grid w-full max-w-6xl gap-px px-5 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((tr) => (
              <div key={tr.title} className="py-6 pr-6 lg:border-l lg:border-[var(--dl-line)] lg:pl-6 lg:first:border-0 lg:first:pl-0">
                <div className="aura-display text-[15px] font-medium">{tr.title}</div>
                <div className="mt-1 text-xs text-[var(--dl-muted)]">{tr.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Olanaklar — AÇIK bölüm (almaşık ritim) ── */}
        <section id="olanaklar" style={LIGHT} className="scroll-mt-20 bg-[var(--dl-bg)] text-[var(--dl-ink)]">
          <div className="mx-auto w-full max-w-6xl px-5 py-24">
            <div className="mb-14 grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
              <div>
                <Eyebrow>Tek çalışma alanı</Eyebrow>
                <h2 className="aura-display mt-3 text-[clamp(32px,4.6vw,54px)] font-medium leading-[1.04] tracking-tight">
                  Mesleğinizin farklı gündemleri, tek akışta.
                </h2>
              </div>
              <p className="max-w-[640px] self-end text-[17px] leading-relaxed text-[var(--dl-body)]">
                <DoctoriumInline /> yalnızca haber sunmaz; hekimin bilgiye ulaşma, gündemi izleme ve
                mesleki gelişimini planlama yükünü hafifletmek için düzenlenmiştir.
              </p>
            </div>
            <div className="border-t border-[var(--dl-line)]">
              {FEATURES.map((f) => (
                <article key={f.no} className="grid gap-4 border-b border-[var(--dl-line)] py-8 md:grid-cols-[80px_1fr_1fr] md:gap-9">
                  <span className="aura-mono text-[11px] font-semibold text-[var(--dl-emerald)]">{f.no}</span>
                  <h3 className="aura-display text-2xl font-medium tracking-tight">{f.title}</h3>
                  <p className="text-[15px] leading-relaxed text-[var(--dl-body)]">
                    <strong className="font-semibold text-[var(--dl-ink)]">{f.lead}</strong> {f.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Hukuk ── */}
        <section id="hukuk" className="scroll-mt-20 bg-[#101113]">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 py-24 lg:grid-cols-2">
            <div>
              <Eyebrow caps={false}><DoctoriumInline /> Hukuk</Eyebrow>
              <h2 className="aura-display mt-3 text-[clamp(32px,4.6vw,54px)] font-medium leading-[1.04] tracking-tight">
                Hekimlik pratiğinin hukuki hafızası.
              </h2>
              <p className="mt-5 text-[17px] leading-relaxed text-[#aeb2b6]">
                Mevzuat değişikliklerini, emsal kararları ve hakemli doktrini aynı çalışma alanında
                izleyin. İçerikler bilgilendirme amacı taşır; hukuki görüş yerine geçmez.
              </p>
              <ul className="mt-7 divide-y divide-[var(--dl-line)] border-y border-[var(--dl-line)]">
                {["Sağlık mevzuatı ve değişiklikleri", "Malpraktis ve hekim sorumluluğu içtihatları", "Hakemli sağlık hukuku makaleleri"].map((li) => (
                  <li key={li} className="flex gap-3 py-3 text-[15px] text-[#c7c9cc]">
                    <span aria-hidden className="text-[var(--dl-emerald)]">—</span>
                    {li}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-[var(--dl-line)] bg-[var(--dl-panel)] p-7">
              <div className="mb-6 flex items-center justify-between">
                <span className="aura-display text-xl font-medium">Hukuk</span>
                <Eyebrow color="#fda4af">Kaynaklı arşiv</Eyebrow>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <span className="rounded-lg border border-[var(--dl-rose)]/35 bg-[var(--dl-rose)]/[.06] px-2 py-2.5 text-[#fda4af]">Mevzuat</span>
                <span className="rounded-lg border border-[var(--dl-line)] px-2 py-2.5 text-[#c7c9cc]">İçtihat</span>
                <span className="rounded-lg border border-[var(--dl-line)] px-2 py-2.5 text-[#c7c9cc]">Doktrin</span>
              </div>
              <div className="mt-4 border-l-[3px] border-[var(--dl-rose)] bg-[#131416] p-4">
                <div className="aura-mono text-[9px] uppercase tracking-[0.14em] text-[#fda4af]">Mevzuat güncellemesi</div>
                <h3 className="mt-1.5 text-[15px] font-medium">Sağlık hizmetleri uygulamasındaki son değişiklikler</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[#9ca1a6]">
                  Yayın tarihi, kaynak bağlantısı ve hekime etkisini anlatan kısa özetle.
                </p>
              </div>
              <div className="mt-3 border-l-[3px] border-[var(--dl-rose)] bg-[#131416] p-4">
                <div className="aura-mono text-[9px] uppercase tracking-[0.14em] text-[#fda4af]">İçtihat</div>
                <h3 className="mt-1.5 text-[15px] font-medium">Hekim sorumluluğuna ilişkin karar arşivi</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[#9ca1a6]">
                  Esas ve karar bilgileriyle doğrulanabilir kaynak görünümü.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Katılım ve puanlar — AÇIK bölüm (almaşık ritim) ── */}
        <section id="puanlar" style={LIGHT} className="scroll-mt-20 bg-[var(--dl-bg)] text-[var(--dl-ink)]">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 py-24 lg:grid-cols-2">
            <div className="order-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:order-1">
              {[
                { k: "Anket", t: "Görüşünüz değer üretir.", b: "Topluluk veya sponsorlu araştırmalara isteğe bağlı katılım." },
                { k: "Puanlarım", t: "Katılımınızı biriktirin.", b: "Puan hareketlerinizi ve taleplerinizi şeffaf biçimde izleyin.", amber: true },
                { k: "Kongre", t: "Mesleki gelişim", b: "Uygun katalog kalemleri insan onaylı talep sürecinden geçer." },
                { k: "Kitap ve yayın", t: "Mesleki ürünler", b: "Katalog açıldıkça mevcut seçenekler burada görünür." },
              ].map((r) => (
                <article
                  key={r.k}
                  className={`flex min-h-[170px] flex-col rounded-2xl border bg-[var(--dl-panel)] p-5 ${r.amber ? "border-[var(--dl-amber)]/30" : "border-[var(--dl-line)]"}`}
                >
                  <span className="aura-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dl-amber)]">{r.k}</span>
                  <h3 className="aura-display mb-1 mt-auto text-xl font-medium tracking-tight">{r.t}</h3>
                  <p className="text-xs leading-relaxed text-[var(--dl-muted)]">{r.b}</p>
                </article>
              ))}
            </div>
            <div className="order-1 lg:order-2">
              <Eyebrow color="var(--dl-amber)">Katılım ve ödüller</Eyebrow>
              <h2 className="aura-display mt-3 text-[clamp(32px,4.6vw,54px)] font-medium leading-[1.04] tracking-tight">
                Bilgiye katkınız görünür olsun.
              </h2>
              <p className="mt-5 text-[17px] leading-relaxed text-[var(--dl-body)]">
                Anketlere katılın, puan hareketlerinizi görün ve açık katalogdaki mesleki faydalar
                için talep oluşturun.
              </p>
              <p className="mt-6 border-l-2 border-[var(--dl-amber)] pl-4 text-xs leading-relaxed text-[var(--dl-muted)]">
                Puanlar nakit değildir ve parasal değer taşımaz. Ödül kataloğu, geçerli koşullar ve
                uygunluk değerlendirmeleri çerçevesinde sunulur.
              </p>
            </div>
          </div>
        </section>

        {/* ── Tıp öğrencileri — koyu bant; kutu bantta dikey ORTALI (py-24 simetrik,
            kullanıcı düzeltmesi 2026-08-16: üste yapışıktı) ── */}
        <section id="ogrenci" className="scroll-mt-20">
          <div className="mx-auto w-full max-w-6xl px-5 py-24">
            <div
              className="grid items-end gap-10 rounded-3xl border border-[var(--dl-line)] p-8 sm:p-12 lg:grid-cols-[1.25fr_.75fr]"
              style={{ background: "linear-gradient(120deg, rgba(52,211,153,.08), transparent 55%)" }}
            >
              <div>
                <Eyebrow>Geleceğin hekimleri</Eyebrow>
                <h2 className="aura-display mt-3 text-[clamp(28px,3.6vw,42px)] font-medium leading-[1.06] tracking-tight">
                  Tıp öğrencileri için erken mesleki keşif.
                </h2>
                <p className="mt-4 leading-relaxed text-[#aeb2b6]">
                  Akademik yayınları, kongreleri, hukuk ve kariyer kaynaklarını öğrencilik döneminde
                  takip edin. Öğrenci üyeliğinde sponsorlu içerik, anket ve ödül özellikleri kapalıdır.
                </p>
              </div>
              <div className="lg:text-right">
                <Link
                  href="/ogrenci"
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[var(--dl-line)] px-6 text-base font-semibold transition-colors hover:border-[var(--dl-emerald)]/55"
                >
                  Öğrenci üyeliğini incele
                  <ArrowRight aria-hidden size={17} />
                </Link>
                <p className="mt-3 text-xs text-[#777c82]">Öğrenci belgesiyle doğrulama gerekir.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA — AÇIK bölüm (almaşık kapanış; footer koyu) ── */}
        <section style={LIGHT} className="bg-[var(--dl-bg)] py-24 text-center text-[var(--dl-ink)]">
          <div className="mx-auto w-full max-w-6xl px-5">
            <Eyebrow caps={false}><DoctoriumInline /> <ByAura light /></Eyebrow>
            <h2 className="aura-display mx-auto mt-4 max-w-[850px] text-[clamp(36px,5.4vw,64px)] font-medium leading-[1.02] tracking-tight">
              Mesleki gündeminizi tek yerde toplayın.
            </h2>
            <p className="mx-auto mt-5 max-w-[620px] leading-relaxed text-[var(--dl-body)]">
              Bilimsel bilgi, sektörel gelişmeler, hukuk, kariyer ve kongre takibi için{" "}
              <DoctoriumInline /> çalışma alanına katılın.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/kayit"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#34d399] px-6 text-base font-semibold text-[#04342c] transition-colors hover:bg-[#5fe3b0]"
              >
                Hekim üyeliğine başla
                <ArrowRight aria-hidden size={17} />
              </Link>
              <Link
                href="/ogrenci"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--dl-line)] px-6 text-base font-semibold transition-colors hover:border-[var(--dl-emerald)]/55"
              >
                Tıp öğrencisiyim
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--dl-line)] py-9">
        <div className="mx-auto flex w-full max-w-6xl flex-col justify-between gap-4 px-5 text-xs text-[#777c82] sm:flex-row">
          <span>
            © 2026 <DoctoriumInline /> <ByAura />
          </span>
          <div className="flex flex-wrap gap-6">
            <Link href="/guven-ve-gizlilik" className="transition-colors hover:text-[var(--dl-ink)]">
              Güven ve Gizlilik
            </Link>
            <Link href="/" className="transition-colors hover:text-[var(--dl-ink)]">
              AURA&apos;ya git ↗
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
