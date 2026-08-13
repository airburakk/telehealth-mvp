import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock3, CheckCircle2, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { roleHome, isStaffSignupRole, ROLE_LABELS, type Role } from "@/lib/roles";
import { STAFF_ROLE_CONFIGS, STAFF_APP_STATUS_LABELS, type StaffAppStatus, type StaffSignupRole } from "@/lib/staff-application-config";
import { readStaffAnswers } from "@/lib/staff-application";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { InfoField } from "@/components/ui/InfoField";
import { StaffDocsPanel, StaffResubmitForm, type UploadedDocMeta } from "./panels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Başvuru Durumu" };

// Kurumsal üyelik başvuru durumu (2026-08-12) — doğrulanmamış PARTNER/AGENCY/HEALTH_PRO'nun iniş
// sayfası (login home + rol sayfalarındaki kapılar buraya düşürür). Onaylı hesap rol paneline
// yönlenir; PENDING'de yanıt özeti + belge yükleme, REJECTED'te gerekçe + düzeltme formu görünür.
export default async function StaffApplicationStatusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/kayit/durum");
  if (!isStaffSignupRole(user.role)) redirect(roleHome(user.role as Role));

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { staffVerifiedAt: true },
  });
  if (dbUser?.staffVerifiedAt) redirect(roleHome(user.role as Role)); // onaylı → rol paneli

  const app = await db.staffApplication.findUnique({ where: { userId: user.id } });
  if (!app) redirect("/kurumsal-giris"); // başvurusuz personel hesabı (davetli olmalıydı) — kapıya

  const config = STAFF_ROLE_CONFIGS[app.role as StaffSignupRole];
  const answers = readStaffAnswers(app.answers);
  const status = app.status as StaffAppStatus;
  const docs: UploadedDocMeta[] = (
    await db.staffDocument.findMany({
      where: { applicationId: app.id },
      select: { id: true, type: true, label: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
  ).map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }));

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <PageHeader
        eyebrow="Kurumsal Üyelik"
        title="Başvuru Durumu"
        sub={`${ROLE_LABELS[app.role as Role]} başvurunuz platform yönetimi tarafından incelenir; sonuç bu sayfada ve bildirimlerinizde görünür.`}
      />

      {/* Durum bandı */}
      <div
        className={`mt-6 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm ring-1 ${
          status === "PENDING"
            ? "bg-amber-500/10 text-amber-300 ring-amber-400/25"
            : status === "REJECTED"
              ? "bg-red-500/10 text-red-300 ring-red-400/25"
              : "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25"
        }`}
      >
        {status === "PENDING" ? <Clock3 size={17} className="mt-0.5 shrink-0" /> : status === "REJECTED" ? <AlertTriangle size={17} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0" />}
        <div>
          <div className="font-semibold">{STAFF_APP_STATUS_LABELS[status]}</div>
          {status === "PENDING" && (
            <p className="mt-0.5 text-[13px] opacity-90">
              Başvurunuz sırada. Zorunlu belgeleri aşağıdan yükleyebilirsiniz — belgeler tamamlanmadan
              onay verilemez.
            </p>
          )}
          {status === "REJECTED" && (
            <p className="mt-0.5 text-[13px] opacity-90">
              {app.reviewNote
                ? `İnceleme notu: ${app.reviewNote}`
                : "Başvurunuzda düzeltme istendi. Bilgilerinizi güncelleyip yeniden gönderebilirsiniz."}
            </p>
          )}
        </div>
      </div>

      {/* REJECTED: düzeltme formu · diğer durumlar: yanıt özeti */}
      {status === "REJECTED" ? (
        <AuraPanel title="Başvuruyu düzelt" meta="yeniden gönderim" className="mt-6">
          <StaffResubmitForm config={config} initial={answers} />
        </AuraPanel>
      ) : (
        <AuraPanel title="Başvuru bilgileri" meta={config.title} className="mt-6">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {config.fields.map((f) => {
              const v = answers[f.key];
              const text = Array.isArray(v) ? v.join(", ") : v;
              return <InfoField key={f.key} k={f.label} v={text || "—"} />;
            })}
          </div>
        </AuraPanel>
      )}

      <AuraPanel title="Belgeler" meta={`${docs.length}/${config.docs.length} yüklendi`} className="mt-6">
        <StaffDocsPanel requirements={config.docs} uploaded={docs} locked={false} />
      </AuraPanel>

      <p className="mt-6 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Başvuru bilgileriniz ve belgeleriniz yalnız üyelik değerlendirmesi amacıyla işlenir ve
        şifreli saklanır; inceleme yalnız yetkili platform yönetimince yapılır.
      </p>
    </div>
  );
}
