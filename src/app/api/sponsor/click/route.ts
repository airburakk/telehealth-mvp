import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { currentDoctoriumAudience } from "@/lib/doctorium-audience";

export const dynamic = "force-dynamic";

// GET /api/sponsor/click?id=... — sponsorlu kart tıklaması: agregat sayaç +1 → dış bağlantıya 302.
// Self-auth + Doctorium'la AYNI rol kapısı (kimliksiz sayaç şişirme / açık yönlendirme ucu olmasın).
// Kişi-bazlı tıklama logu bilinçli YOK (KVKK minimizasyon) — yalnız kampanya-düzeyi toplam.
// Hedef URL istemciden DEĞİL DB'den okunur (admin girişinde http(s) şeması doğrulanmış) → open
// redirect yüzeyi yok. linkUrl'süz/pasif kampanyada Doctorium'a dönülür.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id") ?? "";
  const home = new URL("/doktor/doctorium", req.url);
  // 2026-09-05 (üç katman): sponsorlu kart öğrenci ve deneme üyesine ÇİZİLMEZ — kartı görmeyen kişinin
  // bilinen bir kampanya kimliğiyle sayaç şişirmesi/yönlendirme alması da kapanır. Sayaç ARTIRILMADAN
  // portala dönülür (kampanya analitiği kirlenmesin). Gözetim rolleri bağlamsal kartı görür (eski davranış).
  if (user.role === "DOCTOR") {
    const audienceCtx = await currentDoctoriumAudience();
    if (!audienceCtx?.flags.canSeeSponsored) return NextResponse.redirect(home);
  }
  if (!id) return NextResponse.redirect(home);

  const row = await db.sponsorCampaign.findUnique({
    where: { id },
    select: { linkUrl: true, status: true },
  });
  if (!row || row.status !== "ACTIVE" || !row.linkUrl) return NextResponse.redirect(home);

  // Sayaç kaybı kabul edilebilir, yönlendirmenin düşmesi edilemez (lib/sponsor.ts countImpressions notu).
  try {
    await db.sponsorCampaign.update({ where: { id }, data: { clicks: { increment: 1 } } });
  } catch (e) {
    console.error("[sponsor] tıklama sayacı yazılamadı:", e);
  }
  return NextResponse.redirect(row.linkUrl);
}
