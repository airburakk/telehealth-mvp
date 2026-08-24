"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellOff, BellRing, Check, ChevronDown, Loader2, Megaphone, SlidersHorizontal } from "lucide-react";

/**
 * Doctorium — TEK "Özelleştir" penceresi (v6.52-53, kullanıcı isteği).
 *
 * Önceden branş tercihleri, geriye-dönük aralık, kategori ve kongre alarmı sayfada AYRI AYRI
 * satırlar hâlinde duruyordu (dağınık görünüyordu). Hepsi burada tek açılır panelde toplandı;
 * kapalıyken tek satırlık özet gösterir, böylece içerik listesi öne çıkar.
 *
 * Modüle göre yalnız İLGİLİ bölümler gelir (v6.53: branş tercihi YALNIZ "Akışım"da — diğer
 * sekmelerde akış branşa göre süzülmediği için orada sormak yanıltıcıydı). Hiçbir bölüm
 * yoksa düğme de çizilmez (boş panel açılmasın).
 *
 * Aralık/kategori Link ile (sunucu filtresi, paylaşılabilir URL); branş ve alarm tercihleri
 * kalıcı ayar olduğu için API'ye yazılır.
 */

const ALERT_OPTIONS = [
  { days: 1, label: "1 gün" },
  { days: 3, label: "3 gün" },
  { days: 7, label: "1 hafta" },
  { days: 14, label: "2 hafta" },
  { days: 30, label: "1 ay" },
];

interface Props {
  module: string;
  /** Akış Tercihleri bölümü (Faz 2, 2026-08-14) — yalnız Akışım + DOCTOR; panelin İLK sorusu. */
  showFeedPrefs: boolean;
  /** Seçilebilir bölümler — server'dan gelir (lib/doctorium FEED_MODULE_OPTIONS; client bu
   *  server modülünü import EDEMEZ [db bağımlılığı] → rangeOptions gibi props'la taşınır). */
  feedOptions: { key: string; label: string }[];
  /** Kayıtlı tercih; [] = tümü seçili demektir. */
  feedInitial: string[];
  /** Aralık seçicisi gösterilsin mi (mevzuat/sektörel/ilaç). */
  showRange: boolean;
  /** Kategori seçicisi gösterilsin mi (mevzuat/sektörel). */
  showCategory: boolean;
  /** Etkinlik alarm ayarları gösterilsin mi. */
  showAlerts: boolean;
  /** Kapsam filtresi gösterilsin mi (yalnız Etkinlik sekmesi, v6.62). */
  showScope: boolean;
  /** Etkin kapsam filtresi (null = tümü). */
  scope: string | null;
  /** v6.120 — etkinlik TÜRÜ çipleri (yalnız Etkinlik sekmesi). */
  showEventTypes: boolean;
  /** Seçili türler; null = "hepsi" (süzgeç yok). Varsayılan sunucuda kongre+sempozyum. */
  eventTypes: string[] | null;
  eventTypeOptions: { key: string; label: string }[];
  /** v6.99.3 — Sektörel "Kaynak" filtresi (ulusal/uluslararası kaynaklar); panelin İLK bölümü. */
  showSourceScope: boolean;
  /** Etkin kaynak kapsamı (?s=; null = tüm kaynaklar). */
  sourceScope: string | null;
  rangeKey: string;
  rangeOptions: readonly { key: string; label: string }[];
  category: string | null;
  categoryOptions: { key: string; label: string }[];
  /** Branş tercihi bölümü yalnız DOCTOR'da (personelin branşı yok). */
  branchOptions: { slug: string; label: string }[] | null;
  branchInitial: string[];
  ownBranchSlug: string | null;
  alertStart: number | null;
  /** v6.62: bildiri ve erken kayıt eşikleri AYRI (eskiden tek "deadline" idi). */
  alertAbstract: number | null;
  alertEarlyBird: number | null;
  /** Sponsorlu içerik kişiselleştirme bölümü (v6.68 Faz 1) — yalnız Akışım + DOCTOR. */
  showSponsor: boolean;
  sponsorInitial: boolean;
  /** ⚖️ TASLAK açık rıza metni — sunucudan prop olarak gelir (kanonik: lib/sponsor.ts;
   *  client modülüne sabit gömülmez — RSC client-module veri-export tuzağından uzak dur). */
  sponsorText: string;
}

export function DoctoriumFilters(p: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Akış Tercihleri (Faz 2): [] = tümü → başlangıçta hepsi işaretli görünür.
  const feedAll = p.feedOptions.map((o) => o.key);
  const [feedMods, setFeedMods] = useState<Set<string>>(
    new Set(p.feedInitial.length ? p.feedInitial : feedAll)
  );
  const [savingFeed, setSavingFeed] = useState(false);
  const [feedMsg, setFeedMsg] = useState<string | null>(null);
  const feedInitialSet = p.feedInitial.length ? p.feedInitial : feedAll;
  const feedDirty =
    feedMods.size !== feedInitialSet.length || feedInitialSet.some((k) => !feedMods.has(k));

  const [branches, setBranches] = useState<Set<string>>(new Set(p.branchInitial));
  const [savingBranches, setSavingBranches] = useState(false);
  const [branchMsg, setBranchMsg] = useState<string | null>(null);
  const branchesDirty =
    branches.size !== p.branchInitial.length || [...branches].some((s) => !p.branchInitial.includes(s));

  const [start, setStart] = useState<number | null>(p.alertStart);
  const [abstractDays, setAbstractDays] = useState<number | null>(p.alertAbstract);
  const [earlyBird, setEarlyBird] = useState<number | null>(p.alertEarlyBird);
  const [savingAlerts, setSavingAlerts] = useState(false);

  const [sponsorOn, setSponsorOn] = useState(p.sponsorInitial);
  const [savingSponsor, setSavingSponsor] = useState(false);

  const activeRange = p.rangeOptions.find((r) => r.key === p.rangeKey)?.label;
  const activeCat = p.categoryOptions.find((c) => c.key === p.category)?.label;
  const alertsOn = start != null || abstractDays != null || earlyBird != null;

  // Bu modülde gösterilecek hiçbir ayar yoksa düğmeyi de çizme (ör. Akademik: aralık/kategori/
  // alarm yok) — boş panel açılmasın.
  const hasAnySection =
    p.showFeedPrefs || p.showRange || p.showCategory || p.showAlerts || p.showScope ||
    p.showEventTypes || p.showSourceScope || p.showSponsor || !!p.branchOptions;

  // Sektörel linklerinde üç filtre (kaynak · aralık · kategori) birbirini KORUR — biri
  // seçilirken diğerleri sıfırlanmasın (v6.99.3).
  const qs = (over: { s?: string | null; d?: string; c?: string | null }) => {
    const s = over.s !== undefined ? over.s : p.sourceScope;
    const d = over.d !== undefined ? over.d : p.rangeKey;
    const c = over.c !== undefined ? over.c : p.category;
    return `/doktor/doctorium?m=${p.module}&d=${d}${c ? `&c=${c}` : ""}${s ? `&s=${s}` : ""}`;
  };

  // Etkinlik sekmesinin İKİ filtresi (tür · kapsam) birbirini KORUR — birini değiştirmek
  // diğerini sıfırlamasın. (Sektörel'deki qs() ile aynı ders: v6.99.3'te orada öğrenildi.)
  const eventQs = (over: { s?: string | null; t?: string | null }) => {
    const s = over.s !== undefined ? over.s : p.scope;
    const t = over.t !== undefined ? over.t : (p.eventTypes == null ? "hepsi" : p.eventTypes.join(","));
    return `/doktor/doctorium?m=etkinlik${s ? `&s=${s}` : ""}${t ? `&t=${t}` : ""}`;
  };

  // Kapalı paneldeki özet: hangi ayarların etkin olduğu tek bakışta görünsün.
  const summary = [
    p.showFeedPrefs ? (feedMods.size === feedAll.length ? "tüm bölümler" : `${feedMods.size} bölüm`) : null,
    p.showSourceScope
      ? (p.sourceScope === "ulusal" ? "🇹🇷 ulusal kaynak" : p.sourceScope === "uluslararasi" ? "🌍 uluslararası kaynak" : "tüm kaynaklar")
      : null,
    p.showRange && activeRange ? activeRange : null,
    p.showCategory && activeCat ? activeCat : null,
    p.showEventTypes
      ? (p.eventTypes == null ? "tüm türler" : p.eventTypes.length === 1
          ? (p.eventTypeOptions.find((o) => o.key === p.eventTypes![0])?.label.toLocaleLowerCase("tr") ?? "1 tür")
          : `${p.eventTypes.length} tür`)
      : null,
    p.showScope
      ? (p.scope === "ulusal" ? "🇹🇷 ulusal"
        : p.scope === "uluslararasi" ? "🌍 uluslararası"
        : p.scope === "uluslararasi-katilimli" ? "🌍 uluslararası katılımlı"
        : "tüm kapsam")
      : null,
    p.branchOptions ? `${branches.size || "kendi"} branş` : null,
    p.showAlerts ? (alertsOn ? "alarm açık" : "alarm kapalı") : null,
    p.showSponsor ? (sponsorOn ? "sponsor: kişisel" : "sponsor: genel") : null,
  ].filter(Boolean).join(" · ");

  async function saveFeedModules() {
    setSavingFeed(true);
    setFeedMsg(null);
    try {
      const res = await fetch("/api/doctor/feed-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: [...feedMods] }),
      });
      if (!res.ok) throw new Error();
      setFeedMsg("Kaydedildi");
      router.refresh();
    } catch {
      setFeedMsg("Kaydedilemedi");
    } finally {
      setSavingFeed(false);
    }
  }

  async function saveBranches() {
    setSavingBranches(true);
    setBranchMsg(null);
    try {
      const res = await fetch("/api/doctor/news-branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branches: [...branches] }),
      });
      if (!res.ok) throw new Error();
      setBranchMsg("Kaydedildi");
      router.refresh();
    } catch {
      setBranchMsg("Kaydedilemedi");
    } finally {
      setSavingBranches(false);
    }
  }

  async function saveAlerts(next: {
    alertDays: number | null;
    abstractAlertDays: number | null;
    earlyBirdAlertDays: number | null;
  }) {
    setSavingAlerts(true);
    try {
      const res = await fetch("/api/doctor/congress-follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      /* durum değişmedi */
    } finally {
      setSavingAlerts(false);
    }
  }

  // v6.62: üç bağımsız eşik. Uç nokta üçünü BİRLİKTE yazdığı için değişmeyen ikisi de gönderilir
  // (kısmi gönderim diğerlerini null'a düşürürdü — sessiz alarm kapanması).
  function pickAlert(kind: "start" | "abstract" | "earlybird", days: number | null) {
    const next = {
      alertDays: kind === "start" ? days : start,
      abstractAlertDays: kind === "abstract" ? days : abstractDays,
      earlyBirdAlertDays: kind === "earlybird" ? days : earlyBird,
    };
    if (kind === "start") setStart(days);
    else if (kind === "abstract") setAbstractDays(days);
    else setEarlyBird(days);
    void saveAlerts(next);
  }

  // v6.68: kişiselleştirme AÇIK RIZASI — açarken rıza kaydı ispat zincirine yazılır (uçta
  // fail-closed: kayıt düşmezse açılmaz), kapatınca hedefleme derhâl durur (bağlamsal kartlara
  // düşülür; akış reklamsız OLMAZ — metinde de böyle anlatılır). Uç: /api/doctor/sponsor-consent.
  async function toggleSponsor() {
    const enable = !sponsorOn;
    setSavingSponsor(true);
    try {
      const res = await fetch("/api/doctor/sponsor-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable }),
      });
      if (!res.ok) throw new Error();
      setSponsorOn(enable);
      router.refresh();
    } catch {
      /* durum değişmedi */
    } finally {
      setSavingSponsor(false);
    }
  }

  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-1 text-[11px] transition ${
      on
        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
        : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]"
    }`;
  const sectionTitle = "text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]";

  if (!hasAnySection) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex w-full items-center gap-2 rounded-xl border border-[var(--c-hairline)] px-3.5 py-2 text-xs font-semibold text-[var(--c-ink-2)] hover:bg-[var(--c-surface)] sm:w-auto"
      >
        <SlidersHorizontal size={14} />
        Özelleştir
        {/* Özet mobilde GİZLİ (dar ekranda kesiliyordu — "sponsor…"); panel açılınca tüm
            ayarlar zaten görünür. 11px = mikro tip tabanı (2026-08-16 sadeleştirme turu). */}
        {summary && <span className="aura-mono hidden truncate text-[11px] font-normal text-[var(--c-ink-3)] sm:inline">{summary}</span>}
        {(branchesDirty || feedDirty) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-label="kaydedilmemiş değişiklik" />}
        <ChevronDown size={14} className={`ml-auto shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 grid gap-5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
          {/* AKIŞ TERCİHLERİ — panelin İLK sorusu (kullanıcı kararı 2026-08-14): Akışım'a hangi
              bölümler girsin. En az bir bölüm açık kalır (son çip kapatılamaz — boş akış anlamsız). */}
          {p.showFeedPrefs && (
            <section>
              <h3 className={`${sectionTitle} flex items-center gap-1.5`}>
                Akış tercihleri
                {savingFeed && <Loader2 size={11} className="animate-spin" />}
              </h3>
              <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">
                Akışınıza hangi bölümlerin içeriği girsin? Yeni eklenen kongre ve kariyer
                kayıtları da seçiliyse akışa kart olarak düşer.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.feedOptions.map((o) => {
                  const on = feedMods.has(o.key);
                  return (
                    <button
                      key={o.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setFeedMods((prev) => {
                          const n = new Set(prev);
                          if (n.has(o.key)) {
                            if (n.size === 1) return n; // son bölüm kapatılamaz
                            n.delete(o.key);
                          } else n.add(o.key);
                          return n;
                        });
                        setFeedMsg(null);
                      }}
                      className={`inline-flex items-center gap-1 ${chip(on)}`}
                    >
                      {on && <Check size={11} strokeWidth={3} />}
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {(feedDirty || feedMsg) && (
                <div className="mt-3 flex items-center gap-3">
                  {feedDirty && (
                    <button type="button" onClick={saveFeedModules} disabled={savingFeed}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3.5 py-1.5 text-xs font-semibold text-[#062a20] hover:bg-emerald-400 disabled:opacity-60">
                      {savingFeed && <Loader2 size={12} className="animate-spin" />} Tercihleri kaydet
                    </button>
                  )}
                  {feedMsg && <span className="text-[11px] text-[var(--c-ink-2)]">{feedMsg}</span>}
                </div>
              )}
            </section>
          )}

          {/* KAYNAK — sektörel panelinin İLK bölümü (kullanıcı isteği 2026-08-16): haberin
              geldiği kaynak ekseni. Değerler kongre kapsamıyla aynı (?s=), kaynak listeleri
              lib/doctorium SECTOR_SOURCE_SCOPES. */}
          {p.showSourceScope && (
            <section>
              <h3 className={sectionTitle}>Kaynak</h3>
              <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">
                Ulusal: TTB · OHSAD · İstanbul Tabip Odası — Uluslararası: Medscape · Medical
                Xpress · WHO.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(
                  [
                    [null, "Tümü"],
                    ["ulusal", "🇹🇷 Ulusal"],
                    ["uluslararasi", "🌍 Uluslararası"],
                  ] as const
                ).map(([key, label]) => (
                  <Link
                    key={label}
                    href={qs({ s: key })}
                    aria-current={p.sourceScope === (key ?? null) ? "true" : undefined}
                    className={chip(p.sourceScope === (key ?? null))}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {p.showRange && (
            <section>
              <h3 className={sectionTitle}>Geriye dönük</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {p.rangeOptions.map((r) => (
                  <Link
                    key={r.key}
                    href={qs({ d: r.key })}
                    aria-current={r.key === p.rangeKey ? "true" : undefined}
                    className={chip(r.key === p.rangeKey)}
                  >
                    {r.label}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {p.showCategory && (
            <section>
              <h3 className={sectionTitle}>Kategori</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Link
                  href={qs({ c: null })}
                  aria-current={!p.category ? "true" : undefined}
                  className={chip(!p.category)}
                >
                  Tümü
                </Link>
                {p.categoryOptions.map((c) => (
                  <Link
                    key={c.key}
                    href={qs({ c: c.key })}
                    aria-current={p.category === c.key ? "true" : undefined}
                    className={chip(p.category === c.key)}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* v6.120 — TÜR çipleri kapsamın ÜSTÜNDE: sekme 9 tür taşıyor, doktorun ilk daralttığı
              eksen bu. Çoklu seçim (çipe basmak ekler/çıkarır), "Hepsi" tek tıkla süzgeci kaldırır. */}
          {p.showEventTypes && (
            <section>
              <h3 className={sectionTitle}>Etkinlik türü</h3>
              <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">
                TTB'nin akredite etkinlik türleri. Varsayılan olarak kongre ve sempozyum listelenir;
                kurs, eğitim ve çalıştayları buradan açabilirsiniz.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Link
                  href={eventQs({ t: "hepsi" })}
                  aria-current={p.eventTypes == null ? "true" : undefined}
                  className={chip(p.eventTypes == null)}
                >
                  Hepsi
                </Link>
                {p.eventTypeOptions.map((o) => {
                  const on = p.eventTypes?.includes(o.key) ?? false;
                  // Seçili çipe basmak onu ÇIKARIR; son çip de çıkarılırsa sunucu varsayılana
                  // döner (parseEventTypes) — liste asla boş kalmaz.
                  const next = on
                    ? (p.eventTypes ?? []).filter((k) => k !== o.key)
                    : [...(p.eventTypes ?? []), o.key];
                  return (
                    <Link
                      key={o.key}
                      href={eventQs({ t: next.length ? next.join(",") : null })}
                      aria-current={on ? "true" : undefined}
                      className={chip(on)}
                    >
                      {o.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {p.showScope && (
            <section>
              <h3 className={sectionTitle}>Kapsam</h3>
              <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">
                Ulusal etkinlikler Türkiye ve KKTC'de yapılır; "uluslararası katılımlı" da yurt
                içindedir ama yabancı konuşmacı/katılımcı alır. Uluslararası = yurt dışı.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(
                  [
                    [null, "Tümü"],
                    ["ulusal", "🇹🇷 Ulusal"],
                    ["uluslararasi-katilimli", "🌍 Uluslararası katılımlı"],
                    ["uluslararasi", "🌍 Uluslararası"],
                  ] as const
                ).map(([key, label]) => (
                  <Link
                    key={label}
                    href={eventQs({ s: key })}
                    aria-current={p.scope === (key ?? null) ? "true" : undefined}
                    className={chip(p.scope === (key ?? null))}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {p.showAlerts && (
            <section>
              <h3 className={`${sectionTitle} flex items-center gap-1.5`}>
                {alertsOn ? <BellRing size={12} className="text-emerald-300" /> : <BellOff size={12} />}
                Etkinlik alarmı
                {savingAlerts && <Loader2 size={11} className="animate-spin" />}
              </h3>
              <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">
                Yalnız ⭐ ile takip ettiğiniz etkinlikler için gönderilir. Her eşik, o etkinliğin
                <strong className="font-semibold"> kendi tarihine</strong> uygulanır.
              </p>
              <div className="mt-2 grid gap-2.5">
                {(
                  [
                    ["start", start, "Etkinlik başlangıcı"],
                    ["abstract", abstractDays, "Bildiri son gönderim"],
                    ["earlybird", earlyBird, "Erken kayıt son tarihi"],
                  ] as const
                ).map(([kind, current, title]) => (
                  <div key={kind}>
                    <div className="text-[11px] text-[var(--c-ink-2)]">{title}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => pickAlert(kind, null)} aria-pressed={current == null}
                        className={chip(current == null)}>
                        Kapalı
                      </button>
                      {ALERT_OPTIONS.map((o) => (
                        <button key={o.days} type="button" onClick={() => pickAlert(kind, o.days)}
                          aria-pressed={current === o.days} className={chip(current === o.days)}>
                          {o.label} önce
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {p.branchOptions && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={sectionTitle}>Branş tercihleri</h3>
                <div className="flex items-center gap-3">
                  {/* v6.99.5 (kullanıcı isteği 2026-08-16): tek tıkla 30 branşın tamamı —
                      FARKLI renkte (menekşe) ki "Temizle"/kaydet yeşilinden ayrışsın. */}
                  {branches.size < p.branchOptions.length && (
                    <button
                      type="button"
                      onClick={() => { setBranches(new Set(p.branchOptions!.map((o) => o.slug))); setBranchMsg(null); }}
                      className="rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-300 transition hover:bg-violet-500/25"
                    >
                      Tüm branşları seç
                    </button>
                  )}
                  {branches.size > 0 && (
                    <button type="button" onClick={() => { setBranches(new Set()); setBranchMsg(null); }}
                      className="text-[11px] text-[var(--c-ink-3)] underline hover:text-[var(--c-ink)]">
                      Temizle
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">
                {p.module === "etkinlik"
                  ? "Etkinlik takvimi bu branşlara göre süzülür. Boş bırakırsanız kendi branşınız kullanılır."
                  : "Boş bırakırsanız akışınız kendi branşınıza göre oluşur."}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.branchOptions.map((o) => {
                  const on = branches.has(o.slug);
                  return (
                    <button
                      key={o.slug}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setBranches((prev) => {
                          const n = new Set(prev);
                          if (n.has(o.slug)) n.delete(o.slug);
                          else n.add(o.slug);
                          return n;
                        });
                        setBranchMsg(null);
                      }}
                      className={`inline-flex items-center gap-1 ${chip(on)}`}
                    >
                      {on && <Check size={11} strokeWidth={3} />}
                      {o.label}
                      {o.slug === p.ownBranchSlug && <span className="aura-mono text-[9px] text-[var(--c-ink-3)]">•</span>}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button type="button" onClick={saveBranches} disabled={savingBranches}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3.5 py-1.5 text-xs font-semibold text-[#062a20] hover:bg-emerald-400 disabled:opacity-60">
                  {savingBranches && <Loader2 size={12} className="animate-spin" />} Branşları kaydet
                </button>
                {branchMsg && <span className="text-[11px] text-[var(--c-ink-2)]">{branchMsg}</span>}
                <span className="ml-auto text-[10px] text-[var(--c-ink-3)]">• kendi branşınız</span>
              </div>
            </section>
          )}

          {p.showSponsor && (
            <section>
              <h3 className={`${sectionTitle} flex items-center gap-1.5`}>
                <Megaphone size={12} className={sponsorOn ? "text-emerald-300" : ""} />
                Sponsorlu içerik
                {savingSponsor && <Loader2 size={11} className="animate-spin" />}
              </h3>
              <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">
                Akışta &quot;Sponsorlu&quot; işaretli kartlar görünür. Kişiselleştirmeyi açarsanız bu
                kartlar branş/şehir profilinize göre seçilir; kapalıyken herkese aynı (genel)
                kartlar gösterilir. Profil verileriniz reklamverenlere aktarılmaz.
              </p>
              <details className="mt-1.5">
                <summary className="cursor-pointer text-[11px] text-[var(--c-ink-3)] underline hover:text-[var(--c-ink)]">
                  Açık rıza metni (taslak)
                </summary>
                <p className="mt-1.5 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface-2)] px-3 py-2 text-[11px] leading-relaxed text-[var(--c-ink-2)]">
                  {p.sponsorText}
                </p>
              </details>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => { if (sponsorOn) void toggleSponsor(); }}
                  disabled={savingSponsor} aria-pressed={!sponsorOn} className={chip(!sponsorOn)}>
                  Genel (rızasız)
                </button>
                <button type="button" onClick={() => { if (!sponsorOn) void toggleSponsor(); }}
                  disabled={savingSponsor} aria-pressed={sponsorOn} className={chip(sponsorOn)}>
                  Kişiselleştirilmiş — açık rıza veriyorum
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
