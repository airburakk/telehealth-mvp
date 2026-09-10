import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { listPendingKvkkApplications, listDecidedKvkkApplications, KVKK_REQUEST_TYPES } from "@/lib/kvkk-applications";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { KvkkDecisionForm } from "./KvkkDecisionForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "KVKK Başvuruları" };

const REVIEWER_ROLES = ["ETHICS", "ADMIN"];
const REQUEST_TYPE_LABEL = new Map<string, string>(KVKK_REQUEST_TYPES.map((t) => [t.value, t.label]));

// KVKK m.11 başvuru kütüğü admin görünümü (06 madde B.2, Paket 2 — 2026-09-09) —
// admin/personel-onay'ın BİREBİR deseni. Proxy /admin'i TOKEN roluyle korur; karar yetkisi kritik →
// getCurrentUser (DB-rol otoriter) ŞART.
export default async function KvkkApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/admin/kvkk-basvurulari");
  if (!REVIEWER_ROLES.includes(user.role)) redirect("/");

  const [pending, decided] = await Promise.all([
    listPendingKvkkApplications(),
    listDecidedKvkkApplications(15),
  ]);

  const userIds = [...new Set([...pending.map((a) => a.userId), ...decided.map((a) => a.userId)])];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <PageHeader
        eyebrow="Yönetim"
        title="KVKK Başvuruları"
        sub="KVKK m.11 kapsamındaki başvurular — en geç 30 gün içinde yanıtlanmalıdır (06-veri-sahibi-basvuru-usul-esaslari.md madde A.4 / B.3)."
      />

      {pending.length === 0 ? (
        <EmptyState
          className="mt-7"
          title="Bekleyen başvuru yok"
          sub="/doctorium/kvkk-basvuru formundan gelen yeni başvurular bu kuyruğa düşer."
        />
      ) : (
        <div className="mt-7 space-y-4">
          {pending.map((app) => {
            const applicant = userById.get(app.userId);
            return (
              <AuraPanel
                key={app.id}
                title={REQUEST_TYPE_LABEL.get(app.requestType) ?? app.requestType}
                meta={new Date(app.createdAt).toLocaleDateString("tr-TR")}
                level="h2"
              >
                <div className="text-xs text-[var(--c-ink-3)]">{applicant?.name ?? "?"} · {applicant?.email}</div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--c-ink)]">{app.message}</p>
                <div className="mt-4 border-t border-[var(--c-hairline)] pt-3.5">
                  <KvkkDecisionForm applicationId={app.id} />
                </div>
              </AuraPanel>
            );
          })}
        </div>
      )}

      {decided.length > 0 && (
        <AuraPanel title="Son yanıtlar" meta={`${decided.length} kayıt`} className="mt-8" level="h2">
          <ul className="divide-y divide-[var(--c-hairline)]">
            {decided.map((d) => (
              <li key={d.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[var(--c-ink)]">
                    {REQUEST_TYPE_LABEL.get(d.requestType) ?? d.requestType} — {userById.get(d.userId)?.name ?? "?"}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--c-ink-3)]">
                    {d.decidedAt ? new Date(d.decidedAt).toLocaleDateString("tr-TR") : ""}
                  </span>
                </div>
                {d.decision && <p className="mt-1 text-xs text-[var(--c-ink-3)]">{d.decision}</p>}
              </li>
            ))}
          </ul>
        </AuraPanel>
      )}
    </div>
  );
}
