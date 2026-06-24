import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SharesView } from "./SharesView";
import { decryptField } from "@/lib/crypto";

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

  // Bildirim: hastanın henüz görmediği erişimler ("Dr. X kaydınızı görüntüledi"). Tarih ISO → client locale formatlar.
  const unseen = links
    .flatMap((l) =>
      l.accesses
        .filter((a) => !a.seenByPatient)
        .map((a) => ({ id: a.id, when: a.createdAt.toISOString(), recipient: l.recipientName, caseName: decryptField(l.case.patientName) }))
    )
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

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
    <SharesView
      unseen={unseen}
      cases={cases.map((c) => ({ ...c, patientName: decryptField(c.patientName) }))}
      links={linkData}
    />
  );
}
