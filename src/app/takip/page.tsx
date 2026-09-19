import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { takipRowFor } from "@/lib/postop-rows";
import { TakipList } from "./TakipList";

export const dynamic = "force-dynamic";

// Post Op hub (hasta) — hastanın post-op takibi olan vakalarını listeler → /takip/[caseId].
// Klinik personelin panosu ayrı: /doktor/takip. Recovery kaydı vaka sayfası ilk açıldığında
// oluştuğundan liste yalnız takibi başlamış vakaları gösterir.
//
// Kontrol raporu 2026-09-17 H02 + D01: satır türetimi lib/postop-rows'a çıktı — kapanış kararı detay
// sayfasıyla AYNI kaynak (recoveryClosed: manuel VEYA süre dolumu), ölçüm güncelliği şiddetten ayrı.
export default async function TakipHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/takip"); // proxy zaten kapsar; savunma katmanı
  if (user.role !== "PATIENT" && user.role !== "ADMIN") redirect("/doktor/takip");

  const cases = await db.case.findMany({
    where: { userId: user.id, recovery: { isNot: null } },
    select: {
      id: true,
      branch: true,
      recovery: {
        select: {
          status: true, startedAt: true, completedAt: true, reopenedAt: true, branch: true,
          // v6.65: son kontrolün şiddeti → kartın 45° durum alanı rengi; createdAt → ölçüm güncelliği (D01)
          checkIns: { orderBy: { createdAt: "desc" }, take: 1, select: { severity: true, createdAt: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const rows = cases.map((c) => takipRowFor(c));

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <TakipList rows={rows} />
    </div>
  );
}
