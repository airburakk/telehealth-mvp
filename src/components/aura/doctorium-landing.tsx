import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuraMark, DoctoriumBraille } from "@/components/AuraLogo";
import { DoctoriumBgVideo } from "@/components/aura/doctorium-bg-video";

// /doctorium tanıtım landing'i (kullanıcı kararı 2026-08-16) — giriş yapmamış hekime/öğrenciye
// Doctorium'u anlatır. Fikir kaynağı kullanıcının Codex taslağı; kit hizası bizde: aura-display/
// aura-mono fontları (Space Grotesk EKLENMEDİ), gerçek AuraMark zümrüt sembol, iddia disiplini
// (ölçülmemiş "iki dakika" iddiası ATILDI; "AI özeti işaretli" kanıtı doctorium/[id] sayfasındaki
// yapay-zekâ uyarı kutusudur; puan≠nakit v6.88 dili; öğrenci kısıtları v6.95 dili).
// ALMAŞIK koyu/açık bölüm ritmi (kullanıcı kararı 2026-08-16, 5. tur — AURA vitrini deseni:
// çift-koyu açılış [hero+güven] → olanaklar A → hukuk K → puanlar A → öğrenci K → final A →
// footer K); tema toggle'ına bağlanmaz, açık bölümler style={LIGHT} ile bölüm-bazlı (landing
// sözleşmesi — kendi üst barı + footer; global krom Header.tsx listesiyle gizli). Server
// component; tek client çocuğu DoctoriumBgVideo (arka plan video DENEMESİ, 2026-08-16 —
// hero + olanaklar bölümlerinde, kullanıcı görsel kararı bekliyor). Animasyon saf CSS
// (globals.css .doctorium-prism-*). Tek dil TR.

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
  // AURA marka turkuazı — AuraLogo TONES.brand.main ile aynı ton ("by AURA" imzası).
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
// sitenin GERÇEK wordmark PNG'sidir (AuraLogo ile aynı varlıklar) ve yalnız O tıklanabilir →
// AURA vitrin ana sayfası (/). `light`: açık bölümde lacivert wordmark varyantı (beyaz PNG
// beyaz zeminde görünmez — AuraLogo'nun logo-word-light/dark ayrımının bölüm karşılığı).
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
              href="/doctorium/giris"
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
        {/* isolate: DoctoriumBgVideo -z-10 katmanları bölüm köküne gömülür (v2 hero deseni).
            Skrim alttan koyu → üstte açılır; video koyu sahne olduğu için metin AA kalır. */}
        <section className="relative isolate overflow-hidden">
          <DoctoriumBgVideo overlay="linear-gradient(to top, rgba(13,14,16,.93) 0%, rgba(13,14,16,.58) 45%, rgba(13,14,16,.38) 100%)" />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-40 top-24 h-[480px] w-[480px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(52,211,153,.09), transparent 68%)" }}
          />
          {/* Örnek görünüm kartı KALDIRILDI (kullanıcı kararı 2026-08-16, video denemesi
              sonrası): arka planda film oynarken temsili kart kalabalık yapıyordu →
              hero tek kolon metin, sağ yarı videoya açık; dikey nefes büyütüldü. */}
          <div className="mx-auto w-full max-w-6xl px-5 pb-28 pt-20 lg:pb-40 lg:pt-32">
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
        {/* Video DENEMESİ 2: açık bölümde koyu skrim kullanılamaz (almaşık ritim kararı
            bozulmaz) → beyaz perde altında video soluk doku olarak hissedilir. */}
        <section id="olanaklar" style={LIGHT} className="relative isolate scroll-mt-20 overflow-hidden bg-[var(--dl-bg)] text-[var(--dl-ink)]">
          <DoctoriumBgVideo overlay="linear-gradient(to bottom, rgba(255,255,255,.94) 0%, rgba(255,255,255,.88) 100%)" />
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

      <footer className="border-t border-[var(--dl-line)] py-10">
        <div className="mx-auto w-full max-w-6xl px-5">
          {/* Marka bloğu — AURA landing footer'ının alt-marka eşleniği (kullanıcı kararı
              2026-08-16): Braille "Doctorium" lockup'ının TAM ALTINDA ortalı. Lockup
              32px (≈154px) → Braille (146px) yazıdan taşmaz; üst bar bu yüzden
              braille'siz kalır (22px lockup 106px < 146px — AURA "nav'a konmaz" kuralı). */}
          <div className="flex items-center gap-3">
            <AuraMark size={34} tone="emerald" />
            <span className="inline-flex flex-col items-center">
              <DoctoriumWord className="text-[32px] leading-none" />
              <DoctoriumBraille height={12} className="mt-2 text-[var(--dl-muted)]" />
            </span>
          </div>
          <div className="mt-6 flex flex-col justify-between gap-4 text-xs text-[#777c82] sm:flex-row">
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
        </div>
      </footer>
    </div>
  );
}
