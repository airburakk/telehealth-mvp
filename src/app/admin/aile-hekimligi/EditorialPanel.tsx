"use client";

import { useCallback, useEffect, useState } from "react";
import { REPORT_WORKFLOWS, ASM_WORKFLOWS } from "@/lib/family-medicine-workflows";
import { FAMILY_MEDICINE_SOURCE_CANDIDATES } from "@/lib/family-medicine-source-candidates";

type Source = { url: string; version: string; locator: string; applicability: string; verifiedOn: string; effectiveFrom: string; effectiveUntil: string | null };
type Evidence = { sources: Source[]; nextReviewOn: string | null; sourceGap: string | null };
type ReviewEvent = { id: string; action: string; actorId: string; revision: number; createdAt: string; snapshotHash: string };
type Item = { sourceFingerprint?: string | null; sourceChanged?: boolean; sourceBlockers?: string[]; catalogChanged?: boolean; workflowId: string; revision: number; evidence: Evidence; clinicalById: string | null; clinicalAt: string | null; legalById: string | null; legalAt: string | null; updatedAt: string; events: ReviewEvent[] };
type Queue = { items: Item[]; grants: { clinical: boolean; legal: boolean } };
const WORKFLOWS = [...REPORT_WORKFLOWS, ...ASM_WORKFLOWS];
const ENDPOINT = "/api/admin/aile-hekimligi";
const emptySource = (): Source => ({ url: "", version: "", locator: "", applicability: "", verifiedOn: "", effectiveFrom: "", effectiveUntil: null });
const initialEvidence = (id: string): Evidence => ({ sources: [], nextReviewOn: null, sourceGap: WORKFLOWS.find(w => w.id === id)?.sourceGap ?? null });
const inputClass = "mt-1 w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)] disabled:opacity-50";
const buttonClass = "rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50";
const actionLabels: Record<string, string> = { SAVE: "Kanıt kaydı", REVIEW_CLINICAL: "Hekim incelemesi", REVIEW_LEGAL: "Hukuk incelemesi", REVOKE_CLINICAL: "Hekim onayı geri alındı", REVOKE_LEGAL: "Hukuk onayı geri alındı", "review:clinical": "Hekim incelemesi", "review:legal": "Hukuk incelemesi", "revoke:clinical": "Hekim onayı geri alındı", "revoke:legal": "Hukuk onayı geri alındı", save: "Kanıt kaydı", review: "İnceleme", revoke: "Onay geri alındı" };

async function fetchQueue(signal?: AbortSignal): Promise<Queue> {
  const res = await fetch(ENDPOINT, { cache: "no-store", signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.code === "SCHEMA_MISSING" ? "Editoryal veritabanı şeması henüz kurulmamış. Kayıt ve inceleme işlemleri kapalı; migration yetkili ortamda uygulanmalı. Bu ekran kurulum yapmaz." : body.error || "İnceleme kayıtları alınamadı.");
  if (!Array.isArray(body.items) || !body.grants) throw new Error("Sunucu yanıtı doğrulanamadı.");
  return body as Queue;
}

export function EditorialPanel() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [workflowId, setWorkflowId] = useState(WORKFLOWS[0].id);
  const [evidence, setEvidence] = useState<Evidence>(() => initialEvidence(WORKFLOWS[0].id));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<"clinical" | "legal" | null>(null);
  const item = queue?.items.find(i => i.workflowId === workflowId);
  const revision = item?.revision ?? 0;
  const sourceBlocked = !!item && (item.sourceChanged !== false || !Array.isArray(item.sourceBlockers) || item.sourceBlockers.length > 0);
  const reviewInvalid = !!item?.catalogChanged || sourceBlocked;
  const workflow = WORKFLOWS.find(w => w.id === workflowId)!;
  const disabled = loading || busy || blocked || !queue;

  const applyQueue = useCallback((data: Queue, id: string) => {
    setQueue(data); setEvidence(data.items.find(i => i.workflowId === id)?.evidence ?? initialEvidence(id));
    setDirty(false); setBlocked(false); setReviewConfirmed(false); setRevokeTarget(null); setError(null);
  }, []);
  const load = useCallback(async (id: string) => {
    try { applyQueue(await fetchQueue(), id); }
    catch (e) { setBlocked(true); setError(e instanceof Error ? e.message : "Kayıtlar yüklenemedi."); }
    finally { setLoading(false); }
  }, [applyQueue]);

  useEffect(() => {
    const controller = new AbortController();
    fetchQueue(controller.signal).then(data => {
      if (!controller.signal.aborted) { applyQueue(data, WORKFLOWS[0].id); setLoading(false); }
    }).catch(e => {
      if (!controller.signal.aborted) { setBlocked(true); setError(e instanceof Error ? e.message : "Kayıtlar yüklenemedi."); setLoading(false); }
    });
    return () => controller.abort();
  }, [applyQueue]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function edit(next: Evidence) { setEvidence(next); setDirty(true); setReviewConfirmed(false); setMessage(null); setError(null); }
  function updateSource(index: number, patch: Partial<Source>) { edit({ ...evidence, sources: evidence.sources.map((s, i) => i === index ? { ...s, ...patch } : s) }); }
  function selectWorkflow(id: string) {
    setWorkflowId(id); setEvidence(queue?.items.find(i => i.workflowId === id)?.evidence ?? initialEvidence(id));
    setDirty(false); setReviewConfirmed(false); setRevokeTarget(null); setMessage(null); setError(null);
  }
  async function mutate(action: "save" | "review" | "revoke", discipline?: "clinical" | "legal") {
    if (disabled) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, workflowId, expectedRevision: revision, ...(action === "save" ? { evidence } : { discipline }) }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) setBlocked(true);
        throw new Error(res.status === 409 ? "Bu kayıt başka bir işlemle değişti. Taslağınızı kontrol edin; sunucu kaydını yenilemeden tekrar kaydetmeyin." : body.error || "İşlem tamamlanamadı.");
      }
      if (body.ok !== true) throw new Error("İşlem sonucu doğrulanamadı. Sunucu kaydını yenileyin; işlemi tekrarlamayın.");
      await load(workflowId);
      setMessage(action === "save" ? "Kanıt sürümü kaydedildi; önceki inceleme onayları geçersizleştirildi. Yayın yapılmadı." : action === "review" ? "İnceleme kaydı oluşturuldu. Bu işlem yayın değildir." : "Seçilen inceleme onayı geri alındı.");
    } catch (e) {
      // A lost response can follow a committed transaction: refetch before any retry.
      setBlocked(true);
      setError(e instanceof TypeError ? "İşlemin sonucu doğrulanamadı. Sunucu kaydını yenileyin; işlemi tekrarlamayın." : e instanceof Error ? e.message : "İşlemin sonucu doğrulanamadı. Sunucu kaydını yenileyin; işlemi tekrarlamayın.");
    } finally { setBusy(false); setReviewConfirmed(false); setRevokeTarget(null); }
  }

  return (
    <div className="mt-6 space-y-5">
      <aside className="rounded-xl border border-amber-600/40 p-4 text-sm">Hasta adı, kimlik numarası, sağlık bilgisi veya hasta belgesi girmeyin. Alanlar yalnız kaynak ve genel mevzuat kanıtı içindir. İsim ve inceleme zamanı sunucudaki oturumdan alınır; başka biri adına onay girilemez.</aside>
      {error && <p role="alert" className="rounded-xl border border-[var(--c-danger)]/40 p-4 text-sm text-[var(--c-danger)]">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-[var(--c-accent)]/40 p-4 text-sm">{message}</p>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-semibold">İncelenecek başlık
          <select aria-label="İncelenecek başlık" className={inputClass} value={workflowId} disabled={loading || busy || dirty} onChange={e => selectWorkflow(e.target.value)}>{WORKFLOWS.map(w => <option value={w.id} key={w.id}>{w.kind === "asm" ? "ASM" : "Rapor"} · {w.title}</option>)}</select>
        </label>
        <button type="button" className={buttonClass} disabled={loading || busy || dirty} onClick={() => { setMessage(null); setError(null); setLoading(true); void load(workflowId); }}>Sunucu kaydını yenile</button>
        {dirty && <button type="button" className={buttonClass} disabled={busy} onClick={() => { setEvidence(item?.evidence ?? initialEvidence(workflowId)); setDirty(false); setMessage("Kaydedilmemiş değişiklikler bırakıldı."); }}>Kaydedilmemiş değişiklikleri bırak</button>}
      </div>
      <p className="text-xs text-[var(--c-ink-3)]">{loading ? "Kayıtlar yükleniyor…" : !queue ? "Sunucu durumu alınamadı; kayıt varlığı doğrulanmadı." : `Sunucu revizyonu: ${revision} · ${item ? "Kanıt kaydı mevcut" : "Henüz kayıt yok"}`}{dirty ? " · Kaydedilmemiş değişiklik var" : ""}</p>
      <section className="rounded-2xl border border-[var(--c-hairline)] p-5">
        <h2 className="text-xl font-semibold">{workflow.title}</h2>
        <p className="mt-2 text-sm text-[var(--c-ink-2)]">{workflow.summary}</p>
        <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Madde eşleştirme adayları · uzman incelemesi bekliyor</summary>
          <ul className="mt-3 space-y-3">{FAMILY_MEDICINE_SOURCE_CANDIDATES.filter(c => c.workflowId === workflowId).map((candidate, index) => <li key={`${candidate.url}-${index}`} className="rounded-lg border border-[var(--c-hairline)] p-3">
            <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--c-accent)] underline">{candidate.locator} ↗</a>
            <p className="mt-1">{candidate.scope}</p><p className="mt-1 text-xs">{candidate.version} · Gözlem: {candidate.observedOn}</p><p className="mt-1 text-xs text-[var(--c-ink-3)]">Bekleyen inceleme: {candidate.remainingReview}</p>
          </li>)}</ul>
          {!FAMILY_MEDICINE_SOURCE_CANDIDATES.some(c => c.workflowId === workflowId) && <p className="mt-2">Bu başlık için henüz madde eşleştirme adayı yok.</p>}
          <p className="mt-3 text-xs">Adaylar otomatik kaydedilmez ve onay değildir. Asıl metin ve uygulanabilirlik ayrıca incelenmelidir.</p>
        </details>
      </section>
      {item?.catalogChanged && <p role="alert" className="rounded-xl border border-amber-600/40 p-4 text-sm">Katalog değişti. Kaynak kanıtını yeniden kontrol edip kaydedin; ardından uzman incelemeleri yenilenmelidir.</p>}
      {sourceBlocked && <p role="alert" className="rounded-xl border border-amber-600/40 p-4 text-sm">Kaynakların teknik durumu bu incelemeyi desteklemiyor. Önceki onaylar yalnız tarihsel kayıttır; güncel onay sayılmaz. {item?.sourceChanged ? "Kaynak içeriği değişti veya henüz sürüme bağlanmadı; kanıtı yeniden inceleyip kaydedin. " : ""}{item?.sourceBlockers?.join(" ")}</p>}
      <form onSubmit={e => { e.preventDefault(); void mutate("save"); }} className="rounded-2xl border border-[var(--c-hairline)] p-5">
        <h2 className="text-lg font-semibold">Kaynak kanıtı</h2>
        <p className="mt-2 text-sm text-[var(--c-ink-2)]">Kaydetmek yeni revizyon oluşturur ve önceki hekim/hukuk onaylarını kaldırır. Kaynak adresi sunucu tarafından otomatik açılmaz.</p>
        <fieldset disabled={disabled} className="mt-4 space-y-5">
          {evidence.sources.map((source, index) => <section key={index} aria-label={`Kaynak ${index + 1}`} className="rounded-xl border border-[var(--c-hairline)] p-4">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Kaynak {index + 1}</h3><button type="button" className={buttonClass} onClick={() => edit({ ...evidence, sources: evidence.sources.filter((_, i) => i !== index) })}>Kaynağı kaldır</button></div>
            <label className="mt-3 block text-sm">HTTPS kaynak adresi<input required type="url" maxLength={2000} value={source.url} onChange={e => updateSource(index, { url: e.target.value })} className={inputClass} /></label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Kaynak sürümü<input required maxLength={200} value={source.version} onChange={e => updateSource(index, { version: e.target.value })} className={inputClass} /></label>
              <label className="text-sm">Madde / sayfa konumu<input required maxLength={300} value={source.locator} onChange={e => updateSource(index, { locator: e.target.value })} className={inputClass} /></label>
            </div>
            <label className="mt-3 block text-sm">Uygulanabilir kapsam ve istisnalar<textarea required rows={3} maxLength={2000} value={source.applicability} onChange={e => updateSource(index, { applicability: e.target.value })} className={inputClass} /></label>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">Kaynak kontrol tarihi<input required type="date" value={source.verifiedOn} onChange={e => updateSource(index, { verifiedOn: e.target.value })} className={inputClass} /></label>
              <label className="text-sm">Yürürlük başlangıcı<input required type="date" value={source.effectiveFrom} onChange={e => updateSource(index, { effectiveFrom: e.target.value })} className={inputClass} /></label>
              <label className="text-sm">Yürürlük bitişi (varsa)<input type="date" value={source.effectiveUntil ?? ""} onChange={e => updateSource(index, { effectiveUntil: e.target.value || null })} className={inputClass} /></label>
            </div>
          </section>)}
          <button type="button" className={buttonClass} disabled={disabled || evidence.sources.length >= 10} onClick={() => edit({ ...evidence, sources: [...evidence.sources, emptySource()] })}>Kaynak ekle</button>
          <label className="block text-sm">Eksik kaynak / inceleme açıklaması<textarea rows={3} maxLength={2000} value={evidence.sourceGap ?? ""} onChange={e => edit({ ...evidence, sourceGap: e.target.value || null })} className={inputClass} /></label>
          <label className="block text-sm">Yeniden inceleme tarihi<input type="date" value={evidence.nextReviewOn ?? ""} onChange={e => edit({ ...evidence, nextReviewOn: e.target.value || null })} className={inputClass} /></label>
          <button type="submit" className={`${buttonClass} bg-[var(--c-accent)] text-[var(--c-bg)]`} disabled={disabled || (!dirty && !item?.catalogChanged && !item?.sourceChanged)}>{busy ? "İşleniyor…" : "Kanıt taslağını kaydet"}</button>
        </fieldset>
      </form>
      <section className="rounded-2xl border border-[var(--c-hairline)] p-5">
        <h2 className="text-lg font-semibold">Ayrı uzman incelemeleri</h2>
        <p className="mt-2 text-sm text-[var(--c-ink-2)]">İnceleme düğmesi yalnız sunucuda açıkça yetkilendirilmiş hesaplarda çalışır. Onay, mevcut revizyon için kaydedilir. Bu panel yayın yetkisi vermez.</p>
        <dl className="mt-3 space-y-2 text-sm">
          <div><dt className="font-semibold">Hekim incelemesi</dt><dd>{item?.clinicalAt ? `${item.clinicalById} · ${item.clinicalAt}${reviewInvalid ? " · Geçerli değil; yeniden inceleme gerekli" : ""}` : queue ? "Bekliyor" : "Durum doğrulanamadı"}</dd></div>
          <div><dt className="font-semibold">Hukuk incelemesi</dt><dd>{item?.legalAt ? `${item.legalById} · ${item.legalAt}${reviewInvalid ? " · Geçerli değil; yeniden inceleme gerekli" : ""}` : queue ? "Bekliyor" : "Durum doğrulanamadı"}</dd></div>
        </dl>
        <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewConfirmed} disabled={disabled || dirty || !item || reviewInvalid || !(queue?.grants.clinical || queue?.grants.legal)} onChange={e => setReviewConfirmed(e.target.checked)} /><span>Kaydedilmiş bu revizyonu ve kaynak maddelerini kendi uzmanlık yetkim kapsamında bizzat inceledim.</span></label>
        <div className="mt-3 flex flex-wrap gap-2">{(["clinical", "legal"] as const).map(discipline => <button type="button" key={discipline} className={buttonClass} disabled={disabled || dirty || !item || reviewInvalid || !reviewConfirmed || !queue?.grants[discipline]} onClick={() => void mutate("review", discipline)}>{discipline === "clinical" ? "Hekim incelemesini kaydet" : "Hukuk incelemesini kaydet"}</button>)}</div>
        {!queue?.grants.clinical && !queue?.grants.legal && <p className="mt-2 text-xs text-[var(--c-ink-3)]">Bu hesapta uzman inceleme yetkisi tanımlı değil. Yönetici rolü tek başına yeterli değildir.</p>}
        <div className="mt-4 flex flex-wrap gap-2">{(["clinical", "legal"] as const).map(discipline => <button type="button" key={discipline} className={buttonClass} disabled={disabled || dirty || !(discipline === "clinical" ? item?.clinicalAt : item?.legalAt)} onClick={() => setRevokeTarget(discipline)}>{discipline === "clinical" ? "Hekim onayını geri al" : "Hukuk onayını geri al"}</button>)}</div>
        {revokeTarget && <div className="mt-3 rounded-lg border border-[var(--c-danger)]/40 p-3 text-sm"><p>{revokeTarget === "clinical" ? "Hekim" : "Hukuk"} inceleme onayını geri almak üzeresiniz. İşlem denetim kaydına yazılır.</p><div className="mt-2 flex gap-2"><button type="button" className={buttonClass} disabled={disabled} onClick={() => void mutate("revoke", revokeTarget)}>Geri almayı onayla</button><button type="button" className={buttonClass} onClick={() => setRevokeTarget(null)}>Vazgeç</button></div></div>}
      </section>
      <section className="rounded-2xl border border-[var(--c-hairline)] p-5">
        <h2 className="text-lg font-semibold">Denetim geçmişi</h2>
        <p className="mt-2 text-xs text-[var(--c-ink-3)]">Son 300 editoryal işlem içinden bu başlığa ait kayıtlar gösterilir. Aktör, zaman, revizyon ve kayıt özeti sunucudan gelir. Yalnız genel kaynak kanıtı girilmelidir; hasta bilgisi girmeyin.</p>
        {!queue ? <p className="mt-3 text-sm">Denetim geçmişi okunamadı.</p> : !item?.events.length ? <p className="mt-3 text-sm">Henüz işlem kaydı yok.</p> : <ol className="mt-3 space-y-3">{item.events.map(event => <li key={event.id} className="break-words rounded-lg border border-[var(--c-hairline)] p-3 text-xs"><p className="font-semibold">{actionLabels[event.action] ?? event.action} · Revizyon {event.revision}</p><p className="mt-1">Hesap: {event.actorId} · {event.createdAt}</p><p className="mt-1 break-all">Kayıt özeti: {event.snapshotHash}</p></li>)}</ol>}
      </section>
    </div>
  );
}
