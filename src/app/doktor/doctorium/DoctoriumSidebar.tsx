import { Fragment } from "react";
import Link from "next/link";
import {
  Sparkles, Star, BookOpen, Briefcase, Bookmark,
} from "lucide-react";

/**
 * Doctorium ÜST RAFI + mobil alt çubuğu (2026-08-18, kullanıcı kararı — /design-review D1).
 *
 * SOL BANT KALKTI: 212px'lik kalıcı `fixed` sütun kompozisyonu sola yığıyor, 1280'de ekranın
 * %25'i (1920'de ~%40'ı) ölü kalıyordu; dikey bant "dashboard" diliydi, Doctorium ise OKUMA
 * ürünü. Yerine header altında sticky YATAY modül rafı: masaüstü ↔ mobil aynı yatay modele
 * indi, okuma kolonu ortalandı (dergi düzeni), `md:pl-[max(...)]` padding hack'i ve scrollbar
 * ±5px sapması kökten kalktı. Teşhis + alternatifler: vault
 * output/doctorium-sol-bant-alternatif-tasarim-2026-08-18.md.
 *
 * SERVER component (bilinçli — v6.101 dersi AYNEN): aktifliği bilen page `active` prop'uyla
 * verir; Suspense/useSearchParams/hydration bağımlılığı yok, aktif şerit SSR ilk boyada gelir.
 *
 * Raf dili: landing'in "01-07 durak" editoryal kimliği — mono numara + etiket (sol banttaki
 * D13 "numara+ikon" kararı bandın raf işaretiydi; yatay rafta çift işaret sıkışıklık yapar,
 * ikonlar mobil çubukta yaşamaya devam eder). Renk diyeti KORUNUR: modül rengi yalnız AKTİF
 * sekmede (2px alt şerit + renkli etiket — mobil şeridin border-b-2 deseniyle aynı). Etkinlik
 * kimliği "ink" = tema-duyarlı. Sağ küme: BUGÜN nabzı · Kaydettiklerim · Puanlarım (kişisel
 * köşe). "Ana Sayfa" çıkışı rafta YOK — Header'daki AURA↔Doctorium toggle'ı zaten çıkış
 * kapısı (çift navigasyon bulgusu); mobil sayfa içi dönüş linki page'lerde sürer.
 */

type ModuleKey = "akis" | "akademik" | "sektorel" | "ilac" | "etkinlik" | "kariyer" | "mevzuat";
// "tercihler" yok: /doktor/doctorium/tercihler v6.49'dan beri redirect — işlevsiz yüzeyin
// linki çizilmez (koşullu-href ilkesi); Özelleştir paneli sayfanın içinde yaşıyor.
export type SidebarActive = ModuleKey | "oduller" | "kaydettiklerim" | null;

/** Raf nabzı (v6.102): modül → bugün akışa düşen içerik sayısı (lib/doctorium todayModuleCounts).
 *  null = sayaç verisi yok (raf nabızsız çizilir — geriye uyumlu). */
export type SidebarCounts = Record<string, number> | null;

/** Sayaç hangi modül sekmesinde ne gösterir — akis TOPLAM; etkinlik/kariyer gece akışı olmayan
 *  küratörlü veri (sayaç yanıltıcı olurdu — bilinçli yok). */
function countFor(key: ModuleKey, counts: SidebarCounts): number | null {
  if (!counts) return null;
  if (key === "akis") {
    const t = (counts.akademik ?? 0) + (counts.sektorel ?? 0) + (counts.ilac ?? 0) + (counts.mevzuat ?? 0);
    return t > 0 ? t : null;
  }
  if (key === "etkinlik" || key === "kariyer") return null;
  const n = counts[key] ?? 0;
  return n > 0 ? n : null;
}

const MODULES: {
  key: ModuleKey;
  label: string;
  /** Aktif sekme metin/şerit rengi · "ink" = tema-duyarlı · null = nötr (aktifken zümrüt). */
  color: string | "ink" | null;
  group: "BİLGİ" | "MESLEĞİM" | null;
}[] = [
  // Akışım sarı (kullanıcı kararı 2026-08-14): kıvılcım çağrışımı; amber'den bir ton parlak.
  { key: "akis", label: "Akışım", color: "#facc15", group: null },
  { key: "akademik", label: "Akademik", color: "#34d399", group: "BİLGİ" },
  { key: "sektorel", label: "Sektörel", color: "#a78bfa", group: "BİLGİ" },
  { key: "ilac", label: "İlaç & Cihaz", color: "#22d3ee", group: "BİLGİ" },
  { key: "etkinlik", label: "Etkinlik", color: "ink", group: "MESLEĞİM" },
  { key: "kariyer", label: "Kariyer", color: "#60a5fa", group: "MESLEĞİM" },
  { key: "mevzuat", label: "Hukuk", color: "#fb7185", group: "MESLEĞİM" },
];

const EMERALD = "#34d399";

/** Mobil alt çubuk yuvaları — grup yuvası grubun ilk modülüne götürür. */
const MOBILE_TABS: { label: string; icon: typeof Sparkles; href: string; keys: ModuleKey[] }[] = [
  { label: "Akışım", icon: Sparkles, href: "/doktor/doctorium", keys: ["akis"] },
  { label: "Bilgi", icon: BookOpen, href: "/doktor/doctorium?m=akademik", keys: ["akademik", "sektorel", "ilac"] },
  { label: "Mesleğim", icon: Briefcase, href: "/doktor/doctorium?m=etkinlik", keys: ["etkinlik", "kariyer", "mevzuat"] },
];

/** Raf sekmesi — NUMARA ROZETİ aktif dili (kullanıcı kararı 2026-08-18, görsel karşılaştırma
 *  sonrası): alt çizgi KALKTI; aktifken mono durak numarası modül renginde DOLGULU rozete
 *  döner + etiket renklenir. Rozet metni var(--c-chrome) = tema-duyarlı zıt ton (gece koyu
 *  zemin rengi parlak rozette, gündüz açık zemin rengi koyu ink rozetinde — iki temada da
 *  kontrast). Aktiflik renk + rozet DOLGUSUYLA işaretlenir, yalnız renkle değil. */
function ShelfTab({
  href, on, color, label, no, count,
}: {
  href: string;
  on: boolean;
  color: string | "ink" | null;
  label: string;
  no: string;
  count?: number | null;
}) {
  const fg = color === "ink" ? "var(--c-ink)" : (color ?? EMERALD);
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`flex h-12 shrink-0 items-center gap-1.5 px-2.5 text-[13px] font-semibold transition-colors ${
        on ? "" : "text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"
      }`}
      style={on ? { color: fg } : undefined}
    >
      <span
        aria-hidden
        className={`aura-mono text-[10px] font-semibold tracking-wider ${on ? "rounded-[5px] px-1 py-px" : "opacity-80"}`}
        style={on ? { background: fg, color: "var(--c-chrome)" } : undefined}
      >
        {no}
      </span>
      {label}
      {/* Yeni-içerik işareti = NOKTA (kullanıcı kararı 2026-08-18, 3. tur): sekme başına
          rakam karışıklık yaratıyordu — "bugün bu modülde yeni var" bilgisini minik zümrüt
          nokta taşır; TOPLAM sayı sağdaki nabızda yaşar. aria-label sayıyı okumaya devam
          eder (görme engelli kullanıcı sayıyı kaybetmez). Aktif sekmede nokta çizilmez
          (zaten oradasınız — işaret gürültü olur). */}
      {!on && count != null && count > 0 && (
        <span
          role="img"
          aria-label={`bugün ${count} yeni içerik`}
          className="mb-2 h-1.5 w-1.5 shrink-0 self-center rounded-full bg-emerald-400/90"
        />
      )}
    </Link>
  );
}

/** Küme ayracı — grup ADLARI kaldırıldı (kullanıcı kararı 2026-08-18): BİLGİ/MESLEĞİM
 *  yazıları rafı kalabalıklaştırıyordu; kümeler yalnız hairline dikmeyle ayrılır
 *  (mobil çubukta grup adları yuva etiketi olarak yaşamaya devam eder). */
function ShelfGroup() {
  return <span aria-hidden className="mx-1.5 h-5 w-px shrink-0 bg-[var(--c-hairline)]" />;
}

export function DoctoriumSidebar({
  active, balance, isDoctor, counts = null,
}: {
  active: SidebarActive;
  balance: number | null;
  /** Kaydettiklerim'in şartı — personelde kişisel yüzey çizilmez. */
  isDoctor: boolean;
  counts?: SidebarCounts;
}) {
  let lastGroup: string | null = null;
  const totalToday = countFor("akis", counts);

  return (
    <>
      {/* ── Masaüstü üst rafı (Header h-16 sticky → top-16; Header z-30 altında) ──
          Zemin "Zümrüt Nefesi %8" (2026-08-19, kullanıcı seçimi): salt krom, sabit-koyu
          Header'la kaynaşıp siyah blok okunuyordu — globals.css .doctorium-shelf-bg. */}
      <nav
        aria-label="Doctorium bölümleri"
        className="doctorium-shelf-bg sticky top-16 z-20 hidden border-b border-[var(--c-hairline)] backdrop-blur-md md:block"
      >
        {/* İç konteyner Header'la aynı kolon (max-w-6xl); ps-[39px] = "01 Akışım"ın METNİ
            Header'daki AURA wordmark'ının x'iyle hizalanır (kullanıcı isteği 2026-08-18:
            sekme AURA'yı sola geçmesin). Hesap: konteyner kenarı +39 → sekme kutusu; sekmenin
            px-2.5'i (+10) → metin, AURA'nın ölçülen konumunda (marka toggle'ının sembol
            yuvası ~29px + px-5; AuraMark boyutu sabit chrome — kırılırsa yeniden ölç).
            Dar masaüstünde raf yatay kayar. */}
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-0.5 overflow-x-auto pe-5 ps-[39px]">
          {MODULES.map((m, i) => {
            const header = m.group && m.group !== lastGroup ? <ShelfGroup /> : null;
            lastGroup = m.group;
            return (
              <Fragment key={m.key}>
                {header}
                <ShelfTab
                  href={m.key === "akis" ? "/doktor/doctorium" : `/doktor/doctorium?m=${m.key}`}
                  on={active === m.key}
                  color={m.color}
                  label={m.label}
                  no={String(i + 1).padStart(2, "0")}
                  count={countFor(m.key, counts)}
                />
              </Fragment>
            );
          })}

          {/* ── Sağ küme: yalnız nabız (kullanıcı kararı 2026-08-18, 2. tur): Kaydettiklerim
              ve Puanlarım raftan Header profil menüsüne taşındı — raf salt MODÜL gezinmesi,
              kişisel eşya menüde (Profilim/Finans deseni). Mobil alt çubuktaki yuvaları
              DOKUNULMADI (yerleşik mobil deseni). Nabız kişisel değil, rafın varlık nedeni —
              kalır; artık dar ekranda da sığar (lg'de görünür). Nabız TIKLANABİLİR (kullanıcı
              kararı 2026-08-18, 3. tur): yeni içeriklerin aktığı Akışım'a götürür — mobil
              eşleniği (rozet) zaten Akışım yuvasında yaşıyor, masaüstü simetriye geldi. */}
          <div className="ml-auto flex shrink-0 items-center pl-4">
            {totalToday != null && (
              <Link
                href="/doktor/doctorium"
                aria-label={`bugün ${totalToday} yeni içerik — Akışım'a git`}
                className="aura-mono hidden items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-emerald-300 transition-colors hover:text-emerald-200 lg:flex [.theme-light_&]:text-emerald-700 [.theme-light_&]:hover:text-emerald-600"
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {/* 99+ tavanı (2026-08-18): backfill/yoğun ingest günlerinde "991" gibi
                    rakamlar nabzı absürtleştiriyor — üç hane 99+ olarak kırpılır. */}
                BUGÜN {totalToday > 99 ? "99+" : totalToday} YENİ
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Mobil alt çubuk (M2) — zemin masaüstü rafla AYNI "Zümrüt Nefesi" (aynı nav'ın
          iki yüzü, dil bölünmez); yapı dokunulmadı ── */}
      <nav
        aria-label="Doctorium bölümleri"
        className="doctorium-shelf-bg fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-[var(--c-hairline)] pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {MOBILE_TABS.map((t) => {
          const on = active != null && t.keys.includes(active as ModuleKey);
          // Mobil nabız (kullanıcı kararı 2026-08-16, D16): günün sayısı Akışım yuvasının
          // ikon köşesinde — uygulama-rozeti dili; raftaki nabzın mobil eşleniği.
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
                    {pulse > 99 ? "99+" : pulse}
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
 * Doctorium çalışma alanı kabuğu: üst raf + ORTALI okuma düzeni. Page'ler içeriklerini buna
 * sarar (layout DEĞİL — layout searchParams göremez, aktifliği page bilir).
 *
 * Düzen (2026-08-18, Üst Raf kararı): sol bant + `md:pl-[max(...)]` padding hack'i KALKTI —
 * içerik page'lerin kendi `mx-auto` sarmalayıcılarıyla ortalanır (dergi düzeni; [id] ve
 * kariyer/[slug] zaten böyleydi, üç Shell sayfası da mx-auto'ya çekildi). Mobilde alt çubuk
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
    <>
      <DoctoriumSidebar active={active} balance={balance} isDoctor={isDoctor} counts={counts} />
      <div className="pb-16 md:pb-0">{children}</div>
    </>
  );
}
