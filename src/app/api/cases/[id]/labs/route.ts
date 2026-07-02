import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { staffAccessClosed } from "@/lib/postop-access";
import { recordAccess, reqMeta } from "@/lib/audit";

// POST /api/cases/:id/labs — laboratuvar sonuçları (FHIR Observation kaynağı, LOINC kodlu). Klinik personel.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id } = await params;
  const exists = await db.case.findUnique({ where: { id }, select: { id: true, userId: true, doctorId: true } });
  if (!exists) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  // BOLA düzeltmesi: rol tek başına yetmez — doktor yalnız kendisine atanmış/kuyruk vakasına lab yazabilir.
  if (!(await canCaseBeAccessedBy(user, exists))) {
    return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });
  }

  // E2EE Faz 2A — post-op takip tamamlandıysa lab sonucu (yazma) kapalı (hasta-only, §0.1·3).
  const closed = await staffAccessClosed(id, user);
  if (closed.closed) {
    await recordAccess({ actor: user, action: "POSTOP_ACCESS_DENIED", resourceType: "CASE", resourceId: id, subjectUserId: exists.userId, detail: `post-op kapalı (${closed.reason}) — labs`, ...reqMeta(req) });
    return NextResponse.json({ error: "Post-op takip tamamlandı; klinik erişim hastaya devredildi." }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const arr: unknown[] = Array.isArray(b.labs) ? b.labs : [];
  const labs = arr
    .map((l) => {
      const o = (l ?? {}) as Record<string, unknown>;
      const loinc = typeof o.loinc === "string" ? o.loinc.trim().slice(0, 16) : "";
      const name = typeof o.name === "string" ? o.name.trim().slice(0, 120) : "";
      const value =
        typeof o.value === "string" ? o.value.trim().slice(0, 60) : typeof o.value === "number" ? String(o.value) : "";
      const unit = typeof o.unit === "string" ? o.unit.trim().slice(0, 24) : "";
      const abnormal = typeof o.abnormal === "string" ? o.abnormal.trim().slice(0, 24) : "";
      // Not: aiSuggested taşınmaz → "Kaydet" satırları onaylar (FHIR Observation'a dahil edilir).
      return { loinc, name, value, unit, ...(abnormal ? { abnormal } : {}) };
    })
    .filter((l) => (l.loinc || l.name) && l.value)
    .slice(0, 50);

  await db.case.update({ where: { id }, data: { labResults: labs.length ? JSON.stringify(labs) : null } });
  await recordAccess({
    actor: user, action: "LABS_WRITE", resourceType: "CASE", resourceId: id, subjectUserId: exists.userId,
    detail: `${labs.length} sonuç`, ...reqMeta(req),
  });
  return NextResponse.json({ ok: true, count: labs.length });
}
