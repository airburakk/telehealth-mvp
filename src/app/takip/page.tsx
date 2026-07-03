import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TakipList, type TakipRow } from "./TakipList";

export const dynamic = "force-dynamic";

// Post Op hub (hasta) — hastanın post-op takibi olan vakalarını listeler → /takip/[caseId].
// Klinik personelin panosu ayrı: /doktor/takip. Recovery kaydı vaka sayfası ilk açıldığında
// oluştuğundan liste yalnız takibi başlamış vakaları gösterir.
export default async function TakipHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/takip"); // proxy zaten kapsar; savunma katmanı
  if (user.role !== "PATIENT" && user.role !== "ADMIN") redirect("/doktor/takip");

  const cases = await db.case.findMany({
    where: { userId: user.id, recovery: { isNot: null } },
    select: {
      id: true,
      branch: true,
      recovery: { select: { status: true, startedAt: true, completedAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const rows: TakipRow[] = cases.map((c) => ({
    caseId: c.id,
    branch: c.branch,
    status: c.recovery?.status ?? "ACTIVE",
    startedAt: c.recovery?.startedAt.toISOString() ?? "",
    completedAt: c.recovery?.completedAt?.toISOString() ?? null,
  }));

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <TakipList rows={rows} />
    </div>
  );
}
