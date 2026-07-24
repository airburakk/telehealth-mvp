import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encryptField, decryptField } from "@/lib/crypto";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { recordAccess, reqMeta } from "@/lib/audit";
import { storeDocument } from "@/lib/storage";
import { notifyDoctorsByBranch } from "@/lib/notify";

// POST /api/cases/:id/pending-docs — hasta, belge-bekleyen (DOCS_PENDING) başvurusunun eksik
// zorunlu belgelerini yükler ve başvuruyu doktor havuzuna iletir (2026-07-24, kullanıcı kararı).
// HASTA-ONLY + kendi vakası (BOLA) + yalnız DOCS_PENDING durumunda çalışır.
// İlerleme şartı (kullanıcı kararı): bekleyen TÜM kalemler işaretlenmiş + EN AZ BİR içerikli dosya
// yüklenmiş olmalı. Başarıda: belgeler kaydedilir (şifreli/blob — triyajla aynı yol), status NEW,
// NEW_CASE bildirimi branş doktorlarına O ANDA gider (create'te bilinçli atlanmıştı).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "PATIENT") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const rl = await rateLimit(`pending-docs:${user.id}`, 10, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const c = await db.case.findUnique({
    where: { id },
    select: { id: true, userId: true, deletionLockedAt: true, status: true, pendingDocs: true, branch: true, urgency: true, attachments: true, extra: true },
  });
  if (!c || c.userId !== user.id || c.deletionLockedAt) {
    return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });
  }
  if (c.status !== "DOCS_PENDING") {
    return NextResponse.json({ error: "Bu başvuru belge beklemiyor.", status: c.status }, { status: 409 });
  }

  let pending: string[] = [];
  try { pending = c.pendingDocs ? (JSON.parse(c.pendingDocs) as string[]) : []; } catch { pending = []; }

  const b = await req.json().catch(() => ({}));
  const confirmed = new Set(
    Array.isArray(b.confirmed) ? (b.confirmed as unknown[]).filter((x): x is string => typeof x === "string") : [],
  );
  const stillMissing = pending.filter((label) => !confirmed.has(label));
  if (stillMissing.length) {
    return NextResponse.json({ error: "Tüm bekleyen belgeler işaretlenmeli.", missing: stillMissing }, { status: 400 });
  }

  // Belgeler: triyaj POST /api/cases ile aynı format/sınırlar ({label,mimeType,content:dataURL}).
  type RawDoc = { label?: unknown; mimeType?: unknown; content?: unknown };
  const documents: RawDoc[] = Array.isArray(b.documents) ? b.documents : [];
  const valid = documents
    .filter((d) => typeof d.content === "string" && (d.content as string).startsWith("data:"))
    .slice(0, 12);
  if (!valid.length) {
    return NextResponse.json({ error: "En az bir belge dosyası yüklenmelidir." }, { status: 400 });
  }

  const rows = await Promise.all(
    valid.map(async (d) => ({
      caseId: c.id,
      label: typeof d.label === "string" ? d.label.slice(0, 200) : "belge",
      mimeType: typeof d.mimeType === "string" ? d.mimeType.slice(0, 100) : "application/octet-stream",
      content: await storeDocument(d.content as string, { keyPrefix: "case-doc" }),
    })),
  );
  await db.caseDocument.createMany({ data: rows });

  // Kokpit "Ön Değerlendirme" belge özeti (answers["Gerekli Belgeler"]) bayatlamasın: doktor
  // "Eksik (zorunlu): …" görmesin — sonuna tamamlanma notu eklenir (şifreli JSON güncellenir).
  let extraOut = c.extra;
  try {
    const answers = c.extra ? (JSON.parse(decryptField(c.extra) ?? "{}") as Record<string, unknown>) : {};
    if (typeof answers["Gerekli Belgeler"] === "string") {
      answers["Gerekli Belgeler"] = `${answers["Gerekli Belgeler"]} · Bekleyen zorunlu belgeler hasta tarafından yüklendi`;
      extraOut = encryptField(JSON.stringify(answers));
    }
  } catch { /* özet güncellenemedi → mevcut extra korunur (akış düşmez) */ }

  const names = rows.map((r) => r.label).join(",");
  await db.case.update({
    where: { id: c.id },
    data: {
      status: "NEW",
      pendingDocs: null,
      attachments: c.attachments ? `${c.attachments},${names}` : names,
      ...(extraOut !== c.extra ? { extra: extraOut } : {}),
    },
  });

  // Vaka ANCAK ŞİMDİ havuza düşer → yeni-vaka bildirimi de şimdi (create'teki metinle birebir).
  await notifyDoctorsByBranch(c.branch, {
    type: "NEW_CASE",
    title: `${c.urgency >= 4 ? "🔴 " : ""}Yeni vaka`, // isim bildirime gömülmez (E2EE inc.2c)
    body: `${c.branch} · aciliyet ${c.urgency}/5`,
    href: `/doktor/vaka/${c.id}`,
  });

  await recordAccess({
    actor: user, action: "CASE_DOCS_COMPLETED", resourceType: "CASE", resourceId: c.id, subjectUserId: c.userId,
    detail: `Hasta bekleyen zorunlu belgeleri yükledi (${rows.length} dosya) — başvuru doktor havuzuna iletildi`, ...reqMeta(req),
  });

  return NextResponse.json({ ok: true });
}
