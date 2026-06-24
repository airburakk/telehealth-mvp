import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ShareManager } from "@/components/ShareManager";
import { formatDateTime } from "@/lib/constants";
import { decryptField } from "@/lib/crypto";
import { ShieldCheck, BellRing, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MySharesPage() {
  const user = await getCurrentUser();
  if (!user || !["PATIENT", "ADMIN"].includes(user.role)) redirect("/giris?next=/paylasimlarim");

  // Hasta yalnız kendi vakalarını ve onlara ait paylaşım linklerini görür (ADMIN tümünü)
  const own = user.role === "PATIENT" ? { userId: user.id } : {};
  const links = await db.shareLink.findMany({
    where: user.role === "PATIENT" ? { case: { userId: user.id } } : {},
    orderBy: { createdAt: "desc" },
    include: {
      case: { select: { patientName: true, branch: true } },
      accesses: { orderBy: { createdAt: "desc" } },
    },
  });
  const cases = await db.case.findMany({
    where: own,
    orderBy: { createdAt: "desc" },
    select: { id: true, patientName: true, branch: true, country: true },
  });

  // Bildirim: hastanın henüz görmediği erişimler ("Dr. X kaydınızı görüntüledi")
  const unseen = links
    .flatMap((l) =>
      l.accesses
        .filter((a) => !a.seenByPatient)
        .map((a) => ({ id: a.id, when: a.createdAt, recipient: l.recipientName, caseName: decryptField(l.case.patientName) }))
    )
    .sort((a, b) => b.when.getTime() - a.when.getTime());

  const linkData = links.map((l) => ({
    id: l.id,
    token: l.token,
    recipientName: l.recipientName,
    scopes: l.scopes.split(","),
    expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
    revokedAt: l.revokedAt ? l.revokedAt.toISOString() : null,
    allowDownload: l.allowDownload,
    createdAt: l.createdAt.toISOString(),
    caseName: decryptField(l.case.patientName), // kimlik at-rest şifreli → çöz (E2EE inc.2c)
    caseBranch: l.case.branch,
    accessCount: l.accesses.length,
    lastAccess: l.accesses[0] ? l.accesses[0].createdAt.toISOString() : null,
  }));

  // Anlık görüntü alındı; bildirimleri "görüldü" işaretle (sonraki ziyarette tekrar çıkmasın)
  if (unseen.length) {
    await db.shareAccess.updateMany({ where: { id: { in: unseen.map((u) => u.id) } }, data: { seenByPatient: true } });
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">Paylaşım Kontrol Merkezi</h1>
          <p className="text-sm text-slate-500">Sağlık verilerinizi kendi kontrolünüzde — süreli ve istediğiniz an iptal edilebilir bağlantılarla paylaşın.</p>
        </div>
      </div>

      {unseen.length > 0 && (
        <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <BellRing size={16} /> Yeni erişim bildirimi ({unseen.length})
          </div>
          <ul className="mt-2 space-y-1">
            {unseen.slice(0, 5).map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-2 text-sm text-amber-900">
                <Eye size={14} className="shrink-0" />
                <span>
                  <strong>{u.recipient || "Paylaşılan kişi"}</strong>, {u.caseName} kaydınızı görüntüledi
                </span>
                <span className="text-amber-600">· {formatDateTime(u.when)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <ShareManager cases={cases.map((c) => ({ ...c, patientName: decryptField(c.patientName) }))} links={linkData} />
      </div>
    </div>
  );
}
