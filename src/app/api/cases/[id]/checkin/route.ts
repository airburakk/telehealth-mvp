import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assessCheckIn, assessChecklist, worstSeverity } from "@/lib/postop";
import { assessPostopNote, assessPostopPhoto } from "@/lib/ai-clinical";
import { notifyRoles } from "@/lib/notify";
import { notifyOnDutySentinels } from "@/lib/clinical-duty";
import { canAccessCase } from "@/lib/ownership";
import { encryptField } from "@/lib/crypto";

// Not-AI (Haiku) + Foto-AI (Sonnet vision) paralel çalışır; serverless varsayılan limitini aşmasın diye süre tanı.
export const maxDuration = 30;

// POST /api/cases/:id/checkin — günlük iyileşme kontrolü
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.case.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!(await canAccessCase(c))) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const recovery = await db.recovery.upsert({
    where: { caseId: c.id },
    update: {},
    create: { caseId: c.id, branch: c.branch },
  });

  const b = await req.json().catch(() => ({}));
  const pain = Math.min(10, Math.max(0, Number(b.pain) || 0));
  const feverC = Math.min(43, Math.max(34, Number(b.feverC) || 36.5));
  const meds = b.meds !== false;
  const userNote = b.note ? String(b.note) : "";
  const photo = b.photo ? String(b.photo) : null;
  const checklistAnswers: Record<string, string> = (b.checklist && typeof b.checklist === "object") ? b.checklist : {};

  // Branşa özel günlük checklist → severity + özet (özet note'a eklenir; şema değişikliği yok)
  const cl = assessChecklist(c.branch, checklistAnswers);
  const note = [userNote, cl.summary].filter(Boolean).join(" · ") || null;

  const base = assessCheckIn({ pain, feverC, meds, note: note ?? undefined });

  // AI kırmızı bayrak (Modül 4): hastanın serbest-metin NOTUNU ve yüklediği FOTOĞRAFI değerlendir.
  // İkisi PARALEL (latency için); anahtarsız ortamda veya hata → atla; kural + branş-checklist zemini korur, akış asla bozulmaz.
  const day = Math.max(1, Math.floor((Date.now() - new Date(recovery.startedAt).getTime()) / 86400000) + 1);
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const isPhoto = !!photo && photo.startsWith("data:image");

  const [noteAi, photoAi] = await Promise.all([
    hasKey && userNote.trim().length >= 8
      ? assessPostopNote(userNote, { branch: c.branch, day }).catch((e) => {
          console.warn("[checkin] AI not değerlendirmesi atlandı:", e instanceof Error ? e.message : e);
          return null;
        })
      : Promise.resolve(null),
    hasKey && isPhoto
      ? assessPostopPhoto(photo as string, { branch: c.branch, day }).catch((e) => {
          console.warn("[checkin] AI foto değerlendirmesi atlandı:", e instanceof Error ? e.message : e);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const aiSev = noteAi?.severity ?? "NONE";
  const aiReason = noteAi && noteAi.severity !== "NONE" ? `🔍 AI değerlendirmesi: ${noteAi.reason}` : "";
  const photoSev = photoAi?.severity ?? "NONE";
  const photoReason = photoAi && photoAi.severity !== "NONE" ? `📷 AI görüntü değerlendirmesi: ${photoAi.findings}` : "";

  const severity = worstSeverity(base.severity, cl.severity, aiSev, photoSev);
  const reasons = [
    ...base.reasons.filter((r) => !(severity !== "NONE" && r.startsWith("Belirti yok"))),
    ...cl.reasons,
    ...(aiReason ? [aiReason] : []),
    ...(photoReason ? [photoReason] : []),
  ];

  // Post-op not + foto at-rest şifrelenir (E2EE Faz 1); AI değerlendirmesi yukarıda ham değerle yapıldı.
  const checkIn = await db.checkIn.create({
    data: { recoveryId: recovery.id, pain, feverC, meds, note: encryptField(note), photo: encryptField(photo), severity },
  });

  if (severity === "RED") {
    const extra = [...cl.reasons, aiReason, photoReason].filter(Boolean).slice(0, 2).join(", ");
    const redFlag = {
      type: "RED_FLAG" as const,
      title: `🚨 Kırmızı bayrak: ${c.patientName}`,
      body: `${c.branch} · ağrı ${pain}/10 · ateş ${feverC.toFixed(1)}°C${extra ? ` · ${extra}` : ""}`,
      href: `/takip/${c.id}`,
    };
    // §3.4/§7: kırmızı bayrak koordinatöre DEĞİL → doktor kuyruğu + görevdeki Nöbetçi (7/24 klinik yanıt).
    await notifyRoles(["DOCTOR"], redFlag);
    await notifyOnDutySentinels(redFlag);
  }


  return NextResponse.json({ id: checkIn.id, severity, reasons }, { status: 201 });
}
