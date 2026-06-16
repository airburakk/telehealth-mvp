import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assessCheckIn, assessChecklist, worstSeverity } from "@/lib/postop";
import { assessPostopNote } from "@/lib/ai-clinical";
import { notifyRoles } from "@/lib/notify";
import { canAccessCase } from "@/lib/ownership";

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

  // AI kırmızı bayrak: hastanın serbest-metin notunu değerlendir (keyword taramasının kaçırdığı nüans/bağlam).
  // Anahtarsız ortamda veya hata → atla; kural + branş-checklist zemini korur, akış asla bozulmaz.
  let aiSev: "NONE" | "WATCH" | "RED" = "NONE";
  let aiReason = "";
  if (userNote.trim().length >= 8 && process.env.ANTHROPIC_API_KEY) {
    try {
      const day = Math.max(1, Math.floor((Date.now() - new Date(recovery.startedAt).getTime()) / 86400000) + 1);
      const ai = await assessPostopNote(userNote, { branch: c.branch, day });
      aiSev = ai.severity;
      if (ai.severity !== "NONE") aiReason = `🔍 AI değerlendirmesi: ${ai.reason}`;
    } catch (e) {
      console.warn("[checkin] AI not değerlendirmesi atlandı:", e instanceof Error ? e.message : e);
    }
  }

  const severity = worstSeverity(base.severity, cl.severity, aiSev);
  const reasons = [
    ...base.reasons.filter((r) => !(severity !== "NONE" && r.startsWith("Belirti yok"))),
    ...cl.reasons,
    ...(aiReason ? [aiReason] : []),
  ];

  const checkIn = await db.checkIn.create({
    data: { recoveryId: recovery.id, pain, feverC, meds, note, photo, severity },
  });

  if (severity === "RED") {
    const extra = [...cl.reasons, aiReason].filter(Boolean).slice(0, 2).join(", ");
    await notifyRoles(["DOCTOR", "COORDINATOR"], {
      type: "RED_FLAG",
      title: `🚨 Kırmızı bayrak: ${c.patientName}`,
      body: `${c.branch} · ağrı ${pain}/10 · ateş ${feverC.toFixed(1)}°C${extra ? ` · ${extra}` : ""}`,
      href: `/takip/${c.id}`,
    });
  }

  return NextResponse.json({ id: checkIn.id, severity, reasons }, { status: 201 });
}
