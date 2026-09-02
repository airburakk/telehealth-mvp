// Sistem mesajları (v6.79) — bildirimden AYRI, içerikli + iş-akışına bağlı (talep→yanıt) katman.
// İlk kullanım: etik kurulun karşı taraftan savunma/bilgi talebi (kind=DEFENSE_REQUEST).
// Hedefleme Notification ile aynı: rol yayını (role) VEYA kişisel (userId).
// PHI kuralı: body/reply at-rest ŞİFRELİ; subject düz metin olduğundan SABİT ŞABLON + maskCaseId
// taşır; Web Push DAİMA jeneriktir ("Yeni sistem mesajınız var") — içerik dış kanala çıkmaz.
// Fire-safe: mesaj yazılamazsa çağıran akış (kurul kararı vb.) bozulmaz (lib/notify deseni).
import { db } from "./db";
import { encryptField } from "./crypto";
import { sendPushToRoles, sendPushToUser } from "./push";
import { publishLiveNudge } from "./ably-server";
import { DEFENSE_LOCK_DAYS } from "./ethics";

// En az biri dolu: userId (kişisel) ya da role (yayın).
export interface SystemMessageTarget {
  userId?: string;
  role?: string;
}

// Saf yönlendirme kuralı (birim-test edilebilir; DB'siz):
// - DOCTOR + atanmış doktorun kullanıcı hesabı varsa → kişisel (tüm doktorlara yayın YAPILMAZ)
// - AGENCY → rol yayını (vakaya bağlı acente HESABI yok — MVP sınırı; bağ kurulunca kişiselleşir)
// - HOSPITAL / OTHER / hedefsiz DOCTOR → COORDINATOR (platformda hesabı olmayan tarafların
//   iletişimini S2 operasyon yürütür; atanmamış doktor kenarında da boşluğa düşmez)
export function resolveDefenseTargetPure(respondentType: string | null, doctorUserId: string | null): SystemMessageTarget {
  if (respondentType === "DOCTOR" && doctorUserId) return { userId: doctorUserId };
  if (respondentType === "AGENCY") return { role: "AGENCY" };
  return { role: "COORDINATOR" };
}

// DB'li sarmalayıcı: vakaya atanmış doktorun kullanıcı hesabını bulup saf kurala verir.
export async function resolveDefenseTarget(respondentType: string | null, caseDoctorId: string | null): Promise<SystemMessageTarget> {
  let doctorUserId: string | null = null;
  if (respondentType === "DOCTOR" && caseDoctorId) {
    const u = await db.user.findFirst({ where: { role: "DOCTOR", doctorId: caseDoctorId }, select: { id: true } });
    doctorUserId = u?.id ?? null;
  }
  return resolveDefenseTargetPure(respondentType, doctorUserId);
}

// Saf kilit hesabı (birim-test edilebilir): yanıtsız VE süresi dolmamış talep varsa kilitli.
// Süre dolunca kendiliğinden açılır — cron GEREKMEZ (cron'suz bilinçli tasarım; Hobby döneminde cron da açılamazdı).
export function computeDefenseLock(
  requests: { createdAt: Date; repliedAt: Date | null }[],
  now: Date = new Date()
): { locked: boolean; until: Date | null } {
  const horizonMs = DEFENSE_LOCK_DAYS * 24 * 60 * 60 * 1000;
  let until: Date | null = null;
  for (const r of requests) {
    if (r.repliedAt) continue;
    const deadline = new Date(r.createdAt.getTime() + horizonMs);
    if (deadline.getTime() > now.getTime() && (!until || deadline > until)) until = deadline;
  }
  return { locked: until !== null, until };
}

// Başvurunun karar kilidi durumu — hem etik kurul sayfası hem PATCH /api/complaints kullanır
// (UI kilidi tek başına yetmez; sunucu tarafı da reddeder).
export async function defenseLockState(complaintId: string): Promise<{ locked: boolean; until: Date | null }> {
  const reqs = await db.systemMessage.findMany({
    where: { threadKey: `complaint:${complaintId}`, kind: "DEFENSE_REQUEST", needsReply: true },
    select: { createdAt: true, repliedAt: true },
  });
  return computeDefenseLock(reqs);
}

// Sistem mesajı yaz: şifreli body + jenerik push + canlı dürtü ("notify" kanalı yeniden
// kullanılır — istemci tek dürtüyle hem bildirimi hem sistem mesajlarını yeniler).
export async function sendSystemMessage(input: {
  target: SystemMessageTarget;
  kind: string;
  subject: string;
  body: string;
  threadKey?: string;
  needsReply?: boolean;
}): Promise<string | null> {
  try {
    const created = await db.systemMessage.create({
      data: {
        role: input.target.role ?? null,
        userId: input.target.userId ?? null,
        kind: input.kind,
        subject: input.subject,
        body: encryptField(input.body),
        threadKey: input.threadKey ?? null,
        needsReply: input.needsReply ?? false,
      },
    });
    const push = { title: "Yeni sistem mesajınız var", href: "/mesajlar" };
    if (input.target.userId) await sendPushToUser(input.target.userId, push);
    else if (input.target.role) await sendPushToRoles([input.target.role], push);
    await publishLiveNudge("notify");
    return created.id;
  } catch (e) {
    console.warn("[system-messages] mesaj yazılamadı (akış bozulmaz):", e instanceof Error ? e.message : e);
    return null;
  }
}
