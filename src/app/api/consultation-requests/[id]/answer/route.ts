import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { answerRequest, type LabRec, type ImagingRec, type MedRec } from "@/lib/consultation-requests";

export const maxDuration = 60; // görüş hasta diline çevrilir (AI) → uzun sürebilir

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

// POST /api/consultation-requests/[id]/answer — doktor anonim konsültasyon talebine görüş + kodlu öneriler verir.
// Self-auth: yalnız consultOptIn=true doktor (panel görünürlüğüyle tutarlı). Yanıt başına ödeme (simüle).
// Görüş hasta diline çevrilir; lab/görüntüleme (ServiceRequest) + ilaç (MedicationRequest, ATC) FHIR'e bağlanır.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = dbUser?.doctorId ? await db.doctor.findUnique({ where: { id: dbUser.doctorId }, select: { id: true, consultOptIn: true } }) : null;
  if (!doctor) {
    return NextResponse.json({ error: "Doktor profili bağlı değil." }, { status: 400 });
  }
  if (!doctor.consultOptIn) {
    return NextResponse.json({ error: "Konsültasyon taleplerine katılım kapalı." }, { status: 403 });
  }

  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const text = typeof b.answer === "string" ? b.answer : "";

  // Öneriler: lab/görüntüleme/ilaç (ilaçta ATC kodu zorunlu — servis filtreler).
  const recommendedLabs = arr<LabRec>(b.recommendedLabs).filter((r) => r && (r.loinc || r.name)).slice(0, 20);
  const recommendedImaging = arr<ImagingRec>(b.recommendedImaging).filter((r) => r && (r.code || r.name)).slice(0, 20);
  const medications = arr<MedRec>(b.medications).filter((m) => m && m.atc).slice(0, 20);

  const res = await answerRequest(id, doctor.id, { text, recommendedLabs, recommendedImaging, medications });
  if (res === "EMPTY") return NextResponse.json({ error: "Görüş metni boş olamaz." }, { status: 400 });
  if (res === "NOT_FOUND") return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
  if (res === "TAKEN") return NextResponse.json({ error: "Bu talep başka bir doktor tarafından yanıtlandı." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
