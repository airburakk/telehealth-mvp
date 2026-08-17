"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck, Check, FileText, GraduationCap, Landmark, Loader2, Megaphone, Trash2, Upload, UserSearch, ArrowRight, Info,
} from "lucide-react";
// (GraduationCap: alttaki /ogrenci yönlendirme satırında kullanılır)
import type { DocMeta } from "@/components/DoctorDocuments";

// İki aşamalı giriş — AŞAMA 1 bölümü (v6.87): tabip odası "Protokol Numaralı" üye yazısı
// (CHAMBER, /api/doctor/documents) + iki İSTEĞE BAĞLI rıza (sponsor kişiselleştirme + İK iletişim;
// toggle ANINDA API'ye yazılır — Doctorium'a "finish"siz geçilebildiği için form-sonu kaydı olmaz).
// Rıza TAM metinleri server page'den prop gelir: lib/sponsor.ts + lib/hr-consent.ts `db` import
// ettiğinden client bundle'a giremez (RSC client-module dersi).
// v6.95: öğrenci yolu AYRI huniye taşındı (/ogrenci + StudentStage1Card — kullanıcı kararı
// 2026-08-14): bu formda öğrenci belgesi kartı YOK, yalnız /ogrenci'ye yönlendirme satırı var.

const ACCEPT = "application/pdf,image/jpeg,image/png";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("Dosya okunamadı."));
    fr.readAsDataURL(file);
  });
}

export function Stage1Doctorium({
  initialChamberDoc,
  initialAccess,
  initialSponsor,
  initialHr,
  sponsorText,
  hrText,
  fromDoctorium,
}: {
  initialChamberDoc: DocMeta | null;
  initialAccess: boolean; // Doctorium erişimi (yazı VEYA klinik aktivasyon)
  initialSponsor: boolean;
  initialHr: boolean;
  sponsorText: string;
  hrText: string;
  fromDoctorium: boolean;
}) {
  const [chamberDoc, setChamberDoc] = useState<DocMeta | null>(initialChamberDoc);
  const [access, setAccess] = useState(initialAccess);
  const [busy, setBusy] = useState(false);
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
        body: JSON.stringify({ type: "CHAMBER", label: file.name, content }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Yüklenemedi.");
      setChamberDoc({ id: d.id, type: d.type, label: d.label, mimeType: d.mimeType });
      setAccess(!!d.doctorium);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!chamberDoc) return;
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(`/api/doctor/documents?id=${encodeURIComponent(chamberDoc.id)}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Silinemedi.");
      setChamberDoc(null);
      setAccess(!!d.doctorium); // klinik aktivasyonu tam olan doktorda erişim yazı silinse de sürer
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  const ok = !!chamberDoc;
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 text-sm font-bold text-[var(--c-ink)]">
        {/* 🪤 Lockup'ı SATIR KIRMA: JSX'te "Doctor" ile <span>ium</span> arasına düşen satır
            sonu boşluğa dönüşür ve marka "Doctor ium" diye kopuk çizilir (kullanıcı bulgusu
            2026-08-17). Metin + span TEK satırda kalmalı; sığmıyorsa {" "}/{""} ile yönet. */}
        <BookOpenCheck size={16} className="text-[var(--c-accent-strong)]" />
        <span>Aşama 1 — Doctor<span className="doctorium-ium">ium</span> Üyeliği</span>
      </div>
      <p className="mt-1 text-xs text-[var(--c-ink-2)]">
        Tabip odanızdan aldığınız <strong>Protokol Numaralı üye yazısını</strong> yükleyin;
        Doctor<span className="doctorium-ium">ium</span> erişiminiz anında açılır — bu aşamada
        sizden istenen TEK belge budur, klinik belgelerinizi beklemez.
      </p>

      {/* Doctorium'dan yönlendirilen doktor için bağlam bandı (?from=doctorium) */}
      {fromDoctorium && !access && (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs font-medium text-amber-300 ring-1 ring-amber-400/20">
          <Info size={14} className="shrink-0" /> Doctorium&apos;a erişmek için Aşama 1&apos;i tamamlayın: tabip odası üye yazınızı yükleyin.
        </p>
      )}

      {/* Tabip odası yazısı kartı — DoctorDocuments kart dili (tekil belge; yeni yükleme eskisini değiştirir) */}
      <div className={`mt-3 rounded-3xl border p-4 ${ok ? "border-emerald-400/25 bg-emerald-500/10" : "border-amber-400/25 bg-amber-500/10"}`}>
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${ok ? "bg-emerald-500 text-white" : "bg-amber-400 text-white"}`}>
            {ok ? <Check size={18} /> : <Landmark size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--c-ink)]">
              Tabip Odası Üye Yazısı (Protokol Numaralı)
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Aşama 1</span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--c-ink-2)]">
              Bağlı olduğunuz tabip odasından alınmış, protokol numarası görünen üye yazısı
            </p>
            {chamberDoc && (
              <ul className="mt-2 space-y-1">
                <li className="flex items-center justify-between gap-2 rounded-lg bg-[var(--c-panel)] px-3 py-1.5 text-xs ring-1 ring-[var(--c-hairline)]">
                  <span className="flex min-w-0 items-center gap-1.5 text-[var(--c-ink-2)]">
                    <FileText size={13} className="shrink-0 text-[var(--c-ink-3)]" />
                    <span className="truncate">{chamberDoc.label}</span>
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

      {/* v6.95 — öğrenci hunisi AYRIŞTI: bu formda öğrenci belgesi kartı yok, yalnız yönlendirme */}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--c-ink-3)]">
        <GraduationCap size={14} className="shrink-0" />
        Tıp öğrencisi misiniz?{" "}
        <Link href="/ogrenci" className="font-semibold text-[var(--c-accent-stronger)] hover:underline">
          Öğrenci üyeliğine gidin
        </Link>
      </p>

      {/* İsteğe bağlı rızalar — toggle ANINDA kaydedilir, her an geri alınabilir */}
      <div className="mt-4 space-y-4">
        <ConsentCard
          endpoint="/api/doctor/sponsor-consent"
          initial={initialSponsor}
          icon={<Megaphone size={18} />}
          title="Sponsorlu içerik kişiselleştirmesi"
          desc="Doctorium akışındaki sponsorlu kartların branş ve şehrinize göre seçilmesine izin verin. İsteğe bağlıdır: vermezseniz sponsorlu içerik herkese gösterilen (hedefsiz) biçimde görünür. Doctorium → Özelleştir'den her an değiştirebilirsiniz."
          fullText={sponsorText}
        />
        <ConsentCard
          endpoint="/api/doctor/hr-consent"
          initial={initialHr}
          icon={<UserSearch size={18} />}
          title="İş fırsatları için iletişim izni"
          desc="İnsan kaynakları uzmanlarının iş ve kariyer fırsatları için sizinle iletişime geçmesine izin verin. İsteğe bağlıdır; hizmet şartı değildir."
          fullText={hrText}
        />
      </div>

      {err && <p className="mt-3 text-center text-sm text-red-300">{err}</p>}

      {/* Doctorium çıkışı — erişim açıksa (yazı VEYA klinik aktivasyon) */}
      {access && (
        <Link
          href="/doktor/doctorium"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--c-accent)]/40 bg-[var(--c-accent)]/[0.08] px-4 py-3 text-sm font-semibold text-[var(--c-accent-stronger)] hover:bg-[var(--c-accent)]/[0.14]"
        >
          Doctorium&apos;a git <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

// Rıza kartı: özet + <details> içinde ConsentRecord'a yazılan TAM metin (KVKK bilgilendirme —
// ekranda gösterilen metin zincire yazılanla AYNI olmalı ki ispat tutarlı kalsın).
function ConsentCard({
  endpoint,
  initial,
  icon,
  title,
  desc,
  fullText,
}: {
  endpoint: string;
  initial: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  fullText: string;
}) {
  const [active, setActive] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function toggle() {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: !active }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      setActive(!!d.enabled);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-3xl border p-5 transition ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)]/[0.06]" : "border-[var(--c-hairline)] bg-[var(--c-panel)]"}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${active ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "bg-[var(--c-ink)]/10 text-[var(--c-ink-3)]"}`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--c-ink)]">{title}</span>
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              aria-pressed={active}
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition disabled:opacity-50 ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-transparent hover:border-[var(--c-accent)]/60"}`}
              aria-label={title}
            >
              {busy ? <Loader2 size={12} className="animate-spin text-[var(--c-ink-3)]" /> : <Check size={14} />}
            </button>
          </div>
          <p className="mt-1 text-xs text-[var(--c-ink-2)]">{desc}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-medium text-[var(--c-ink-3)] hover:text-[var(--c-ink-2)]">Metnin tamamı</summary>
            <p className="mt-1.5 rounded-xl bg-[var(--c-surface)] px-3 py-2 text-[11px] leading-relaxed text-[var(--c-ink-2)]">{fullText}</p>
          </details>
          {err && <p className="mt-1.5 text-xs text-red-300">{err}</p>}
        </div>
      </div>
    </div>
  );
}
