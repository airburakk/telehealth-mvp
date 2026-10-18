"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function WeeklyActions({ id, version, hash, status }: { id: string; version: string; hash: string; status: string }) {
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const router = useRouter();
  async function act(action: string) {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/icerik-takvimi/haftalik", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, id, version, hash, confirmed }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      setConfirmed(false); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "İşlem tamamlanamadı."); }
    finally { setBusy(false); }
  }
  return <div className="mt-6 space-y-3 text-sm text-[var(--c-ink)]">
    {status === "DRAFT" && <>
      <label className="flex items-start gap-3"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} className="mt-1" />
        <span>Bu haftanın tüm metinlerini, son görsellerini, videolarını, altyazılarını, hesaplarını ve Türkiye saatlerini inceledim. Hukuk içeriğinde taraf adı veya kimlik bilgisi bulunmadığını doğruladım; alıntıları ve “Doktor için çıkarım” maddelerini inceledim. Yalnız bu paketi onaylıyorum.</span></label>
      <button type="button" disabled={!confirmed || busy} onClick={() => act("approve")} className="rounded-lg bg-[var(--c-accent)] px-4 py-2 text-white disabled:opacity-40">{busy ? "Kaydediliyor…" : "Haftalık paketi onayla"}</button>
    </>}
    <button type="button" disabled={busy} onClick={() => act("revoke")} className="ml-3 rounded-lg border border-[var(--c-hairline)] px-4 py-2 disabled:opacity-40">{status === "REVOKED" ? "Yayın denemesi olmayan taslakları serbest bırak" : "Paketi geri çek"}</button>
    <p className="text-xs text-[var(--c-ink-3)]">Geri çekme bekleyen gönderileri durdurur. Alınmış veya sonucu belirsiz bir yayını platformdan silmez; bu sonuçlar ayrıca doğrulanmalıdır.</p>
    {error && <p role="alert" className="text-[var(--c-danger)]">{error}</p>}
  </div>;
}

export function DeliveryReconcile({ id, version }: { id: string; version: string }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState(""), [evidence, setEvidence] = useState(""), [platformId, setPlatformId] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/icerik-takvimi/haftalik", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reconcile", id, version, outcome, evidence, platformId }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Kontrol kaydedilemedi."); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Kontrol kaydedilemedi."); }
    finally { setBusy(false); }
  }
  return <details className="mt-2 text-xs"><summary className="cursor-pointer">Platformdaki sonucu doğrula</summary>
    <label className="mt-2 block">Kontrol sonucu<select value={outcome} onChange={e => setOutcome(e.target.value)} className="ml-2 border border-[var(--c-hairline)] bg-[var(--c-surface)] p-2"><option value="">Seçin</option><option value="FOUND">Yayın platformda bulundu</option><option value="NOT_FOUND">Yayın olmadığını platformda doğruladım</option></select></label>
    {outcome === "FOUND" && <label className="mt-2 block">Platform yayın kimliği<input value={platformId} onChange={e => setPlatformId(e.target.value)} maxLength={300} className="ml-2 border border-[var(--c-hairline)] bg-[var(--c-surface)] p-2" /></label>}
    <label className="mt-2 block">Kontrol kaydı<textarea value={evidence} onChange={e => setEvidence(e.target.value)} minLength={20} maxLength={500} placeholder="Hangi hesapta, ne zaman ve nasıl kontrol ettiniz?" className="mt-1 block w-full border border-[var(--c-hairline)] bg-[var(--c-surface)] p-2" /></label>
    <button type="button" disabled={busy || !outcome || evidence.trim().length < 20 || (outcome === "FOUND" && !platformId.trim())} onClick={submit} className="mt-2 rounded border border-[var(--c-hairline)] px-3 py-2 disabled:opacity-40">Kontrolü kaydet</button>
    <p className="mt-1">Bu işlem paylaşım yapmaz. Yeniden deneme yalnız aynı onaylı hesap, dosyalar ve yayın penceresinde mümkündür.</p>
    {error && <p role="alert" className="text-[var(--c-danger)]">{error}</p>}
  </details>;
}
