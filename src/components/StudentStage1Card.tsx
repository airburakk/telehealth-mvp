"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FileText, GraduationCap, Loader2, Trash2, Upload } from "lucide-react";
import type { DocMeta } from "@/components/DoctorDocuments";

// v6.95 — Tıp öğrencisi onboarding kartı (/doktor/baslangic öğrenci modu). Stage1Doctorium'un
// öğrenci eşleniği ama BİLİNÇLİ AYRI bileşen: öğrenci hunisinde hekim belgeleri (diploma/MMSS/
// tabip odası) ve rıza kartları HİÇ render edilmez (kullanıcı kararı 2026-08-14). Tek belge:
// e-Devlet öğrenci belgesi (STUDENT_CERT) → yükleme anında Doctorium içerik erişimi açılır.
// "Mezun oldum" düğmesi studentTrack'i kapatır → sayfa yenilenince normal doktor onboarding'i
// (diploma+MMSS blokları) açılır; öğrenci damgası ve belge geçmişi korunur.

const ACCEPT = "application/pdf,image/jpeg,image/png";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("Dosya okunamadı."));
    fr.readAsDataURL(file);
  });
}

export function StudentStage1Card({
  initialStudentDoc,
  eduEmail,
  initialAccess,
}: {
  initialStudentDoc: DocMeta | null;
  eduEmail: boolean; // akademik e-posta rozeti (.edu.tr/.edu/.ac.xx) — yalnız görsel sinyal
  initialAccess: boolean; // Doctorium erişimi (öğrenci belgesi damgası)
}) {
  const [doc, setDoc] = useState<DocMeta | null>(initialStudentDoc);
  const [access, setAccess] = useState(initialAccess);
  const [busy, setBusy] = useState(false);
  const [gradBusy, setGradBusy] = useState(false);
  const [err, setErr] = useState("");

  async function upload(file: File | null) {
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const content = await fileToDataUrl(file);
      const r = await fetch("/api/doctor/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "STUDENT_CERT", label: file.name, content }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Yüklenemedi.");
      setDoc({ id: d.id, type: d.type, label: d.label, mimeType: d.mimeType });
      setAccess(!!d.doctorium);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!doc) return;
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(`/api/doctor/documents?id=${encodeURIComponent(doc.id)}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Silinemedi.");
      setDoc(null);
      setAccess(!!d.doctorium);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  // Mezuniyet geçişi: studentTrack kapanır → normal doktor onboarding'i (diploma/MMSS) açılır.
  async function graduate() {
    setErr("");
    setGradBusy(true);
    try {
      const r = await fetch("/api/doctor/graduate", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "İşlem başarısız.");
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
      setGradBusy(false);
    }
  }

  const ok = !!doc;
  return (
    <div>
      <div className={`rounded-3xl border p-4 ${ok ? "border-emerald-400/25 bg-emerald-500/10" : "border-amber-400/25 bg-amber-500/10"}`}>
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${ok ? "bg-emerald-500 text-white" : "bg-amber-400 text-white"}`}>
            {ok ? <Check size={18} /> : <GraduationCap size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--c-ink)]">
              Öğrenci Belgesi
              {eduEmail && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  <Check size={10} /> Üniversite e-postası
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--c-ink-2)]">
              e-Devlet&apos;ten aldığınız güncel öğrenci belgesi — yüklediğiniz anda Doctorium erişiminiz açılır
            </p>
            {doc && (
              <ul className="mt-2 space-y-1">
                <li className="flex items-center justify-between gap-2 rounded-lg bg-[var(--c-panel)] px-3 py-1.5 text-xs ring-1 ring-[var(--c-hairline)]">
                  <span className="flex min-w-0 items-center gap-1.5 text-[var(--c-ink-2)]">
                    <FileText size={13} className="shrink-0 text-[var(--c-ink-3)]" />
                    <span className="truncate">{doc.label}</span>
                  </span>
                  <button onClick={remove} disabled={busy} className="shrink-0 text-[var(--c-ink-3)] hover:text-red-300 disabled:opacity-50" aria-label="Kaldır">
                    <Trash2 size={14} />
                  </button>
                </li>
              </ul>
            )}
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-1.5 text-xs font-medium text-[var(--c-ink-2)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent-stronger)]">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {ok ? "Değiştir" : "Dosya yükle"}
              <input type="file" accept={ACCEPT} className="hidden" disabled={busy}
                onChange={(e) => { upload(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </label>
            <span className="ml-2 text-[10px] text-[var(--c-ink-3)]">PDF / JPG / PNG · ~8 MB&apos;a kadar</span>
          </div>
        </div>
      </div>

      {err && <p className="mt-3 text-center text-sm text-red-300">{err}</p>}

      {access && (
        <Link
          href="/doktor/doctorium"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--c-accent)]/40 bg-[var(--c-accent)]/[0.08] px-4 py-3 text-sm font-semibold text-[var(--c-accent-stronger)] hover:bg-[var(--c-accent)]/[0.14]"
        >
          Doctorium&apos;a git <ArrowRight size={16} />
        </Link>
      )}

      {/* Mezuniyet çıkışı — öğrenci modunda kilitli kalınmaz */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-4 py-3">
        <span className="text-xs text-[var(--c-ink-2)]">Mezun mu oldunuz? Diploma ve MMSS poliçenizle doktor üyeliğine geçin.</span>
        <button
          type="button"
          onClick={graduate}
          disabled={gradBusy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-xs font-semibold text-[var(--c-ink-2)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent-stronger)] disabled:opacity-50"
        >
          {gradBusy ? <Loader2 size={13} className="animate-spin" /> : null} Mezun oldum
        </button>
      </div>
    </div>
  );
}
