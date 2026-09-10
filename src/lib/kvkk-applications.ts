// KVKK m.11 başvuru kütüğü (06-veri-sahibi-basvuru-usul-esaslari.md madde A.2/A.3/B.2, Paket 2 —
// 2026-09-09). Form yalnız oturum açmış üyeye açık — kimlik doğrulaması OTURUMdur (madde A.2 "Kurgu"
// notu: KVKK ikincil düzenlemesi yazılı/KEP/e-imza/kayıtlı e-posta öngörür; platform içi form bu
// kapsamda yalnız üyenin kimlik doğrulanmış oturumundan iletilir).
//
// Şablon: admin/personel-onay + StaffApplication deseni (pending/decided liste, karar = tek güncelleme).
import type { KvkkApplication } from "@prisma/client";
import { db } from "./db";
import { recordAccess } from "./audit";
import { notifyUser } from "./notify";
import type { SessionUser } from "./session";

export type KvkkRequestType = "BILGI_ERISIM" | "DUZELTME" | "SILME" | "ITIRAZ" | "DIGER";

/** 06 madde B.4 — talep türleri (sıra = form seçeneği sırası). */
export const KVKK_REQUEST_TYPES: { value: KvkkRequestType; label: string }[] = [
  { value: "BILGI_ERISIM", label: "Bilgi / erişim talebi" },
  { value: "DUZELTME", label: "Düzeltme talebi" },
  { value: "SILME", label: "Silme talebi" },
  { value: "ITIRAZ", label: "İtiraz (otomatik işlemeye)" },
  { value: "DIGER", label: "Diğer" },
];

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 4000;

export async function submitKvkkApplication(
  actor: SessionUser,
  requestType: string,
  message: string,
  ip?: string | null,
  userAgent?: string | null,
): Promise<{ id: string }> {
  const type = KVKK_REQUEST_TYPES.find((t) => t.value === requestType)?.value;
  if (!type) throw new Error("Geçersiz talep türü.");
  const trimmed = message.trim();
  if (trimmed.length < MESSAGE_MIN) throw new Error(`Talebinizi biraz daha açıklar mısınız (en az ${MESSAGE_MIN} karakter)?`);
  if (trimmed.length > MESSAGE_MAX) throw new Error("Talep metni çok uzun.");

  const app = await db.kvkkApplication.create({
    data: { userId: actor.id, requestType: type, message: trimmed, ip: ip ?? null, userAgent: userAgent ?? null },
    select: { id: true },
  });
  await recordAccess({
    actor, action: "KVKK_APPLICATION_SUBMIT", resourceType: "KvkkApplication", resourceId: app.id,
    subjectUserId: actor.id, detail: `tür=${type}`, ip, userAgent,
  });
  return app;
}

export interface KvkkApplicationListItem {
  id: string;
  userId: string;
  requestType: string;
  message: string;
  status: string;
  decision: string | null;
  decidedAt: string | null;
  createdAt: string;
}

function toListItem(a: KvkkApplication): KvkkApplicationListItem {
  return {
    id: a.id, userId: a.userId, requestType: a.requestType, message: a.message, status: a.status,
    decision: a.decision, decidedAt: a.decidedAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString(),
  };
}

/** Kuyruk adaleti: en eski başvuru üstte (personel-onay deseni). */
export async function listPendingKvkkApplications(): Promise<KvkkApplicationListItem[]> {
  const rows = await db.kvkkApplication.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } });
  return rows.map(toListItem);
}

export async function listDecidedKvkkApplications(limit = 15): Promise<KvkkApplicationListItem[]> {
  const rows = await db.kvkkApplication.findMany({ where: { status: "ANSWERED" }, orderBy: { decidedAt: "desc" }, take: limit });
  return rows.map(toListItem);
}

/** Süre takibi (06 madde B.3) kod DIŞINDA insan süreci — bu fonksiyon yalnız kararı kaydeder. */
export async function decideKvkkApplication(id: string, actor: SessionUser, decision: string): Promise<void> {
  const trimmed = decision.trim();
  if (trimmed.length < 3) throw new Error("Yanıt için kısa bir açıklama yazın (başvurana gösterilir).");

  const existing = await db.kvkkApplication.findUnique({ where: { id }, select: { userId: true, status: true } });
  if (!existing) throw new Error("Başvuru bulunamadı.");
  if (existing.status !== "PENDING") throw new Error("Bu başvuru zaten yanıtlanmış.");

  await db.kvkkApplication.update({
    where: { id },
    data: { status: "ANSWERED", decision: trimmed, decidedAt: new Date() },
  });
  await recordAccess({
    actor, action: "KVKK_APPLICATION_DECIDE", resourceType: "KvkkApplication", resourceId: id,
    subjectUserId: existing.userId, detail: null,
  });
  await notifyUser(existing.userId, {
    type: "KVKK_APPLICATION_ANSWERED",
    title: "KVKK başvurunuz yanıtlandı",
    body: "Başvurunuza verilen yanıtı görüntüleyebilirsiniz.",
    href: "/doctorium/kvkk-basvuru",
  });
}

// 05 madde 3.12 — sonuçlandırılmış başvuru kütüğü 3 yıl saklanır, sonra imha edilir.
const KVKK_RETENTION_MS = 3 * 365 * 24 * 60 * 60 * 1000;

export async function purgeOldKvkkApplications(now: Date = new Date()): Promise<{ purged: number }> {
  const cutoff = new Date(now.getTime() - KVKK_RETENTION_MS);
  const res = await db.kvkkApplication.deleteMany({ where: { decidedAt: { not: null, lt: cutoff } } });
  return { purged: res.count };
}
