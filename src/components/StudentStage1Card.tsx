"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, GraduationCap, Loader2, Mail } from "lucide-react";

// v6.95 — Tıp/Diş Hekimliği öğrencisi onboarding kartı (/doktor/baslangic öğrenci modu).
// Stage1Doctorium'un öğrenci eşleniği ama BİLİNÇLİ AYRI bileşen: öğrenci hunisinde doktor
// belgeleri (diploma/MMSS) ve rıza kartları HİÇ render edilmez (kullanıcı kararı
// 2026-08-14). "Mezun oldum" düğmesi studentTrack'i kapatır → sayfa yenilenince normal doktor
// onboarding'i (diploma+MMSS blokları) açılır; öğrenci damgası ve geçmişi korunur.
//
// v6.147 (kullanıcı kararı 2026-08-23) — MEKANİZMA DEĞİŞTİ: eskiden burada bir belge yükleme
// formu vardı (STUDENT_CERT). Artık kapı üniversite (.edu.tr) e-postasının kayıtta zaten
// domain-eşleşmesinden geçmiş olması + o adrese giden bağlantının TIKLANMASI — bu kart yalnız
// o doğrulamanın DURUMUNU gösterir, yükleme/silme aksiyonu YOK (aksiyon e-posta istemcisinde).

export function StudentStage1Card({
  email,
  university,
  department,
  initialAccess,
}: {
  email: string;
  university: string | null; // Doctor.studentUniversity — kayıtta seçilen (domain zaten doğrulanmış)
  department: string | null; // "tip" | "dis-hekimligi"
  initialAccess: boolean; // Doctorium erişimi (studentVerifiedAt damgası)
}) {
  const [gradBusy, setGradBusy] = useState(false);
  const [err, setErr] = useState("");

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

  const deptLabel = department === "dis-hekimligi" ? "Diş Hekimliği" : "Tıp";

  return (
    <div>
      <div className={`rounded-3xl border p-4 ${initialAccess ? "border-emerald-400/25 bg-emerald-500/10" : "border-amber-400/25 bg-amber-500/10"}`}>
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${initialAccess ? "bg-emerald-500 text-white" : "bg-amber-400 text-white"}`}>
            {initialAccess ? <Check size={18} /> : <Mail size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[var(--c-ink)]">Üniversite E-postası</div>
            {university && (
              <p className="mt-0.5 text-xs text-[var(--c-ink-2)]">
                {university} — {deptLabel}
              </p>
            )}
            {initialAccess ? (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--c-ink-2)]">
                <span className="font-medium text-emerald-300">Doğrulandı.</span> Üniversite
                e-postanız (<span className="text-[var(--c-ink)]">{email}</span>) onaylandı,
                Doctorium içerikleri açık.
              </p>
            ) : (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--c-ink-2)]">
                <span className="text-[var(--c-ink)]">{email}</span> adresine bir doğrulama
                bağlantısı gönderdik. Gelen kutunuzu (ve spam klasörünü) kontrol edip bağlantıya
                tıklayın — Doctorium içerikleri o anda açılır.
              </p>
            )}
          </div>
        </div>
      </div>

      {err && <p className="mt-3 text-center text-sm text-red-300">{err}</p>}

      {initialAccess && (
        <Link
          href="/doktor/doctorium"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--c-accent)]/40 bg-[var(--c-accent)]/[0.08] px-4 py-3 text-sm font-semibold text-[var(--c-accent-stronger)] hover:bg-[var(--c-accent)]/[0.14]"
        >
          Doctorium&apos;a git <ArrowRight size={16} />
        </Link>
      )}

      {/* Mezuniyet çıkışı — öğrenci modunda kilitli kalınmaz */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-4 py-3">
        <span className="text-xs text-[var(--c-ink-2)]">Mezun mu oldunuz? Diplomanızla doktor üyeliğine geçin.</span>
        <button
          type="button"
          onClick={graduate}
          disabled={gradBusy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-xs font-semibold text-[var(--c-ink-2)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent-stronger)] disabled:opacity-50"
        >
          {gradBusy ? <Loader2 size={13} className="animate-spin" /> : <GraduationCap size={13} />} Mezun oldum
        </button>
      </div>
    </div>
  );
}
