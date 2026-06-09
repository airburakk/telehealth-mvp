import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { expiryFromKey, SCOPES } from "@/lib/share";

const VALID_SCOPES = SCOPES.map((s) => s.key) as string[];

// POST /api/shares — hasta yeni güvenli paylaşım linki oluşturur
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["PATIENT", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const caseId = String(b.caseId || "");
  const scopes: string[] = Array.isArray(b.scopes) ? b.scopes.filter((s: unknown) => VALID_SCOPES.includes(String(s))) : [];
  if (!caseId || scopes.length === 0) {
    return NextResponse.json({ error: "Vaka ve en az bir veri kategorisi gerekli." }, { status: 400 });
  }

  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  const password = b.password ? String(b.password) : "";
  const link = await db.shareLink.create({
    data: {
      token: randomBytes(24).toString("base64url"),
      caseId,
      recipientName: b.recipientName ? String(b.recipientName).slice(0, 80) : null,
      scopes: scopes.join(","),
      expiresAt: expiryFromKey(String(b.durationKey || "7d")),
      passwordHash: password ? await hashPassword(password) : null,
      allowDownload: b.allowDownload === true,
    },
  });

  return NextResponse.json({ id: link.id, token: link.token }, { status: 201 });
}
