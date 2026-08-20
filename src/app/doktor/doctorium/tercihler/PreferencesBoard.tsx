"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Megaphone } from "lucide-react";

/**
 * Akış Tercihleri panosu — T1 KATLANIR LİSTE (v6.132, kullanıcı seçimi 2026-08-20).
 *
 * 🔄 SÜPERSEDE: ilk sürüm üç seviyeli sekmeydi (grup → bölüm sekmesi → alt sekme) ve
 * kullanıcı "dizilim hoşuma gitmedi" dedi. Teşhis: sayfanın işi "akışının TÜMÜNÜ kendin kur"
 * ama üç seviye aynı anda tek bölüm gösteriyordu — kendi kurulumunu görmek için gezinmek
 * gerekiyordu. T1 gezinmeyi SIFIRA indirir: iki grup başlığı altında altı bölüm alt alta,
 * ayrıntılı ayarlar satır içinde açılır. Alternatifler artifact'te karşılaştırıldı
 * (T2 kontrol masası · T3 ayarlar dizini).
 *
 * KAYIT: her ayar değiştiği anda kendi ucuna yazılır. Çok tıklamalı listeler (branş, tür)
 * 800 ms geciktirilir; anahtarlar ve seçiciler anında gider.
 *
 * ⚠️ Taksonomi lib/doctorium PREF_GROUPS'ta da var (sunucu tarafı). Bu bileşen CLIENT
 * olduğu için oradan import EDEMEZ (db bağımlılığı) — yapı burada tekrar edilir.
 * İkisini BİRLİKTE güncelle. Bkz. [[rsc-client-module-data-export]].
 */

type Extra = "brans" | "hukuk" | "etkinlik" | null;
type Section = { key: string; nm: string; desc: string; feedKey: string | null; extra: Extra };
type Group = { key: string; nm: string; desc: string; sections: Section[] };

const GROUPS: Group[] = [
  {
    key: "klinik", nm: "Klinik", desc: "Hasta başındaki işinizi besleyen bilgi.",
    sections: [
      { key: "akademik", nm: "Akademik", feedKey: "akademik", extra: "brans",
        desc: "PubMed, Europe PMC ve DOAJ'dan hakemli yayınlar; branş seçiminize göre süzülür." },
      { key: "sektorel", nm: "Sektörel", feedKey: "sektorel", extra: null,
        desc: "Doktor hakları, sağlık yönetimi, teknoloji ve küresel gündem." },
      { key: "ilac", nm: "İlaç & Cihaz", feedKey: "ilac", extra: null,
        desc: "Ruhsat ve geri çekme duyuruları, klinik faz sonuçları, dijital prospektüs." },
    ],
  },
  {
    key: "mesleki", nm: "Mesleki", desc: "Mesleğinizi çevreleyen çerçeve.",
    sections: [
      { key: "hukuk", nm: "Hukuk", feedKey: null, extra: "hukuk",
        desc: "Üç kaynağı ayrı ayrı yönetebilirsiniz — biri kapalıyken diğerleri akışta kalır." },
      { key: "etkinlik", nm: "Etkinlik", feedKey: "etkinlik", extra: "etkinlik",
        desc: "Kongre, sempozyum ve kurslar; bildiri ve erken kayıt tarihleriyle." },
      { key: "kariyer", nm: "Kariyer", feedKey: "kariyer", extra: null,
        desc: "Yurt dışı denklik ve akademik yükselme süreçleri — ilan değil, süreç bilgisi." },
    ],
  },
];

const HUKUK_SUBS = [
  { key: "hukuk-mevzuat", nm: "Mevzuat", desc: "Resmî Gazete ve OHSAD kayıtları; yürürlük tarihleriyle." },
  { key: "hukuk-ictihat", nm: "İçtihat", desc: "Sağlık hukuku ve malpraktis konulu Yargıtay kararları." },
  { key: "hukuk-doktrin", nm: "Doktrin", desc: "TR-Dizin'de taranan hakemli hukuk makaleleri." },
];

const ALERTS = [
  { days: 0, label: "Kapalı" }, { days: 1, label: "1 gün" }, { days: 3, label: "3 gün" },
  { days: 7, label: "1 hafta" }, { days: 14, label: "2 hafta" }, { days: 30, label: "1 ay" },
];

const SCOPES = [
  { key: "", label: "Tümü" },
  { key: "ulusal", label: "Ulusal" },
  { key: "uluslararasi", label: "Uluslararası" },
];

const ALL_FEED_KEYS = GROUPS.flatMap((g) =>
  g.sections.flatMap((s) => (s.extra === "hukuk" ? HUKUK_SUBS.map((x) => x.key) : s.feedKey ? [s.feedKey] : []))
);

interface Props {
  feedInitial: string[];
  branchOptions: { slug: string; label: string }[];
  branchInitial: string[];
  ownBranchSlug: string | null;
  alertStart: number | null;
  alertAbstract: number | null;
  alertEarlyBird: number | null;
  eventTypeOptions: { key: string; label: string }[];
  /** null = varsayılan (kongre + sempozyum); "hepsi" = tür süzgeci kapalı. */
  eventTypesInitial: string[] | null;
  scopeInitial: string | null;
  showSponsor: boolean;
  sponsorInitial: boolean;
  sponsorText: string;
}

type Status = { state: "idle" | "saving" | "saved" | "error"; msg?: string };

export function PreferencesBoard(p: Props) {
  const [open, setOpen] = useState<string | null>(null);

  const [feed, setFeed] = useState<Set<string>>(
    new Set(p.feedInitial.length ? p.feedInitial : ALL_FEED_KEYS)
  );
  const [feedSt, setFeedSt] = useState<Status>({ state: "idle" });

  const [branches, setBranches] = useState<Set<string>>(new Set(p.branchInitial));
  const [brSt, setBrSt] = useState<Status>({ state: "idle" });

  const [alerts, setAlerts] = useState({
    start: p.alertStart ?? 0, abstract: p.alertAbstract ?? 0, earlyBird: p.alertEarlyBird ?? 0,
  });
  const [evTypes, setEvTypes] = useState<Set<string>>(
    new Set(p.eventTypesInitial ?? ["kongre", "sempozyum"])
  );
  const [scope, setScope] = useState(p.scopeInitial ?? "");
  const [evSt, setEvSt] = useState<Status>({ state: "idle" });

  const [sponsor, setSponsor] = useState(p.sponsorInitial);
  const [spSt, setSpSt] = useState<Status>({ state: "idle" });

  async function post(url: string, body: unknown, set: (s: Status) => void) {
    set({ state: "saving" });
    try {
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Kaydedilemedi.");
      set({ state: "saved" });
      setTimeout(() => set({ state: "idle" }), 2200);
    } catch (e) {
      set({ state: "error", msg: e instanceof Error ? e.message : "Kaydedilemedi." });
    }
  }

  function toggleFeed(key: string) {
    const next = new Set(feed);
    if (next.has(key)) next.delete(key); else next.add(key);
    if (next.size === 0) { setFeedSt({ state: "error", msg: "En az bir bölüm açık kalmalı." }); return; }
    setFeed(next);
    void post("/api/doctor/feed-modules", { modules: [...next] }, setFeedSt);
  }

  // Çok tıklamalı listeler tek yazımda toplanır (branş ~35, tür 9).
  const brTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brFirst = useRef(true);
  useEffect(() => {
    if (brFirst.current) { brFirst.current = false; return; }
    if (brTimer.current) clearTimeout(brTimer.current);
    brTimer.current = setTimeout(
      () => void post("/api/doctor/news-branches", { branches: [...branches] }, setBrSt), 800);
    return () => { if (brTimer.current) clearTimeout(brTimer.current); };
  }, [branches]);

  const evTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evFirst = useRef(true);
  useEffect(() => {
    if (evFirst.current) { evFirst.current = false; return; }
    if (evTimer.current) clearTimeout(evTimer.current);
    evTimer.current = setTimeout(() => void post("/api/doctor/congress-follow", {
      alertDays: alerts.start || null,
      abstractAlertDays: alerts.abstract || null,
      earlyBirdAlertDays: alerts.earlyBird || null,
      // Tümü seçiliyse "hepsi" yazılır — URL sözleşmesiyle aynı dil (lib/doctorium parseEventTypes).
      eventTypes: evTypes.size === p.eventTypeOptions.length ? "hepsi" : [...evTypes],
      scope: scope || null,
    }, setEvSt), 800);
    return () => { if (evTimer.current) clearTimeout(evTimer.current); };
  }, [alerts, evTypes, scope, p.eventTypeOptions.length]);

  const ownLabel = p.branchOptions.find((b) => b.slug === p.ownBranchSlug)?.label;
  const branchSorted = [
    ...p.branchOptions.filter((b) => b.slug === p.ownBranchSlug),
    ...p.branchOptions.filter((b) => b.slug !== p.ownBranchSlug)
      .sort((a, b) => a.label.localeCompare(b.label, "tr")),
  ];

  return (
    <div className="mt-8">
      {GROUPS.map((g) => {
        const keys = g.sections.flatMap((s) =>
          s.extra === "hukuk" ? HUKUK_SUBS.map((x) => x.key) : s.feedKey ? [s.feedKey] : []);
        const live = keys.filter((k) => feed.has(k)).length;
        return (
          <section key={g.key} className="mt-9 first:mt-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 border-emerald-400/70 pb-2">
              <h2 className="aura-display text-[19px] font-semibold tracking-tight text-[var(--c-ink)]">{g.nm}</h2>
              <p className="flex-1 text-[13px] text-[var(--c-ink-3)]">{g.desc}</p>
              <span className="aura-mono text-[11px] text-[var(--c-ink-3)]">{live}/{keys.length} açık</span>
            </div>

            {g.sections.map((s) => {
              const isOpen = open === s.key;
              // Hukuk'un kendi anahtarı yok: alt kaynaklardan biri açıksa "açık" sayılır.
              const on = s.feedKey ? feed.has(s.feedKey) : HUKUK_SUBS.some((x) => feed.has(x.key));
              return (
                <div key={s.key} className="border-b border-[var(--c-hairline)] py-4">
                  <div className="flex items-start gap-3.5">
                    {s.feedKey ? (
                      <Switch on={on} onChange={() => toggleFeed(s.feedKey!)} label={`${s.nm} akışıma dahil olsun`} />
                    ) : (
                      // Hukuk satırında tek anahtar YOK — üç alt kaynak ayrı yönetilir; burada
                      // yalnız durum göstergesi durur (yanıltıcı bir "hepsini kapat" üretmemek için).
                      <span
                        aria-hidden="true"
                        className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                          on ? "bg-emerald-400" : "bg-[var(--c-ink-3)]"
                        }`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-semibold text-[var(--c-ink)]">{s.nm}</div>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--c-ink-3)]">{s.desc}</p>
                      {s.extra && (
                        <button
                          type="button"
                          onClick={() => setOpen(isOpen ? null : s.key)}
                          aria-expanded={isOpen}
                          className="aura-mono mt-2 inline-flex items-center gap-1 text-[10.5px] font-semibold tracking-wider text-emerald-300 hover:text-emerald-200"
                        >
                          {isOpen ? "AYARLARI GİZLE" : "AYARLARI GÖSTER"}
                          <ChevronDown size={12} className={isOpen ? "rotate-180" : ""} />
                        </button>
                      )}
                    </div>
                  </div>

                  {s.extra && isOpen && (
                    <div className="mt-4 sm:pl-[52px]">
                      {s.extra === "brans" && (
                        <Block title="Branş tercihleri"
                          hint={`Yayın akışınız bu branşlara göre süzülür; seçim etkinlik takviminde de geçerlidir. Hiçbiri seçili değilse profilinizdeki branş${ownLabel ? ` (${ownLabel})` : ""} kullanılır.`}>
                          <Chips
                            items={branchSorted.map((b) => ({ key: b.slug, label: b.label, tag: b.slug === p.ownBranchSlug ? "KENDİ" : undefined }))}
                            selected={branches}
                            onToggle={(k) => {
                              const n = new Set(branches);
                              if (n.has(k)) n.delete(k); else n.add(k);
                              setBranches(n);
                            }}
                          />
                          <StatusLine status={brSt} idle={`${branches.size} branş seçili`} />
                        </Block>
                      )}

                      {s.extra === "hukuk" && (
                        <div className="grid gap-3.5">
                          {HUKUK_SUBS.map((x) => (
                            <div key={x.key} className="flex items-start gap-3.5">
                              <Switch on={feed.has(x.key)} onChange={() => toggleFeed(x.key)} label={`${x.nm} akışıma dahil olsun`} />
                              <div className="min-w-0">
                                <div className="text-[13.5px] font-semibold text-[var(--c-ink)]">{x.nm}</div>
                                <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--c-ink-3)]">{x.desc}</p>
                              </div>
                            </div>
                          ))}
                          <StatusLine status={feedSt} idle="Üçü bağımsız — biri kapalıyken diğerleri akışta kalır" />
                        </div>
                      )}

                      {s.extra === "etkinlik" && (
                        <>
                          <Block title="Etkinlik türleri"
                            hint="Yalnız seçtiğiniz türler akışınıza ve takviminize girer.">
                            <Chips
                              items={p.eventTypeOptions.map((t) => ({ key: t.key, label: t.label }))}
                              selected={evTypes}
                              onToggle={(k) => {
                                const n = new Set(evTypes);
                                if (n.has(k)) n.delete(k); else n.add(k);
                                if (n.size === 0) return; // en az bir tür açık kalsın
                                setEvTypes(n);
                              }}
                            />
                          </Block>
                          <Block title="Kapsam" hint="Yurt içi ve yurt dışı etkinlikler.">
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {SCOPES.map((sc) => (
                                <button
                                  key={sc.key || "tumu"}
                                  type="button"
                                  onClick={() => setScope(sc.key)}
                                  aria-pressed={scope === sc.key}
                                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                                    scope === sc.key
                                      ? "bg-emerald-500/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35)]"
                                      : "bg-[var(--c-surface)] text-[var(--c-ink-3)] hover:text-[var(--c-ink)]"
                                  }`}
                                >
                                  {sc.label}
                                </button>
                              ))}
                            </div>
                          </Block>
                          <Block title="Hatırlatma eşikleri"
                            hint="Takip ettiğiniz etkinlikler için üç ayrı eşik; kapalı bırakılan eşikte bildirim gönderilmez.">
                            <div className="mt-2 grid gap-3 sm:grid-cols-3">
                              {([["start", "Etkinlik başlangıcı"], ["abstract", "Bildiri son tarihi"],
                                 ["earlyBird", "Erken kayıt son tarihi"]] as const).map(([kind, label]) => (
                                <label key={kind} className="block">
                                  <span className="block text-[11.5px] text-[var(--c-ink-3)]">{label}</span>
                                  <select
                                    value={alerts[kind]}
                                    onChange={(e) => setAlerts({ ...alerts, [kind]: Number(e.target.value) })}
                                    className="mt-1 w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--c-ink)] outline-none focus:border-emerald-400/50"
                                  >
                                    {ALERTS.map((o) => <option key={o.days} value={o.days}>{o.label}</option>)}
                                  </select>
                                </label>
                              ))}
                            </div>
                          </Block>
                          <StatusLine status={evSt} idle="Tür, kapsam ve eşikler birlikte kaydedilir" />
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}

      {/* Sponsorlu içerik rızası — ikili grubun DIŞINDA: içerik tercihi değil, RIZA kaydı. */}
      {p.showSponsor && (
        <section className="mt-9 border-t border-[var(--c-hairline)] pt-6">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--c-ink)]">
            <Megaphone size={15} className="text-amber-300" /> Sponsorlu içerik kişiselleştirmesi
          </h2>
          <p className="mt-2 max-w-[70ch] text-[12.5px] leading-relaxed text-[var(--c-ink-2)]">{p.sponsorText}</p>
          <div className="mt-3 flex items-start gap-3.5">
            <Switch
              on={sponsor}
              tone="amber"
              onChange={() => {
                const next = !sponsor;
                setSponsor(next);
                void post("/api/doctor/sponsor-consent", { consent: next }, setSpSt);
              }}
              label="Kişiselleştirilmiş sponsorlu içerik"
            />
            <div>
              <div className="text-[13.5px] font-medium text-[var(--c-ink)]">
                Branşıma ve ilime göre kişiselleştirilmiş sponsorlu içerik görmek istiyorum
              </div>
              <StatusLine status={spSt}
                idle={sponsor ? "Açık — rızanızı istediğiniz zaman geri alabilirsiniz" : "Kapalı — hedefsiz içerik görürsünüz"} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/** Anahtar — kaydırmalı düğme; renk tonu sponsor bloğunda amber, kalanında zümrüt. */
function Switch({
  on, onChange, label, tone = "emerald",
}: { on: boolean; onChange: () => void; label: string; tone?: "emerald" | "amber" }) {
  const c = tone === "amber" ? "amber" : "emerald";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full border transition ${
        on
          ? c === "amber"
            ? "border-amber-400/45 bg-amber-500/15"
            : "border-emerald-400/45 bg-emerald-500/15"
          : "border-[var(--c-hairline)] bg-[var(--c-surface-2)]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-[2px] left-[2px] h-4 w-4 rounded-full transition-transform ${
          on
            ? `translate-x-4 ${c === "amber" ? "bg-amber-300" : "bg-emerald-400"}`
            : "bg-[var(--c-ink-3)]"
        }`}
      />
    </button>
  );
}

function Block({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <h3 className="text-[12.5px] font-semibold text-[var(--c-ink)]">{title}</h3>
      <p className="mt-0.5 max-w-[66ch] text-[12px] leading-relaxed text-[var(--c-ink-3)]">{hint}</p>
      {children}
    </div>
  );
}

function Chips({
  items, selected, onToggle,
}: {
  items: { key: string; label: string; tag?: string }[];
  selected: Set<string>;
  onToggle: (k: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((it) => {
        const on = selected.has(it.key);
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onToggle(it.key)}
            aria-pressed={on}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition ${
              on
                ? "bg-emerald-500/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35)]"
                : "bg-[var(--c-surface)] text-[var(--c-ink-3)] hover:text-[var(--c-ink)]"
            }`}
          >
            {on && <Check size={11} />}
            {it.label}
            {it.tag && <span className="aura-mono text-[9.5px] text-[var(--c-ink-3)]">{it.tag}</span>}
          </button>
        );
      })}
    </div>
  );
}

function StatusLine({ status, idle }: { status: Status; idle: string }) {
  if (status.state === "saving") {
    return <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-[var(--c-ink-3)]">
      <Loader2 size={11} className="animate-spin" /> Kaydediliyor…</p>;
  }
  if (status.state === "saved") {
    return <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-300">
      <Check size={11} /> Kaydedildi</p>;
  }
  if (status.state === "error") return <p className="mt-2 text-[11.5px] text-rose-300">{status.msg}</p>;
  return <p className="mt-2 text-[11.5px] text-[var(--c-ink-3)]">{idle}</p>;
}
