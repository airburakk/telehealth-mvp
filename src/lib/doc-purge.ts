// Doktor mesleki belgesi İMHA katmanı — KVKK minimizasyonu (2026-08-30, kullanıcı/hukukçu kararı).
//
// KURAL: doğrulama tamamlanan zorunlu belgenin DOSYASI saklanmaz — yalnız karar kalır
// (status + verifiedAt + verifiedSource + şifreli verifyCode = e-Devlet barkodu; belge resmî
// kaynaktan her an yeniden doğrulanabilir). Reddedilen belge, itiraz/ispat penceresi için
// REJECTED_RETENTION_DAYS boyunca saklanır, sonra aynı yoldan imha edilir.
//
// KAPSAM: yalnız PURGE_DOC_TYPES (bugün DIPLOMA — Doctorium/Aşama 1'in tek zorunlu belgesi).
// MMSS/CERTIFICATE/ACADEMIC bilinçli DIŞARIDA (kullanıcı kararı 2026-08-30): onlar AURA klinik
// kulvarının belgeleri, saklama-imha kuralları v6.91/96 hukuk paketiyle ayrıca ele alınacak.
//
// İMHA MEKANİĞİ: content kolonuna purged:v1:<tarih> sentinel'i yazılır (lib/storage ref ailesi —
// şema değişikliği YOK), Blob nesnesi varsa silinir, kayıt audit zincirine düşer (DOCTOR_DOC_PURGE;
// dosya içeriği/PHI audit'e GİRMEZ). ⚠️ Blob silinemezse sentinel YAZILMAZ — ref ezilirse yetim
// nesne bir daha OTOMATİK bulunamaz (purge-deleted'daki failedBlobs dersi); satır dokunulmadan
// bırakılır, günlük süpürme ertesi koşuda yeniden dener (kendini onaran döngü).
import { db } from "./db";
import { deleteDocument, isPurgedRef, purgedRef, PURGED_PREFIX } from "./storage";
import { recordAccess } from "./audit";
import type { SessionUser } from "./session";

/** Reddedilen belgenin itiraz/ispat saklama penceresi (gün) — 👤 03.09.2026 (belge 11 §C.3 / 05 §3.3): 180 → 90. */
export const REJECTED_RETENTION_DAYS = 90;

/** İmha kapsamındaki belge tipleri — yalnız Doctorium zorunlu belgesi. */
export const PURGE_DOC_TYPES = ["DIPLOMA"];

/**
 * Saf imha kararı (birim testli — tests/unit/doc-purge.test.ts): bu satırın dosyası silinmeli mi?
 *  - Zaten imha edilmişse hayır (idempotens).
 *  - ACCEPTED → evet (LEGACY damgalılar dahil — backfill bu kuralla kendiliğinden olur).
 *  - REJECTED → yükleme tarihinden itibaren saklama penceresi dolduysa evet. (Şemada karar tarihi
 *    kolonu yok; createdAt üst sınırdır — pencere en geç "yükleme + 90 gün"de kapanır, bu da
 *    minimizasyon lehine olan yorumdur.)
 */
export function shouldPurgeDoc(
  d: { type: string; status: string; content: string; createdAt: Date },
  now: Date = new Date(),
): boolean {
  if (!PURGE_DOC_TYPES.includes(d.type)) return false;
  if (isPurgedRef(d.content)) return false;
  if (d.status === "ACCEPTED") return true;
  if (d.status === "REJECTED") {
    const cutoff = now.getTime() - REJECTED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return d.createdAt.getTime() < cutoff;
  }
  return false; // PENDING: inceleme bekliyor — dosya incelemeci için durmalı
}

/**
 * Tek belgenin dosyasını imha et: Blob nesnesi silinir → kolona sentinel yazılır → audit'e düşer.
 * Dönüş "blob-failed" ise HİÇBİR ŞEY değiştirilmemiştir (yukarıdaki ⚠️ gerekçesi).
 */
export async function purgeDocContent(
  doc: { id: string; doctorId: string; type: string; content: string },
  reason: "DOGRULAMA_ONAYI" | "RET_SAKLAMA_SURESI",
  actor: SessionUser | null,
): Promise<"purged" | "blob-failed"> {
  const ok = await deleteDocument(doc.content);
  if (!ok) return "blob-failed";
  await db.doctorDocument.update({ where: { id: doc.id }, data: { content: purgedRef() } });
  const u = await db.user.findFirst({ where: { doctorId: doc.doctorId }, select: { id: true } });
  await recordAccess({
    actor,
    action: "DOCTOR_DOC_PURGE",
    resourceType: "DOCTOR",
    resourceId: doc.doctorId,
    subjectUserId: u?.id ?? null,
    detail: `belge=${doc.type} docId=${doc.id} neden=${reason}`,
  });
  return "purged";
}

export interface DocSweepResult {
  swept: number; // dosyası imha edilen satır
  blobFailed: number; // Blob'u silinemediği için DOKUNULMAYAN satır (ertesi koşu yeniden dener)
}

/**
 * Günlük süpürme (purge-deleted cron'unda — imha/bütünlük ailesi; v6.205'te nöbet bölündü, bu iş imha ailesinde kaldı):
 * doğrulanmış diplomaların dosyalarını (mevcut/LEGACY kayıtlar dahil — backfill) ve saklama süresi
 * dolan reddedilmişleri imha eder. Doğrulama ANINDA yapılan imhaların kaçağını da yakalar
 * (ör. inceleme onayında Blob silinememişse). Batch sınırlı — kalan ertesi güne (idempotent).
 */
export async function sweepDoctorDocuments(limit = 100, now: Date = new Date()): Promise<DocSweepResult> {
  const cutoff = new Date(now.getTime() - REJECTED_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db.doctorDocument.findMany({
    where: {
      type: { in: [...PURGE_DOC_TYPES] },
      NOT: { content: { startsWith: PURGED_PREFIX } }, // content NOT NULL — null-eleme tuzağı yok
      OR: [{ status: "ACCEPTED" }, { status: "REJECTED", createdAt: { lt: cutoff } }],
    },
    select: { id: true, doctorId: true, type: true, status: true, content: true },
    take: limit,
  });
  let swept = 0;
  let blobFailed = 0;
  for (const r of rows) {
    const reason = r.status === "ACCEPTED" ? "DOGRULAMA_ONAYI" : "RET_SAKLAMA_SURESI";
    const res = await purgeDocContent(r, reason, null); // actor=null: sistem koşusu
    if (res === "purged") swept += 1;
    else blobFailed += 1;
  }
  return { swept, blobFailed };
}
