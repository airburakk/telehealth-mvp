import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Check, X, Clock3 } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { STAFF_ROLE_CONFIGS, type StaffSignupRole } from "@/lib/staff-application-config";
import { readStaffAnswers } from "@/lib/staff-application";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoField } from "@/components/ui/InfoField";
import { ReviewButtons } from "./ReviewButtons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Personel Onayı" };

const REVIEWER_ROLES = ["ETHICS", "ADMIN"];

// Kurumsal üyelik başvuru onayı (2026-08-12) — /admin/doktor-onay'ın personel eşleniği.
// PARTNER/AGENCY/HEALTH_PRO başvuruları: şifreli yanıtlar SUNUCUDA çözülüp incelemeciye gösterilir;
// belgeler raw uçtan (audit'li) açılır. Onay staffVerifiedAt damgalar; ret gerekçesi başvurana gider.
// Proxy /admin'i TOKEN roluyle korur; karar yetkisi kritik → getCurrentUser (DB-rol otoriter) ŞART.
export default async function StaffApprovalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/admin/personel-onay");
  if (!REVIEWER_ROLES.includes(user.role)) redirect("/");

  const [pending, decided] = await Promise.all([
    db.staffApplication.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" }, // kuyruk adaleti: en eski başvuru üstte
    }),
    db.staffApplication.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { reviewedAt: "desc" },
      take: 15,
      select: { id: true, role: true, status: true, reviewedAt: true, reviewNote: true, userId: true },
    }),
  ]);

  // Başvuran kimlikleri + belgeler tek seferde (N+1 yerine iki toplu sorgu)
  const userIds = [...new Set([...pending.map((a) => a.userId), ...decided.map((a) => a.userId)])];
  const appIds = pending.map((a) => a.id);
  const [users, docs] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, createdAt: true } }),
    db.staffDocument.findMany({
      where: { applicationId: { in: appIds } },
      select: { id: true, applicationId: true, type: true, label: true, mimeType: true },
    }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const docsByApp = new Map<string, typeof docs>();
  for (const d of docs) {
    const arr = docsByApp.get(d.applicationId) ?? [];
    arr.push(d);
    docsByApp.set(d.applicationId, arr);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <PageHeader
        eyebrow="Yönetim"
        title="Personel Onayı"
        sub="Partner Doktor, Sağlık Turizmi Acentesi ve Sağlık Uzmanı başvuruları — onaylanmadan rol paneli açılmaz. Koordinatör ve Etik Kurul hesapları başvuru almaz (yalnız davet)."
      />

      {pending.length === 0 ? (
        <EmptyState
          className="mt-7"
          title="Bekleyen başvuru yok"
          sub="Yeni kurumsal üyelik başvuruları bu kuyruğa düşer; bildirimlerde de görünür."
        />
      ) : (
        <div className="mt-7 space-y-4">
          {pending.map((app) => {
            const config = STAFF_ROLE_CONFIGS[app.role as StaffSignupRole];
            const applicant = userById.get(app.userId);
            const answers = readStaffAnswers(app.answers);
            const appDocs = docsByApp.get(app.id) ?? [];
            const uploadedTypes = new Set(appDocs.map((d) => d.type));
            return (
              <AuraPanel
                key={app.id}
                title={`${ROLE_LABELS[app.role as Role]} — ${applicant?.name ?? "?"}`}
                meta={new Date(app.createdAt).toLocaleDateString("tr-TR")}
                level="h2"
              >
                <div className="text-xs text-[var(--c-ink-3)]">{applicant?.email}</div>

                <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {config.fields.map((f) => {
                    const v = answers[f.key];
                    const text = Array.isArray(v) ? v.join(", ") : v;
                    return <InfoField key={f.key} k={f.label} v={text || "—"} />;
                  })}
                </div>

                {/* Zorunlu belgeler: rozet + raw görüntüleme (audit'li uç) */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--c-hairline)] pt-3.5">
                  {config.docs.map((r) => {
                    const doc = appDocs.find((d) => d.type === r.type);
                    return doc ? (
                      <Link
                        key={r.type}
                        href={`/api/staff-applications/${app.id}/documents/${doc.id}/raw`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/25 hover:bg-emerald-500/20"
                      >
                        <FileText size={12} /> {r.label} <Check size={12} />
                      </Link>
                    ) : (
                      <span key={r.type} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--c-ink)]/10 px-2.5 py-1 text-xs font-medium text-[var(--c-ink-3)]">
                        <X size={12} /> {r.label} — yüklenmedi
                      </span>
                    );
                  })}
                </div>

                <div className="mt-4 border-t border-[var(--c-hairline)] pt-3.5">
                  <ReviewButtons applicationId={app.id} />
                </div>
              </AuraPanel>
            );
          })}
        </div>
      )}

      {decided.length > 0 && (
        <AuraPanel title="Son kararlar" meta={`${decided.length} kayıt`} className="mt-8" level="h2">
          <ul className="divide-y divide-[var(--c-hairline)]">
            {decided.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate text-[var(--c-ink)]">
                  {ROLE_LABELS[d.role as Role]} — {userById.get(d.userId)?.name ?? "?"}
                  {d.status === "REJECTED" && d.reviewNote && (
                    <span className="ml-2 text-xs text-[var(--c-ink-3)]">({d.reviewNote})</span>
                  )}
                </span>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${d.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/25" : "bg-red-500/10 text-red-300 ring-1 ring-red-400/25"}`}>
                  {d.status === "APPROVED" ? <Check size={12} /> : <Clock3 size={12} />}
                  {d.status === "APPROVED" ? "Onaylandı" : "Düzeltme istendi"}
                </span>
              </li>
            ))}
          </ul>
        </AuraPanel>
      )}
    </div>
  );
}
