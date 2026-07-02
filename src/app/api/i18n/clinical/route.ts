import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canSoCaseBeAccessedBy } from "@/lib/ownership";
import { translateClinical, UI_LANGS } from "@/lib/i18n";

// POST /api/i18n/clinical — İkinci Görüş KLİNİK serbest-metnini çevirir (uzman görüşü + talep açıklamaları).
// /api/i18n'in AKSİNE: (1) Translation tablosuna YAZMAZ (önbelleksiz → düz-metin PHI at-rest baypası olmaz),
// (2) hasta adını [HASTA] ile maskeler → maskesiz AI'ya gitmez (P0 #2). Caller SO vakasına erişebilmeli.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const soCaseId = typeof b.soCaseId === "string" ? b.soCaseId : "";
  const lang = UI_LANGS.includes(String(b.lang)) ? String(b.lang) : "Türkçe";
  const texts: string[] = Array.isArray(b.texts)
    ? b.texts.filter((t: unknown) => typeof t === "string").map((t: string) => t.slice(0, 20000)).slice(0, 50)
    : [];

  // Sahiplik: yabancı SO vakasının klinik metnini çevirtip (dolaylı) okumayı engelle (BOLA).
  const c = await db.secondOpinionCase.findUnique({ where: { id: soCaseId }, select: { patientId: true, assignedDoctorId: true } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!(await canSoCaseBeAccessedBy(user, c))) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  // Hasta adı sunucuda patientId'den çözülür (istemciye PHI ad göndermeden maskeleme yapılabilsin).
  const patient = await db.user.findUnique({ where: { id: c.patientId }, select: { name: true } });
  const map = await translateClinical(lang, texts, patient?.name ?? null);
  return NextResponse.json({ lang, map });
}
