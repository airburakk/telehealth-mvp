import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BellRing, Lock, ShieldCheck, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readStaffAnswers } from "@/lib/staff-application";
import { STAFF_ROLE_CONFIGS } from "@/lib/staff-application-config";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { InfoField } from "@/components/ui/InfoField";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Uzman Paneli" };

const UZMAN_ROLES = ["HEALTH_PRO", "ADMIN"];

// Sağlık Uzmanı başlangıç paneli (2026-08-12) — doktor-dışı sağlık profesyonelinin iniş sayfası.
// KLİNİK YETKİ YOK (kullanıcı kararı): vaka verisi, hasta bilgisi, havuz erişimi bu panelde
// BULUNMAZ ve vaat EDİLMEZ ([[public-claim-honesty]] — "yakında" belirsizliği yerine dürüst durum).
// Proxy /uzman'ı TOKEN roluyle korur; sayfa getCurrentUser (DB-rol otoriter) + staffVerified kapısını yapar.
export default async function HealthProHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/uzman");
  if (!UZMAN_ROLES.includes(user.role)) redirect("/");
  if (user.role === "HEALTH_PRO" && !user.staffVerified) redirect("/kayit/durum");

  // Profil özeti: başvuru yanıtlarından (şifreli — sunucuda çözülür). ADMIN gözetiminde başvuru yok.
  const app = user.role === "HEALTH_PRO"
    ? await db.staffApplication.findUnique({ where: { userId: user.id }, select: { answers: true } })
    : null;
  const answers = app ? readStaffAnswers(app.answers) : {};
  const config = STAFF_ROLE_CONFIGS.HEALTH_PRO;
  const summaryKeys = ["profession", "licenseNo", "institution", "city"] as const;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <PageHeader
        eyebrow="Sağlık Uzmanı"
        title={`Hoş geldiniz, ${user.name}`}
        sub="Kurumsal üyeliğiniz doğrulandı. Bu panel, platformdaki uzman kimliğinizin başlangıç noktasıdır."
      />

      <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-emerald-400/25">
        <ShieldCheck size={17} className="mt-0.5 shrink-0" />
        <span>Üyeliğiniz platform yönetimince doğrulandı — hesabınız aktif.</span>
      </div>

      <AuraPanel title="Profiliniz" meta="başvuru bilgileriniz" className="mt-6">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {summaryKeys.map((k) => {
            const f = config.fields.find((x) => x.key === k);
            if (!f) return null;
            const v = answers[k];
            return <InfoField key={k} k={f.label} v={(Array.isArray(v) ? v.join(", ") : v) || "—"} />;
          })}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
          Bilgilerinizde değişiklik gerekiyorsa platform yönetimiyle iletişime geçin.
        </p>
      </AuraPanel>

      {/* Dürüst kapsam kartı: klinik yetki bu fazda bilinçli KAPALI — tarih/vaat verilmez */}
      <AuraPanel title="Erişim kapsamınız" meta="mevcut durum" className="mt-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--c-surface)] ring-1 ring-[var(--c-hairline)]">
            <Lock size={17} className="text-[var(--c-ink-3)]" />
          </span>
          <div className="text-sm leading-relaxed text-[var(--c-ink-2)]">
            <p>
              Sağlık Uzmanı rolü bu aşamada <strong className="text-[var(--c-ink)]">klinik vaka verilerine erişmez</strong> —
              hasta bilgisi, vaka dosyası ve konsültasyon havuzları bu panelde bulunmaz.
            </p>
            <p className="mt-2">
              Mesleğinize uygun çalışma alanları tanımlandığında hesabınıza bildirim gelir ve
              gerekli hâllerde yeniden onayınız alınır.
            </p>
          </div>
        </div>
      </AuraPanel>

      <AuraPanel title="Şimdi ne yapabilirim?" className="mt-6">
        <ul className="space-y-3 text-sm text-[var(--c-ink-2)]">
          <li className="flex items-start gap-2.5">
            <BellRing size={15} className="mt-0.5 shrink-0 text-[var(--c-accent)]" />
            <span>Bildirimlerinizi açık tutun — rolünüze yeni yetki tanımlandığında buradan haber verilir.</span>
          </li>
          <li className="flex items-start gap-2.5">
            {/* /hesap PATIENT-only (koşullu-href kuralı: dar kapılı rotaya link verilmez) —
                uzman hesap işlemleri şimdilik yönetim üzerinden. */}
            <UserRound size={15} className="mt-0.5 shrink-0 text-[var(--c-accent)]" />
            <span>Hesap bilgilerinizde değişiklik için platform yönetimiyle iletişime geçin.</span>
          </li>
        </ul>
      </AuraPanel>
    </div>
  );
}
