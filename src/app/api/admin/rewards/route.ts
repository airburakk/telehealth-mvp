import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { REWARD_KINDS, MAX_SURVEY_POINTS } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// Ödül kataloğu yönetimi (v6.88) — ADMIN küratörlü, self-auth (/api/admin/survey deseni).
// ⚖️ Kalem GİRİŞİ = vaat başlangıcı: ayni menfaat (vergi) + kamu doktoru (657) değerlendirmesi
// kullanıcıda — panel uyarı kutusu bunu her kalem formunda gösterir. İLAÇ sponsorlu kalem YOK.

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const kind = typeof b.kind === "string" ? b.kind : "";
  if (!(REWARD_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "Geçersiz ödül türü." }, { status: 400 });
  }
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
  if (title.length < 3) return NextResponse.json({ error: "Başlık en az 3 karakter olmalı." }, { status: 400 });
  const description =
    typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 1000) : null;
  // Bedel tavanı: anket-başı tavanın 100 katı — yanlış sıfır girişine korkuluk (örn. 1.000.000).
  const pointsCost = Number.isInteger(b.pointsCost) ? (b.pointsCost as number) : 0;
  if (pointsCost < 1 || pointsCost > MAX_SURVEY_POINTS * 100) {
    return NextResponse.json({ error: `Puan bedeli 1-${MAX_SURVEY_POINTS * 100} arası olmalı.` }, { status: 400 });
  }

  const row = await db.rewardItem.create({
    data: { kind, title, description, pointsCost },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: row.id });
}

// PATCH — kalem güncelle (yalnız verilen alanlar): aktif/pasif, bedel, başlık, açıklama.
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = typeof b.id === "string" ? b.id : "";
  if (!id) return NextResponse.json({ error: "id zorunlu." }, { status: 400 });

  const row = await db.rewardItem.findUnique({ where: { id }, select: { id: true } });
  if (!row) return NextResponse.json({ error: "Kalem bulunamadı." }, { status: 404 });

  const data: { active?: boolean; pointsCost?: number; title?: string; description?: string | null } = {};
  if (typeof b.active === "boolean") data.active = b.active;
  if (Number.isInteger(b.pointsCost)) {
    const pc = b.pointsCost as number;
    if (pc < 1 || pc > MAX_SURVEY_POINTS * 100) {
      return NextResponse.json({ error: "Geçersiz puan bedeli." }, { status: 400 });
    }
    data.pointsCost = pc;
  }
  if (typeof b.title === "string" && b.title.trim().length >= 3) data.title = b.title.trim().slice(0, 200);
  if (typeof b.description === "string") data.description = b.description.trim() ? b.description.trim().slice(0, 1000) : null;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Değişecek alan yok." }, { status: 400 });

  await db.rewardItem.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE — yalnız hiç talep almamış kalem silinebilir (FK RESTRICT zaten korur; mesajı biz verelim).
// Talep almış kalem "pasif" yapılır — ledger/talep izi kopmaz.
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id zorunlu." }, { status: 400 });

  const cnt = await db.rewardRedemption.count({ where: { itemId: id } });
  if (cnt > 0) {
    return NextResponse.json({ error: "Talep almış kalem silinemez; pasife alın." }, { status: 400 });
  }
  await db.rewardItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
