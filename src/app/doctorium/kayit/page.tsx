import type { Metadata } from "next";
import Link from "next/link";
import { isGoogleConfigured, isAppleConfigured } from "@/lib/oauth";
import { BRANCH_LABELS } from "@/lib/procedures";
import { DoctorSignupForm } from "@/components/DoctorSignupForm";
import { DoctoriumSignupShell } from "@/components/aura/doctorium-signup-shell";

export const dynamic = "force-dynamic";

// Doctorium doktor kaydı (ayrışma Faz B, 2026-08-24) — landing "Doctorium'unu oluştur"
// CTA'sının hedefi. AURA kromlu /kayit'ın Doctorium sarmalayıcısı: AYNI form + AYNI
// /api/auth/signup akışı (hesap modeli ortak — teknik çekirdek ayrışmadı), yalnız görünüm
// Doctorium (zümrüt küre + vurgular, koyu kapı zemini, giriş linkleri Doctorium kapısına).
// Segment layout'u sekmeye "Kayıt · Doctorium" + zümrüt ikonu verir.
//
// ⚠️ Bu sayfada AURA/klinik-havuz anlatımı BİLİNÇLİ YOK (ayrışma kararı): alt kutu yalnız
// Doctorium üyeliğinin kendi adımlarını anlatır. Klinik aktivasyon (Aşama 2) AURA tarafının
// yüzeylerinde yaşar. İddia disiplini: "e-Devlet doğrulamalı diploma" GERÇEK akış (v6.124-130).
export const metadata: Metadata = {
  title: "Kayıt",
  description: "Doctorium doktor üyeliği — branşınıza göre kurulan kişisel profesyonel çalışma alanınızı oluşturun.",
  alternates: { canonical: "/doctorium/kayit" },
};

export default function DoctoriumSignupPage() {
  const branches = Object.values(BRANCH_LABELS).sort((a, b) => a.localeCompare(b, "tr"));
  return (
    <DoctoriumSignupShell>
      {/* Suspense YOK (2026-08-28 denetimi): bkz. src/app/kayit/page.tsx aynı not — sayfa zaten
          force-dynamic, streaming DOM-taşıma mekanizması headless/arka-plan sekmelerde takılıyordu. */}
      <DoctorSignupForm googleEnabled={isGoogleConfigured()} appleEnabled={isAppleConfigured()} branches={branches} brand="doctorium" />

      {/* KVKK aydınlatma-toplama-anı + sözleşme onayı (2026-09-04): submit'in hemen altında görünür
          inline bilgilendirme (footer linkleri yeterli değildi — QA bulgusu). Açık rıza AYRICA
          /onam'da alınır; bu satır yalnız bilgilendirmedir — sözleşme/çerez KABUL, aydınlatma
          BİLGİLENDİRME (metne KABUL edilmez). ⚠️ Hukuki metin: değişirse ogrenci/page.tsx ile birlikte güncelle. */}
      <p className="mt-3 text-center text-xs leading-relaxed text-[var(--c-ink-3)]">
        Hesap oluşturarak{" "}
        <Link href="/doctorium/kosullar" className="text-[var(--c-accent)] hover:underline">Üyelik Sözleşmesi</Link>
        {" "}ve{" "}
        <Link href="/doctorium/cerez" className="text-[var(--c-accent)] hover:underline">Çerez Politikası</Link>
        &apos;nı kabul eder,{" "}
        <Link href="/doctorium/aydinlatma" className="text-[var(--c-accent)] hover:underline">Aydınlatma Metni</Link>
        {" "}kapsamında kişisel verilerinizin işlenmesi hakkında bilgilendirildiğinizi onaylarsınız.
      </p>

      {/* Üyelik adımları — yalnız Doctorium anlatısı (AURA/havuz dili yok). */}
      <div className="mt-6 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5">
        <div className="text-sm font-semibold text-[var(--c-ink)]">Üyelik nasıl işler?</div>
        <ol className="mt-2 space-y-2 text-xs text-[var(--c-ink-2)]">
          <li>
            <strong className="text-[var(--c-ink)]">1 · Hesabınızı oluşturun</strong> — ad, branş
            ve e-posta ile birkaç dakikada.
          </li>
          <li>
            <strong className="text-[var(--c-ink)]">2 · Doktor kimliğinizi doğrulayın</strong> —
            e-Devlet barkodlu mezun belgenizle diplomanız doğrulanır.
          </li>
          <li>
            <strong className="text-[var(--c-ink)]">3 · Doctorium&apos;unuz hazır</strong> — branşınıza
            göre kurulan akış, sağlık hukuku ve etkinlik takvimi sizi bekler.
          </li>
        </ol>
      </div>

      <p className="mt-4 text-center text-sm text-[var(--c-ink-2)]">
        Tıp öğrencisi misiniz?{" "}
        <Link href="/doctorium/ogrenci" className="font-semibold text-[var(--c-accent)] hover:underline">
          Öğrenci kaydına gidin
        </Link>
      </p>
    </DoctoriumSignupShell>
  );
}
