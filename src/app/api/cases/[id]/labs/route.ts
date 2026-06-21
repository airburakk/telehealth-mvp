import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/cases/:id/labs — laboratuvar sonuçları (FHIR Observation kaynağı, LOINC kodlu). Klinik personel.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id } = await params;
  const exists = await db.case.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

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
  return NextResponse.json({ ok: true, count: labs.length });
}
