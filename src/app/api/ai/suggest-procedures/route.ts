import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { suggestProcedures } from "@/lib/ai-clinical";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { decryptField } from "@/lib/crypto";
import { branchKeyFromLabel, getBranchProcedures, getByCodes } from "@/lib/procedures";
import { proceduresForIcd } from "@/data/icd-procedures";
import { icd10ForBranchLabel } from "@/data/coding";

// POST /api/ai/suggest-procedures — ICD-10 tanısına uygun KSHFT işlem önerisi (FAZ 2 hibrit, AI kanadı).
// Statik eşleme (data/icd-procedures) UI'da zaten öndedir; bu uç doktor İSTERSE ek AI görüşü verir.
// Model yalnız branş havuzundan seçer; dönen kodlar ayrıca havuza karşı süzülür (uydurma kod imkânsız).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const rl = await rateLimit(`ai:${user.id}`, 20, 60_000); // AI maliyet/DoS freni (soap ile ortak sayaç)
  if (!rl.ok) return tooMany(rl.retryAfter);

  const b = await req.json().catch(() => ({}));
  const caseId = String(b.caseId ?? "");
  const icd10Code = String(b.icd10Code ?? "").trim().toUpperCase();
  const notes = String(b.notes ?? "").trim().slice(0, 8000);
  if (!caseId || !icd10Code) return NextResponse.json({ error: "Vaka ve ICD-10 kodu gerekli." }, { status: 400 });

  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!(await canCaseBeAccessedBy(user, c))) return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });

  // Aday havuz: branş işlemleri + statik eşlemenin çapraz-branş kodları (ör. onkolojide kemoterapi
  // infüzyonu hematoloji havuzundadır). Token freni: 300 aday üst sınırı.
  const branchKey = branchKeyFromLabel(c.branch);
  const pool = branchKey ? getBranchProcedures(branchKey) : [];
  const mapped = getByCodes(proceduresForIcd(c.branch, icd10Code));
  const seen = new Set<string>();
  const candidates: { code: string; name: string }[] = [];
  for (const p of [...mapped, ...pool]) {
    if (seen.has(p.code)) continue;
    seen.add(p.code);
    candidates.push({ code: p.code, name: p.name });
    if (candidates.length >= 300) break;
  }
  if (!candidates.length) return NextResponse.json({ error: "Bu branş için aday işlem havuzu yok — katalog aramasını kullanın." }, { status: 422 });

  const icd10Label = icd10ForBranchLabel(c.branch).find((o) => o.code === icd10Code)?.label ?? "";

  try {
    const suggestions = await suggestProcedures({
      icd10Code,
      icd10Label,
      branch: c.branch,
      symptoms: decryptField(c.symptoms) ?? "", // at-rest şifreli → AI bağlamı için çöz (ad gönderilmez)
      notes,
      candidates,
    });
    // İsim + taban fiyat kataloğa göre zenginleştir (UI tek istekte ekleyebilsin)
    const byCode = new Map(getByCodes(suggestions.map((s) => s.code)).map((p) => [p.code, p]));
    return NextResponse.json({
      suggestions: suggestions.map((s) => ({
        ...s,
        name: byCode.get(s.code)?.name ?? s.code,
        price: byCode.get(s.code)?.price ?? null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI hatası" }, { status: 502 });
  }
}
