import { Fragment, type CSSProperties } from "react";
import Link from "next/link";

/**
 * Doctorium ÜST RAFI + MOBİL RAF-FOOTER (2026-08-18 Üst Raf kararı; 2026-08-19 mobil devrimi).
 *
 * SOL BANT KALKTI (v6.109): 212px'lik kalıcı `fixed` sütun kompozisyonu sola yığıyordu; yerine
 * header altında sticky YATAY modül rafı. Teşhis + alternatifler: vault
 * output/doctorium-sol-bant-alternatif-tasarim-2026-08-18.md.
 *
 * MOBİL RAF-FOOTER (kullanıcı kararı 2026-08-19): eski 3-grup ikonlu alt çubuk ("app tab"
 * dili) emekli — mobil alt çubuk artık masaüstü rafının BİREBİR eşleniği: yatay kaydırmalı
 * 01-08 durakları, mono numara + etiket + zümrüt nokta, aynı zemin. Kayıtlı + Puanlarım
 * yuvaları Header hesap menüsüne taşındı (masaüstüyle simetri — v6.109 orada başlatmıştı);
 * page'lerdeki mobil grup şeridi de kalktı (çift navigasyon olmaz). "BUGÜN N YENİ" nabzının
 * mobil eşleniği Akışım sekmesindeki rozet.
 *
 * SERVER component (bilinçli — v6.101 dersi AYNEN): aktifliği bilen page `active` prop'uyla
 * verir; Suspense/useSearchParams/hydration bağımlılığı yok, aktif şerit SSR ilk boyada gelir.
 *
 * RENK MİMARİSİ (2026-08-19, "beyaz raf" denemesiyle kurulan çift-ton): sekme kimlik renkleri
 * artık {dark, light} ÇİFTİ — eski tek hex gündüz temasında da gece tonunu basıyordu (globals
 * gündüz-kontrast güvencesi yalnız Tailwind SINIFLARINI yakalar, inline style'ı yakalamaz).
 * Seçimi CSS yapar: sekme yalnız --tab-dark/--tab-light değişkenlerini basar; hangisinin
 * kazandığı raf bağlamının işi (globals.css "Doctorium raf renk bağlamı" bloğu). Zemin
 * varyantları da orada: varsayılan "Derin Orman %12" (kullanıcı seçimi 2026-08-19, doz+ton
 * taraması sonrası); `shelf-white` sınıfı tema-BAĞIMSIZ açık raf ("zebra krom" — denendi,
 * seçilmedi ama tek sınıfla açılabilir durur). Raf içi TÜM renkler --shelf-* token'larından
 * okunur ki varyant tek sınıfla değişsin.
 */

type ModuleKey = "akis" | "akademik" | "sektorel" | "ilac" | "etkinlik" | "kariyer" | "mevzuat";
// "tercihler" yok: /doktor/doctorium/tercihler v6.49'dan beri redirect — işlevsiz yüzeyin
// linki çizilmez (koşullu-href ilkesi); Özelleştir paneli sayfanın içinde yaşıyor.
export type SidebarActive = ModuleKey | "takvim" | "oduller" | "kaydettiklerim" | null;

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

/** Modül kimlik renkleri — {dark: gece tonu, light: açık zemin karşılığı}. Gündüz tonları
 *  mevcut token ailesinden (gold/accent-2 akrabalığı; raf-zemin karşılaştırma turu 2026-08-19).
 *  null = nötr (aktifken zümrüt çifti). Etkinlik "ink" = tema-duyarlı var(--c-ink) — açık raf
 *  varyantında globals --shelf-ink onu koyuya sabitler. */
const MODULES: {
  key: ModuleKey;
  label: string;
  color: { dark: string; light: string } | "ink" | null;
  group: "BİLGİ" | "MESLEĞİM" | null;
}[] = [
  // Akışım sarı (kullanıcı kararı 2026-08-14): kıvılcım çağrışımı; gündüzü --c-gold ailesi.
  { key: "akis", label: "Akışım", color: { dark: "#facc15", light: "#8a6414" }, group: null },
  { key: "akademik", label: "Akademik", color: { dark: "#34d399", light: "#047857" }, group: "BİLGİ" },
  { key: "sektorel", label: "Sektörel", color: { dark: "#a78bfa", light: "#5b4b9e" }, group: "BİLGİ" },
  { key: "ilac", label: "İlaç & Cihaz", color: { dark: "#22d3ee", light: "#0e7d8c" }, group: "BİLGİ" },
  { key: "etkinlik", label: "Etkinlik", color: "ink", group: "MESLEĞİM" },
  { key: "kariyer", label: "Kariyer", color: { dark: "#60a5fa", light: "#2d5c9e" }, group: "MESLEĞİM" },
  { key: "mevzuat", label: "Hukuk", color: { dark: "#fb7185", light: "#a83e50" }, group: "MESLEĞİM" },
];

const EMERALD = { dark: "#34d399", light: "#047857" };

/** Takvim durağı (kullanıcı kararı 2026-08-19): modül DEĞİL ayrı ROTA — raf yine de taşır
 *  (08; kimliği marka zümrüdü). Aşama 2'de nöbet/icap planı da bu sayfada yaşayacak. */
const TAKVIM = { href: "/doktor/doctorium/takvim", label: "Takvim", color: EMERALD };

/** Raf sekmesi — NUMARA ROZETİ aktif dili (kullanıcı kararı 2026-08-18): aktifken mono durak
 *  numarası kimlik renginde DOLGULU rozete döner + etiket renklenir. Renk seçimi CSS'te:
 *  --tab-dark/--tab-light burada basılır, kazananı raf bağlamı belirler (globals.css).
 *  Rozet metni var(--shelf-surface-ink) = zeminin kendi tonu (iki temada + açık varyantta
 *  kontrast). Aktiflik renk + rozet DOLGUSUYLA işaretlenir, yalnız renkle değil. */
function ShelfTab({
  href, on, color, label, no, count,
}: {
  href: string;
  on: boolean;
  color: { dark: string; light: string } | "ink" | null;
  label: string;
  no: string;
  count?: number | null;
}) {
  const pair = color === "ink" ? null : (color ?? EMERALD);
  const vars = {
    "--tab-dark": pair ? pair.dark : "var(--shelf-ink)",
    "--tab-light": pair ? pair.light : "var(--shelf-ink)",
  } as CSSProperties;
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      style={vars}
      className={`shelf-tab flex h-12 shrink-0 items-center gap-1.5 px-2.5 text-[13px] font-semibold transition-colors ${
        on ? "shelf-tab-on" : "shelf-tab-off"
      }`}
    >
      <span
        aria-hidden
        className={`shelf-no aura-mono text-[10px] font-semibold tracking-wider ${on ? "rounded-[5px] px-1 py-px" : "opacity-80"}`}
      >
        {no}
      </span>
      {label}
      {/* Yeni-içerik işareti = NOKTA (kullanıcı kararı 2026-08-18, 3. tur): "bugün bu modülde
          yeni var" bilgisini minik zümrüt nokta taşır; TOPLAM sayı nabızda yaşar. aria-label
          sayıyı okumaya devam eder. Aktif sekmede nokta çizilmez (işaret gürültü olur). */}
      {!on && count != null && count > 0 && (
        <span
          role="img"
          aria-label={`bugün ${count} yeni içerik`}
          className="shelf-dot mb-2 h-1.5 w-1.5 shrink-0 self-center rounded-full"
        />
      )}
    </Link>
  );
}

/** Küme ayracı — grup ADLARI kaldırıldı (kullanıcı kararı 2026-08-18): kümeler yalnız
 *  hairline dikmeyle ayrılır. */
function ShelfGroup() {
  return <span aria-hidden className="mx-1.5 h-5 w-px shrink-0 bg-[var(--shelf-hairline)]" />;
}

/** Rafın sekme dizisi — masaüstü ve mobil raf-footer AYNI diziyi çizer (tek kaynak; iki
 *  markup'ın ayrışması v6.109-öncesi çift-liste driftine geri dönüş olurdu). */
function ShelfTabs({ active, counts }: { active: SidebarActive; counts: SidebarCounts }) {
  let lastGroup: string | null = null;
  return (
    <>
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
      <ShelfGroup />
      <ShelfTab href={TAKVIM.href} on={active === "takvim"} color={TAKVIM.color} label={TAKVIM.label} no="08" />
    </>
  );
}

export function DoctoriumSidebar({
  active, counts = null,
}: {
  active: SidebarActive;
  counts?: SidebarCounts;
}) {
  const totalToday = countFor("akis", counts);

  return (
    <>
      {/* ── Masaüstü üst rafı (Header h-16 sticky → top-16; Header z-30 altında) ──
          Zemin "Derin Orman %12" (kullanıcı seçimi 2026-08-19) — globals.css
          .doctorium-shelf-bg; açık varyant için yanına `shelf-white` eklenir. */}
      <nav
        aria-label="Doctorium bölümleri"
        className="doctorium-shelf-bg sticky top-16 z-20 hidden border-b border-[var(--shelf-hairline)] backdrop-blur-md md:block"
      >
        {/* İç konteyner Header'la aynı kolon (max-w-6xl); ps-[39px] = "01 Akışım"ın METNİ
            Header'daki AURA wordmark'ının x'iyle hizalanır (kullanıcı isteği 2026-08-18).
            Dar masaüstünde raf yatay kayar. */}
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-0.5 overflow-x-auto pe-5 ps-[39px]">
          <ShelfTabs active={active} counts={counts} />

          {/* Sağ küme: yalnız nabız (kullanıcı kararı 2026-08-18, 2. tur) — Kaydettiklerim ve
              Puanlarım Header profil menüsünde. Nabız TIKLANABİLİR (3. tur): 2026-08-24'ten beri
              Akışım'ın YALNIZ-YENİ görünümüne (?n=1) götürür — düz Akışım "sayıya tıkladım ama
              yenileri göremedim" olarak okunuyordu (kullanıcı bildirimi; nabız zaten yalnız
              bugün yeni varken çizilir → süzgeçli hedef hiçbir durumda boş vaat değil). */}
          <div className="ml-auto flex shrink-0 items-center pl-4">
            {totalToday != null && (
              <Link
                href="/doktor/doctorium?n=1"
                aria-label={`bugün ${totalToday} yeni içerik — yalnızca yenileri gör`}
                className="shelf-pulse aura-mono hidden items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] transition-colors lg:flex"
              >
                <span aria-hidden className="shelf-dot h-1.5 w-1.5 rounded-full" />
                {/* 99+ tavanı (2026-08-18): backfill günlerinde üç hane absürtleşiyor. */}
                BUGÜN {totalToday > 99 ? "99+" : totalToday} YENİ
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Mobil RAF-FOOTER (kullanıcı kararı 2026-08-19) — masaüstü rafının alt-kenar
          eşleniği: aynı duraklar, aynı zemin, yatay kaydırma. Akışım'daki nokta "bugün yeni
          var"ı taşır (rozetli sayı Header zil + Akışım nabzında yaşar). Kayıtlı/Puanlarım
          yuvaları Header hesap menüsüne taşındı — çubuk salt modül gezinmesi. */}
      <nav
        aria-label="Doctorium bölümleri"
        className="doctorium-shelf-bg fixed inset-x-0 bottom-0 z-40 border-t border-[var(--shelf-hairline)] pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="flex h-12 items-center gap-0.5 overflow-x-auto px-3">
          <ShelfTabs active={active} counts={counts} />
        </div>
      </nav>
    </>
  );
}

/**
 * Doctorium çalışma alanı kabuğu: üst raf + ORTALI okuma düzeni. Page'ler içeriklerini buna
 * sarar (layout DEĞİL — layout searchParams göremez, aktifliği page bilir).
 *
 * `balance`/`isDoctor` prop'ları mobil çubuğun eski Kayıtlı/Puanlarım yuvaları içindi
 * (2026-08-19'da Header menüsüne taşındılar) — imza, beş çağıran page'i tek turda kırmamak
 * için KORUNDU, değerler artık okunmuyor. Çağıranlardaki getDoctorBalance hesabıyla birlikte
 * ayrı bir temizlik turunda sökülecek (todo).
 */
export function DoctoriumShell({
  active, counts = null, children,
}: {
  active: SidebarActive;
  balance?: number | null;
  isDoctor?: boolean;
  counts?: SidebarCounts;
  children: React.ReactNode;
}) {
  return (
    <>
      <DoctoriumSidebar active={active} counts={counts} />
      <div className="pb-14 md:pb-0">{children}</div>
    </>
  );
}
