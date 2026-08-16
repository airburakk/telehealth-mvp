import { Fragment } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sparkles, FlaskConical, Building2, Pill, CalendarClock,
  TrendingUp, Scale, Star, BookOpen, Briefcase, Bookmark,
} from "lucide-react";

/**
 * Doctorium sol bandı + mobil alt çubuğu (Faz 1 — taslak v3.2, kullanıcı onayı 2026-08-14).
 *
 * SERVER component (bilinçli): ilk deneme layout'ta useSearchParams'lı client banttı — Next 16'da
 * layout içindeki Suspense boundary'nin $RC tamamlanma sinyali hiç gelmedi, bant `div[hidden]`
 * (S:0) içinde asılı kaldı. Aktifliği ZATEN bilen page'ler `active` prop'uyla verir; Suspense,
 * useSearchParams ve hydration bağımlılığı kökten yok — aktif şerit SSR ilk boyada gelir.
 * Sarmalayıcı düzen DoctoriumShell'dedir; page'ler içeriklerini Shell'e sarar.
 *
 * Masaüstü (md+): sol dikey bant — Ana Sayfa dönüşü, gruplu modüller (BİLGİ / MESLEĞİM; grup
 * başlıkları TIKLANMAZ), kişisel blok (Puanlarım · Tercihler). Mobil: alt sekme çubuğu (M2) —
 * Akışım · Bilgi · Mesleğim (+ Puanlarım); grup yuvası grubun İLK modülüne gider, modül şeridi
 * page tarafında ?m= üzerinden görünür.
 *
 * Renk disiplini (kit): modül rengi YÜZEY BOYAMAZ — aktif öğe 3px sol şerit + %10 dolgu + renkli
 * metin (kart kapağı [Cover] deseninin bant karşılığı; hex'ler page.tsx Cover ile birebir).
 * Kongre kimliği "beyaz" = tema-duyarlı ink (gece beyaz, gündüz koyu — sabit #fff gündüzde
 * görünmez olurdu). Akışım türsüz karışım → nötr, aktifken marka zümrüdü. URL şeması değişmez.
 */

type ModuleKey = "akis" | "akademik" | "sektorel" | "ilac" | "kongre" | "kariyer" | "mevzuat";
// "tercihler" yok: /doktor/doctorium/tercihler v6.49'dan beri redirect — işlevsiz yüzeyin
// linki çizilmez (koşullu-href ilkesi); Özelleştir paneli sayfanın içinde yaşıyor.
export type SidebarActive = ModuleKey | "oduller" | "kaydettiklerim" | null;

/** Bant nabzı (v6.102): modül → bugün akışa düşen içerik sayısı (lib/doctorium todayModuleCounts).
 *  null = sayaç verisi yok (bant nabızsız çizilir — geriye uyumlu). */
export type SidebarCounts = Record<string, number> | null;

/** Sayaç hangi modül satırında ne gösterir — akis TOPLAM; kongre/kariyer gece akışı olmayan
 *  küratörlü veri (sayaç yanıltıcı olurdu — bilinçli yok). */
function countFor(key: ModuleKey, counts: SidebarCounts): number | null {
  if (!counts) return null;
  if (key === "akis") {
    const t = (counts.akademik ?? 0) + (counts.sektorel ?? 0) + (counts.ilac ?? 0) + (counts.mevzuat ?? 0);
    return t > 0 ? t : null;
  }
  if (key === "kongre" || key === "kariyer") return null;
  const n = counts[key] ?? 0;
  return n > 0 ? n : null;
}

const MODULES: {
  key: ModuleKey;
  label: string;
  icon: typeof Sparkles;
  /** [metin/şerit hex, %10 dolgu rgba] · "ink" = tema-duyarlı beyaz/koyu · null = nötr (aktifken zümrüt). */
  color: [string, string] | "ink" | null;
  group: "BİLGİ" | "MESLEĞİM" | null;
}[] = [
  // Akışım sarı (kullanıcı kararı 2026-08-14): kıvılcım/parıltı çağrışımı. Amber (#f59e0b)
  // ticaretin işareti olarak ayrı durur — bu sarı (yellow-400) ondan bir ton açık/parlak.
  { key: "akis", label: "Akışım", icon: Sparkles, color: ["#facc15", "rgba(250,204,21,.10)"], group: null },
  { key: "akademik", label: "Akademik", icon: FlaskConical, color: ["#34d399", "rgba(52,211,153,.10)"], group: "BİLGİ" },
  { key: "sektorel", label: "Sektörel", icon: Building2, color: ["#a78bfa", "rgba(167,139,250,.10)"], group: "BİLGİ" },
  { key: "ilac", label: "İlaç & Cihaz", icon: Pill, color: ["#22d3ee", "rgba(34,211,238,.10)"], group: "BİLGİ" },
  { key: "kongre", label: "Kongre", icon: CalendarClock, color: "ink", group: "MESLEĞİM" },
  { key: "kariyer", label: "Kariyer", icon: TrendingUp, color: ["#60a5fa", "rgba(96,165,250,.10)"], group: "MESLEĞİM" },
  { key: "mevzuat", label: "Hukuk", icon: Scale, color: ["#fb7185", "rgba(251,113,133,.10)"], group: "MESLEĞİM" },
];

const EMERALD: [string, string] = ["#34d399", "rgba(16,185,129,.10)"];

/** Mobil alt çubuk yuvaları — grup yuvası grubun ilk modülüne götürür. */
const MOBILE_TABS: { label: string; icon: typeof Sparkles; href: string; keys: ModuleKey[] }[] = [
  { label: "Akışım", icon: Sparkles, href: "/doktor/doctorium", keys: ["akis"] },
  { label: "Bilgi", icon: BookOpen, href: "/doktor/doctorium?m=akademik", keys: ["akademik", "sektorel", "ilac"] },
  { label: "Mesleğim", icon: Briefcase, href: "/doktor/doctorium?m=kongre", keys: ["kongre", "kariyer", "mevzuat"] },
];

function SideItem({
  href, on, color, icon: Icon, label, badge, count, no,
}: {
  href: string;
  on: boolean;
  color: [string, string] | "ink" | null;
  icon: typeof Sparkles;
  label: string;
  badge?: number;
  /** Bugün-sayacı: silik mono sayı (Puanlarım'ın dolgulu rozetinden bilinçli farklı — nabız
   *  bilgidir, çağrı değildir). null/0 çizilmez. */
  count?: number | null;
  /** V2 "Editoryal Numara" (deneme, 2026-08-16): verilirse ikon YERİNE landing'in mono durak
   *  numarası basılır (01-07 — raf dili). Kişisel bölge ikonlu kalır (kişisel eşya numarasız). */
  no?: string;
}) {
  let cls = "text-[var(--c-ink-2)] hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]";
  let style: CSSProperties | undefined;
  let stripe: CSSProperties | undefined;
  if (on) {
    if (color === "ink") {
      cls = "bg-[var(--c-surface)] text-[var(--c-ink)]";
      stripe = { background: "var(--c-ink)" };
    } else {
      const [fg, bg] = color ?? EMERALD;
      cls = "";
      style = { color: fg, background: bg };
      stripe = { background: fg };
    }
  }
  // Renk diyeti (2026-08-16 bant revizyonu): modül rengi YALNIZ aktif öğede yaşar — pasif
  // ikonlar metin rengini (currentColor) miras alır. Yedi renkli ikon sütunu bandı
  // rengarenk yapıyordu; kit ilkesi "renk az ve anlamlı" + aktiflik böyle güçlenir.
  const iconColor = on ? (color === "ink" ? "var(--c-ink)" : (color ?? EMERALD)[0]) : undefined;
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`relative flex h-11 items-center gap-2.5 rounded-lg px-2.5 text-[15px] font-semibold transition ${cls}`}
      style={style}
    >
      {on && <span aria-hidden className="absolute -left-2.5 top-2 bottom-2 w-[3px] rounded-r-sm" style={stripe} />}
      {/* Raf işareti (kullanıcı kararı 2026-08-16, D13): numara + ikon BİRLİKTE — landing'in
          durak numarası editoryal kimliği, ikon hızlı tanımayı taşır. İkon 17px'e indi ki
          çift işaret satırı kalabalıklaştırmasın. Numarasız satırlar (Kişisel) yalnız ikon. */}
      {no && (
        <span
          aria-hidden
          className="aura-mono w-[20px] shrink-0 text-[11px] font-semibold tracking-wider"
          style={iconColor ? { color: iconColor } : undefined}
        >
          {no}
        </span>
      )}
      <Icon size={no ? 17 : 19} className="shrink-0" style={iconColor ? { color: iconColor } : undefined} />
      {label}
      {badge != null && (
        <span className="aura-mono ml-auto rounded-full bg-emerald-500/15 px-1.5 py-px text-[10px] text-emerald-300">
          {badge}
        </span>
      )}
      {count != null && count > 0 && (
        <span
          className="aura-mono ml-auto text-[11px] font-semibold text-[var(--c-ink-3)]"
          aria-label={`bugün ${count} yeni içerik`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  // Hairline ayraç (2026-08-16 bant revizyonu): kart künyesindeki çizgi dilinin bant karşılığı —
  // gruplar (BİLGİ / MESLEĞİM / KİŞİSEL) bölge olarak okunur.
  return (
    <div className="aura-mono mt-4 mb-1 border-t border-[var(--c-hairline)] px-2.5 pt-3 text-[11px] font-semibold tracking-[0.14em] text-[var(--c-ink-3)]">
      {children}
    </div>
  );
}

export function DoctoriumSidebar({
  active, balance, isDoctor, counts = null,
}: {
  active: SidebarActive;
  balance: number | null;
  /** KİŞİSEL bloğunun (Kaydettiklerim) şartı — personelde kişisel yüzey çizilmez. */
  isDoctor: boolean;
  counts?: SidebarCounts;
}) {
  let lastGroup: string | null = null;
  const totalToday = countFor("akis", counts);

  return (
    <>
      {/* ── Masaüstü sol bant (Header h-16 → top-16) ── */}
      <nav
        aria-label="Doctorium bölümleri"
        className="fixed bottom-0 left-0 top-16 z-20 hidden w-[212px] flex-col gap-0.5 overflow-y-auto border-r border-[var(--c-hairline)] bg-[var(--c-chrome)] px-2.5 py-4 md:flex"
      >
        {/* ── KİMLİK + NABIZ (v6.102 "Nabızlı Kule"): marka tek konumda yaşar — sayfa içi lockup
            banta taşındı, sahne başlığı h1 oldu. Nabız satırı bandın varlık nedenini söyler:
            burası her gece dolan CANLI bir kütüphane. Nokta statik (klinik sakinlik — animasyon
            yok); sayı yoksa satır çizilmez (boş gün sönük rozet göstermez). */}
        {/* Bant lockup'ı KALKTI (kullanıcı kararı 2026-08-16, son tur): marka Header'daki
            AURA↔Doctorium toggle'ında yaşar — bant markasız, NABIZLA açılır. Zümrüt ton
            tema-duyarlı: gece 300, gündüz 700 (CoverArt [.theme-light_&] deseni). */}
        {totalToday != null && (
          <div className="aura-mono flex items-center gap-1.5 px-2.5 pb-3.5 pt-0.5 text-xs font-semibold tracking-[0.14em] text-emerald-300 [.theme-light_&]:text-emerald-700">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            BUGÜN {totalToday} YENİ
          </div>
        )}

        {/* Çıkış kapısı (2026-08-16 bant revizyonu): dönüş linki modül listesinden hairline ile
            ayrılır — bant dört bölge okunur (kimlik / çıkış / modüller / kişisel). */}
        <Link
          href="/doktor"
          className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-semibold text-[var(--c-ink-3)] hover:text-[var(--c-ink)]"
        >
          <ArrowLeft size={16} /> Ana Sayfa
        </Link>
        <div className="mb-2 border-b border-[var(--c-hairline)]" aria-hidden="true" />

        {MODULES.map((m, i) => {
          const header = m.group && m.group !== lastGroup ? <GroupLabel>{m.group}</GroupLabel> : null;
          lastGroup = m.group;
          return (
            <Fragment key={m.key}>
              {header}
              <SideItem
                href={m.key === "akis" ? "/doktor/doctorium" : `/doktor/doctorium?m=${m.key}`}
                on={active === m.key}
                color={m.color}
                icon={m.icon}
                no={String(i + 1).padStart(2, "0")}
                label={m.label}
                count={countFor(m.key, counts)}
              />
            </Fragment>
          );
        })}

        {(isDoctor || balance != null) && (
          <>
            <GroupLabel>KİŞİSEL</GroupLabel>
            {/* Kaydettiklerim İLK sırada (kullanıcı kararı 2026-08-14, Faz 2). Öğrenci-sınırlı
                üye de görür (içerik işlevi); Puanlarım yalnız bakiyesi olanda (pazarlama süzgeci). */}
            {isDoctor && (
              <SideItem
                href="/doktor/doctorium/kaydettiklerim"
                on={active === "kaydettiklerim"}
                color={null}
                icon={Bookmark}
                label="Kaydettiklerim"
              />
            )}
            {balance != null && (
              <SideItem
                href="/doktor/doctorium/oduller"
                on={active === "oduller"}
                color={null}
                icon={Star}
                label="Puanlarım"
                badge={balance}
              />
            )}
          </>
        )}

        {/* Dip imza v6.102'de KALKTI: tepe kimlik bloğu geldi — marka bantta TEK konumda yaşar
            (aynı bantta iki lockup tekrar olurdu). */}
      </nav>

      {/* ── Mobil alt çubuk (M2) ── */}
      <nav
        aria-label="Doctorium bölümleri"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-[var(--c-hairline)] bg-[var(--c-chrome)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {MOBILE_TABS.map((t) => {
          const on = active != null && t.keys.includes(active as ModuleKey);
          // Mobil nabız (kullanıcı kararı 2026-08-16, D16): günün sayısı Akışım yuvasının
          // ikon köşesinde — uygulama-rozeti dili; masaüstü bandındaki nabzın mobil eşleniği.
          const pulse = t.keys.includes("akis") ? totalToday : null;
          return (
            <Link
              key={t.label}
              href={t.href}
              aria-current={on ? "page" : undefined}
              aria-label={pulse != null ? `${t.label}, bugün ${pulse} yeni içerik` : undefined}
              className={`grid min-w-[72px] justify-items-center gap-1 py-2 text-[10px] font-semibold ${
                on ? "text-emerald-300" : "text-[var(--c-ink-3)]"
              }`}
            >
              <span className="relative">
                <t.icon size={18} />
                {pulse != null && (
                  <span
                    aria-hidden
                    className="aura-mono absolute -right-3 -top-1.5 rounded-full bg-emerald-500/20 px-1 text-[10px] font-bold leading-[15px] text-emerald-300 [.theme-light_&]:bg-emerald-600/15 [.theme-light_&]:text-emerald-700"
                  >
                    {pulse}
                  </span>
                )}
              </span>
              {t.label}
            </Link>
          );
        })}
        {isDoctor && (
          <Link
            href="/doktor/doctorium/kaydettiklerim"
            aria-current={active === "kaydettiklerim" ? "page" : undefined}
            className={`grid min-w-[64px] justify-items-center gap-1 py-2 text-[10px] font-semibold ${
              active === "kaydettiklerim" ? "text-emerald-300" : "text-[var(--c-ink-3)]"
            }`}
          >
            <Bookmark size={18} />
            Kayıtlı
          </Link>
        )}
        {balance != null && (
          <Link
            href="/doktor/doctorium/oduller"
            aria-current={active === "oduller" ? "page" : undefined}
            className={`grid min-w-[64px] justify-items-center gap-1 py-2 text-[10px] font-semibold ${
              active === "oduller" ? "text-emerald-300" : "text-[var(--c-ink-3)]"
            }`}
          >
            <Star size={18} />
            Puanlarım
          </Link>
        )}
      </nav>
    </>
  );
}

/**
 * Doctorium çalışma alanı kabuğu: bant + içerik düzeni. Page'ler içeriklerini buna sarar
 * (layout DEĞİL — layout searchParams göremez, aktifliği page bilir).
 *
 * Düzen (kullanıcı kararı 2026-08-14, 3. tur): PORTAL DİLİ — blok max-w-5xl ortalı; /doktor da
 * 5xl, Post-Op da 5xl'e çekildi → üç sekme arasında geçişte genişlik ZIPLAMAZ. Bant bloğun
 * solunda, içerik sola yaslı (mx-auto'suz) → bant+içerik bitişik tek gövde ("havada bant" olmaz;
 * tam-genişlik kenar-bant denemesi portal düzenini bozduğu için geri alındı). Mobilde alt çubuk
 * fixed → içeriğe pb-16.
 */
export function DoctoriumShell({
  active, balance, isDoctor, counts = null, children,
}: {
  active: SidebarActive;
  balance: number | null;
  isDoctor: boolean;
  counts?: SidebarCounts;
  children: React.ReactNode;
}) {
  return (
    /* Düzen (kullanıcı kararı 2026-08-14, 5. tur): bant viewport SOLUNA SABİT (fixed); içerik
       ise /doktor'un ortalı 5xl konteyner konumunda başlar — sol boşluk = max(bant payı 212px,
       viewport-ortalama). Geniş ekranda Doctorium başlığı /doktor · Post-Op başlıklarıyla AYNI
       hizada; dar ekranda içerik bandın altına GİRMEZ (max taban). 100vw scrollbar'ı saydığı
       için ortalamada ± scrollbar/2 (~5px) sapma olabilir — punto hizasında algılanmaz. */
    <>
      <DoctoriumSidebar active={active} balance={balance} isDoctor={isDoctor} counts={counts} />
      <div className="pb-16 md:pb-0 md:pl-[max(13.25rem,calc((100vw-64rem)/2))]">
        <div className="w-full max-w-5xl">{children}</div>
      </div>
    </>
  );
}
