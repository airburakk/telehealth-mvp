import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { summarizeSOAP } from "@/lib/ai-clinical";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { decryptField } from "@/lib/crypto";

// POST /api/ai/soap — doktorun görüşme notunu SOAP formatına çevirir (Claude)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const rl = rateLimit(`ai:${user.id}`, 20, 60_000); // AI maliyet/DoS freni: 20/dk/kullanıcı
  if (!rl.ok) return tooMany(rl.retryAfter);

  const b = await req.json().catch(() => ({}));
  const notes = String(b.notes ?? "").trim();
  const caseId = String(b.caseId ?? "");
  const source = b.source === "transcript" ? "transcript" as const : "notes" as const;
  if (!notes) return NextResponse.json({ error: "Önce görüşme notu girin." }, { status: 400 });

  const c = caseId ? await db.case.findUnique({ where: { id: caseId } }) : null;
  // IDOR kapısı: vaka verildiyse yalnız erişilebilen vaka AI'ya gönderilir (T3 + atama-bazlı T2).
  if (c && !(await canCaseBeAccessedBy(user, c))) return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });

  try {
    const { soap, structured } = await summarizeSOAP(notes, {
      patientName: decryptField(c?.patientName) ?? "—", // kimlik at-rest şifreli → AI girdisi için çöz (E2EE inc.2c)
      branch: c?.branch ?? "—",
      symptoms: c?.symptoms ? decryptField(c.symptoms) : "—", // at-rest şifreli → AI bağlamı için çöz
    }, source);
    return NextResponse.json({ soap, structured });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI hatası" }, { status: 502 });
  }
}
