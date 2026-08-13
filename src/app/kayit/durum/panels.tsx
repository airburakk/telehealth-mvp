"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, FileCheck2, Send } from "lucide-react";
import type { StaffDocRequirement, StaffRoleConfig } from "@/lib/staff-application-config";
import { StaffFieldInput } from "@/components/StaffSignupForm";

// /kayit/durum client parçaları (2026-08-12): belge yükleme + REJECTED düzeltme formu.
// Sunucu işi yok — API uçları kendi self-auth'unu yapar; başarıda router.refresh ile sunucu
// bileşeni taze durumla yeniden çizilir.

export interface UploadedDocMeta {
  id: string;
  type: string;
  label: string;
  createdAt: string;
}

export function StaffDocsPanel({
  requirements,
  uploaded,
  locked,
}: {
  requirements: readonly StaffDocRequirement[];
  uploaded: UploadedDocMeta[];
  locked: boolean; // APPROVED: yükleme kapalı
}) {
  const router = useRouter();
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(type: string, file: File) {
    setError("");
    setBusyType(type);
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Dosya okunamadı."));
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/staff-applications/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, label: file.name, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Belge yüklenemedi.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Belge yüklenemedi.");
    } finally {
      setBusyType(null);
    }
  }

  return (
    <div className="space-y-3">
      {requirements.map((r) => {
        const doc = uploaded.find((d) => d.type === r.type);
        const busy = busyType === r.type;
        return (
          <div key={r.type} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--c-ink)]">{r.label}</div>
              {doc ? (
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-300">
                  <FileCheck2 size={13} /> <span className="truncate">{doc.label}</span>
                </div>
              ) : (
                <div className="mt-0.5 text-xs text-[var(--c-ink-3)]">Henüz yüklenmedi (PDF · JPEG · PNG)</div>
              )}
            </div>
            {!locked && (
              <>
                <input
                  ref={(el) => { inputs.current[r.type] = el; }}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(r.type, f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inputs.current[r.type]?.click()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--c-ink)] transition hover:border-[var(--c-accent)]/50 disabled:opacity-60"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {doc ? "Değiştir" : "Yükle"}
                </button>
              </>
            )}
          </div>
        );
      })}
      {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">{error}</div>}
    </div>
  );
}

// REJECTED başvuru düzeltme formu — yanıtlar prefill gelir, gönderim status'u PENDING'e döndürür.
export function StaffResubmitForm({
  config,
  initial,
}: {
  config: StaffRoleConfig;
  initial: Record<string, string | string[]>;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/staff-applications/resubmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Başvuru gönderilemedi.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Başvuru gönderilemedi.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {config.fields.map((f) => (
        <StaffFieldInput
          key={f.key}
          field={f}
          value={answers[f.key]}
          onChange={(v) => setAnswers((prev) => ({ ...prev, [f.key]: v }))}
        />
      ))}
      {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">{error}</div>}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Düzeltilmiş başvuruyu gönder
      </button>
    </form>
  );
}
