"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck, GraduationCap, Megaphone, UserSearch, ArrowRight, Info, Check, Loader2,
} from "lucide-react";
import { DoctorDocuments, type DocMeta } from "@/components/DoctorDocuments";
import { EdevletKilavuz } from "@/components/EdevletKilavuz";

// İki aşamalı giriş — AŞAMA 1 bölümü (v6.124 yeniden tasarım; kullanıcı kararı 2026-08-19):
// Doctorium kapısı e-DEVLET DOĞRULAMALI DİPLOMA'dır (tek doktor yolu; öğrenci yolu ayrı). Diploma
// kartı DoctorDocuments'ın onaylı v6.122 arayüzüyle (durum rozetleri + e-Devlet sonucu mesajı)
// çizilir; altında EdevletKilavuz (belge nasıl alınır — tıkla-aç). Erişim durumu SUNUCU kararından
// (POST/DELETE dönüşündeki `doctorium`) güncellenir. İki İSTEĞE BAĞLI rıza (sponsor + İK) aynen:
// toggle ANINDA API'ye yazılır. Rıza TAM metinleri server page'den prop gelir (RSC client-module
// dersi). v6.95: öğrenci yolu AYRI hunidedir (/ogrenci) — burada yalnız yönlendirme satırı var.

export interface Stage1Props {
  initialDiplomaDoc: DocMeta | null;
  initialAccess: boolean; // Doctorium erişimi (doğrulanmış diploma ∨ öğrenci damgası)
  initialSponsor: boolean;
  initialHr: boolean;
  sponsorText: string;
  hrText: string;
  fromDoctorium: boolean;
}

export function Stage1Doctorium({
  initialDiplomaDoc,
  initialAccess,
  initialSponsor,
  initialHr,
  sponsorText,
  hrText,
  fromDoctorium,
  onDiplomaChange,
}: Stage1Props & {
  // Diploma dosyası var mı (onboarding finish kapısının girdisi — OnboardingForm docsReady).
  onDiplomaChange?: (hasDiploma: boolean) => void;
}) {
  const [access, setAccess] = useState(initialAccess);

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
        e-Devlet&apos;ten aldığınız <strong>barkodlu Mezun Belgenizi (diploma)</strong> yükleyin;
        belge doğrulanınca Doctor<span className="doctorium-ium">ium</span> üyeliğiniz açılır — bu
        aşamada sizden istenen TEK belge budur, klinik tanımlarınızı beklemez.
      </p>

      {/* Doctorium'dan yönlendirilen doktor için bağlam bandı (?from=doctorium) */}
      {fromDoctorium && !access && (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs font-medium text-amber-300 ring-1 ring-amber-400/20">
          <Info size={14} className="shrink-0" /> Doctorium&apos;a erişmek için Aşama 1&apos;i tamamlayın: e-Devlet barkodlu diplomanızı yükleyin.
        </p>
      )}

      {/* Diploma kartı — DoctorDocuments'ın onaylı arayüzü (v6.122 rozetleri + e-Devlet sonucu).
          initialMmss boş sabittir: MMSS formu yalnız MMSS kartında çizilir, bu örnek DIPLOMA-only. */}
      <div className="mt-3">
        <DoctorDocuments
          types={["DIPLOMA"]}
          initialDocs={initialDiplomaDoc ? [initialDiplomaDoc] : []}
          initialMmss={{ insurer: null, coverageLimit: null, currency: null, validUntil: null, policyNoSet: false }}
          onActivationChange={onDiplomaChange}
          onDoctoriumChange={setAccess}
        />
      </div>

      {/* Belge nasıl alınır — tıkla-aç kılavuz (taslağı kullanıcı onayladı, 2026-08-19) */}
      <EdevletKilavuz />

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

      {/* Doctorium çıkışı — erişim açıksa (doğrulanmış diploma ∨ öğrenci damgası) */}
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
            {/* v6.211: aydınlatma ile rıza ayrı işlemlerdir — kutunun yanında aydınlatmaya erişim (belge 08 §2.3). */}
            <p className="mt-1.5 text-[11px] text-[var(--c-ink-3)]">
              Ayrıntılı bilgi: <a href="/doctorium/aydinlatma" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-[var(--c-ink-2)]">Aydınlatma Metni</a>
            </p>
          </details>
          {err && <p className="mt-1.5 text-xs text-red-300">{err}</p>}
        </div>
      </div>
    </div>
  );
}
