"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import type { FirsatAdayi } from "@/lib/social-calendar/ogrenci";
import type { PlanItemView } from "@/lib/social-calendar/plan";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { BTN_PRIMARY, BTN_SECOND, INPUT, api, type ApiResult } from "./client-shared";

// Öğrenci köşesi fırsat seçicisi (v6.349, 2026-10-12 — 👤 "fırsat seçici · en çok 3 · dönemseller notuyla"). EtkinlikSecici deseni: adaylar her
// açılışta TAZE gelir (`opportunity-candidates`, salt okuma) — yalnız onaylı Kariyer EDU fırsatları; tarihliler (son başvurusu yayın günü ya da
// sonrası) üstte, dönemseller altta. Editör EN FAZLA 3 fırsat seçer → `pick-opportunities` taslağı üretir. Yalnız --c-* token'ları.
const TUM = "__tum__";

type Adaylar = ApiResult & { adaylar?: FirsatAdayi[]; enCok?: number };

export function FirsatSecici({
  item,
  editable,
  busy,
  run,
  onPicked,
}: {
  item: PlanItemView;
  editable: boolean;
  busy: string;
  run: (label: string, body: Record<string, unknown>, onOk: (r: ApiResult) => void) => Promise<void>;
  onPicked: (r: ApiResult) => void;
}) {
  const hasSource = item.sourceIds.length > 0;
  const [adaylar, setAdaylar] = useState<FirsatAdayi[] | null>(null);
  const [enCok, setEnCok] = useState(3);
  const [hata, setHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [acik, setAcik] = useState(!hasSource);
  const [secili, setSecili] = useState<string[]>(item.sourceIds);
  const [tur, setTur] = useState(TUM);
  const [ara, setAra] = useState("");

  const al = (r: Adaylar) => {
    if (r.ok && r.adaylar) {
      setAdaylar(r.adaylar);
      if (r.enCok) setEnCok(r.enCok);
    } else setHata(r.error ?? "Fırsatlar getirilemedi.");
  };

  async function getir() {
    setYukleniyor(true);
    setHata("");
    const r = (await api({ action: "opportunity-candidates", id: item.id })) as Adaylar;
    setYukleniyor(false);
    al(r);
  }

  // Panel açıkken adaylar kendiliğinden gelir; düğmeyle yenilenir.
  useEffect(() => {
    if (!acik || adaylar !== null) return;
    let iptal = false;
    void (async () => {
      const r = (await api({ action: "opportunity-candidates", id: item.id })) as Adaylar;
      if (iptal) return;
      if (r.ok && r.adaylar) {
        setAdaylar(r.adaylar);
        if (r.enCok) setEnCok(r.enCok);
      } else setHata(r.error ?? "Fırsatlar getirilemedi.");
    })();
    return () => {
      iptal = true;
    };
  }, [acik, adaylar, item.id]);

  const turler = useMemo(() => {
    const m = new Map<string, { etiket: string; n: number }>();
    for (const a of adaylar ?? []) m.set(a.kind, { etiket: a.turEtiketi, n: (m.get(a.kind)?.n ?? 0) + 1 });
    return [...m.entries()].sort((x, y) => y[1].n - x[1].n);
  }, [adaylar]);

  const gorunen = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase("tr-TR");
    return (adaylar ?? []).filter((a) => (tur === TUM || a.kind === tur) && (!q || `${a.title} ${a.organizer}`.toLocaleLowerCase("tr-TR").includes(q)));
  }, [adaylar, tur, ara]);

  const toggle = (id: string) => setSecili((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= enCok ? s : [...s, id]));
  const degisti = JSON.stringify([...secili].sort()) !== JSON.stringify([...item.sourceIds].sort());

  function taslakOlustur() {
    if (hasSource && !window.confirm("Seçim değişirse slaytlar ve altyazı seçilen fırsatlardan yeniden üretilir (elle yaptığınız düzenlemeler sıfırlanır). Devam edilsin mi?")) return;
    void run("pick-opportunities", { action: "pick-opportunities", opportunityIds: secili }, (r) => {
      onPicked(r);
      setAcik(false);
    });
  }

  return (
    <AuraPanel
      title="Fırsatlar"
      meta={hasSource ? `${item.sourceIds.length} fırsat seçili` : "seçilmedi"}
      action={
        editable && (
          <div className="flex gap-2">
            {hasSource && (
              <button type="button" onClick={() => setAcik((v) => !v)} className={BTN_SECOND}>
                {acik ? "Listeyi gizle" : "Seçimi değiştir"}
              </button>
            )}
            {acik && (
              <button type="button" onClick={getir} disabled={yukleniyor || busy !== ""} className={BTN_SECOND}>
                {yukleniyor ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Yenile
              </button>
            )}
          </div>
        )
      }
    >
      {hasSource && !acik && (
        <p className="text-sm text-[var(--c-ink-2)]">{item.payload?.sources.map((s) => s.label).join(" · ") || `${item.sourceIds.length} fırsat seçildi.`}</p>
      )}

      {acik && (
        <>
          <p className="mb-3 text-xs text-[var(--c-ink-3)]">
            Kariyer EDU&apos;daki onaylı fırsatlar: son başvurusu yayın günü ya da sonrasında olanlar üstte, takvimi dönemsel olanlar altta (slaytta kaydın dönem
            notu yazar). Başvurusu kapanmış fırsat listelenmez. En çok {enCok} fırsat seçin — her biri bir slayt olur.
          </p>
          {hata && <p className="mb-3 text-sm text-[var(--c-danger)]">{hata}</p>}
          {adaylar === null && !hata && (
            <p className="flex items-center gap-2 text-sm text-[var(--c-ink-2)]">
              <Loader2 size={14} className="animate-spin" /> Fırsatlar getiriliyor…
            </p>
          )}
          {adaylar !== null && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {[[TUM, { etiket: "Tümü", n: adaylar.length }] as const, ...turler].map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTur(k)}
                    className={`rounded-full border px-3 py-1 text-xs ${tur === k ? "border-[var(--c-accent)] text-[var(--c-accent)]" : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)]"}`}
                  >
                    {v.etiket} <span className="aura-mono text-[var(--c-ink-3)]">{v.n}</span>
                  </button>
                ))}
                <label className="relative ml-auto min-w-[14rem] flex-1 sm:flex-none">
                  <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-ink-3)]" />
                  <input value={ara} onChange={(e) => setAra(e.target.value)} placeholder="Ad ya da kurum ara" aria-label="Fırsatlarda ara" className={`${INPUT} pl-8`} />
                </label>
              </div>

              {gorunen.length === 0 ? (
                <p className="text-sm text-[var(--c-ink-2)]">{adaylar.length === 0 ? "Onaylı ve başvurusu açık fırsat kaydı yok." : "Süzgece uyan fırsat yok."}</p>
              ) : (
                <ul className="grid gap-2">
                  {gorunen.map((a) => {
                    const sec = secili.includes(a.id);
                    const dolu = !sec && secili.length >= enCok;
                    return (
                      <li key={a.id} className={`rounded-2xl border p-3 ${sec ? "border-[var(--c-accent)] bg-[var(--c-accent)]/5" : "border-[var(--c-hairline)] bg-[var(--c-surface)]"}`}>
                        <label className={`flex gap-3 ${dolu || !editable ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                          <input type="checkbox" checked={sec} disabled={dolu || !editable} onChange={() => toggle(a.id)} className="mt-1 h-4 w-4 accent-[var(--c-accent)]" />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-sm font-semibold text-[var(--c-ink)]">{a.title}</span>
                              {a.sonBasvuru && <span className="aura-mono text-xs text-[var(--c-ink-3)]">{a.sonBasvuru.split("-").reverse().join(".")}</span>}
                            </span>
                            <span className="mt-0.5 block text-xs text-[var(--c-ink-2)]">
                              {a.organizer} · {a.ulke}
                            </span>
                            <span className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                              <span className="rounded-full border border-[var(--c-accent)]/40 px-2 py-0.5 text-[var(--c-accent)]">{a.turEtiketi}</span>
                              {a.sonBasvuru ? (
                                <span className="rounded-full border border-[var(--c-warning)]/40 px-2 py-0.5 text-[var(--c-warning)]">son başvuru tarihli</span>
                              ) : (
                                <span className="rounded-full border border-[var(--c-hairline)] px-2 py-0.5 text-[var(--c-ink-2)]">dönemsel</span>
                              )}
                              {a.kullanildi && <span className="rounded-full border border-[var(--c-hairline)] px-2 py-0.5 text-[var(--c-ink-3)]">{a.kullanildi} yuvasında kullanıldı</span>}
                            </span>
                            <span className="mt-1.5 block text-xs text-[var(--c-ink-2)]">{a.takvim}</span>
                            <span className="mt-1 block text-xs text-[var(--c-ink-3)]">{a.eligibility}</span>
                          </span>
                          <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="self-start text-[var(--c-ink-3)] hover:text-[var(--c-accent)]" aria-label={`${a.title} resmî sayfası`}>
                            <ExternalLink size={14} />
                          </a>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              {editable && (
                <div className="sticky bottom-3 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-bg)]/95 px-4 py-3 backdrop-blur">
                  <span className="text-sm text-[var(--c-ink-2)]">
                    <span className="font-semibold text-[var(--c-ink)]">{secili.length}</span> / {enCok} seçili
                  </span>
                  <button type="button" onClick={taslakOlustur} disabled={busy !== "" || secili.length === 0 || !degisti} className={BTN_PRIMARY}>
                    {busy === "pick-opportunities" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{" "}
                    {hasSource ? "Seçimle taslağı yeniden üret" : `Seçilen ${secili.length || ""} fırsatla taslak oluştur`}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </AuraPanel>
  );
}
