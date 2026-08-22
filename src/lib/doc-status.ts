// Belge durum rozeti — status × verifiedSource → metin + ton (v6.119, onay 2026-08-19).
// 2026-08-23: DoctorDocuments.tsx'ten (client) buraya ÇIKARILDI — landing V2'nin "Profesyonel alan"
// bölümü temsilî rozeti aynı kaynaktan çizer (kopya = drift; chrome-routes.ts dersi). Saf fonksiyon,
// istemci/sunucu fark etmez.
//
// LEGACY bilinçli NÖTR ve "Kayıtlı" ("Onaylandı" DEĞİL): backfill'lenen belgeler gerçekten
// incelenmedi — emerald yanlış güven telkin ederdi. "İncelemede" yalnız kapı tutan tiplerde
// (DIPLOMA/STUDENT_CERT) gösterilir: ihtiyari belgede PENDING varsayılan hâldir, bir inceleme
// kuyruğu vaadi değildir. ACCEPTED/REJECTED ise her tipte gösterilir (gerçek inceleme sonucu).
export interface DocStatusInput {
  type: string;
  status?: string | null; // PENDING | ACCEPTED | REJECTED
  verifiedSource?: string | null; // EDEVLET | MANUAL | LEGACY
}

export function statusRozet(d: DocStatusInput): { text: string; cls: string } | null {
  if (!d.status) return null;
  if (d.status === "ACCEPTED") {
    if (d.verifiedSource === "LEGACY") return { text: "Kayıtlı", cls: "bg-[var(--c-ink)]/10 text-[var(--c-ink-2)]" };
    if (d.verifiedSource === "EDEVLET") return { text: "e-Devlet ile doğrulandı", cls: "bg-emerald-500/15 text-emerald-300" };
    return { text: "Onaylandı", cls: "bg-emerald-500/15 text-emerald-300" };
  }
  if (d.status === "REJECTED") return { text: "Yeniden yükleyin", cls: "bg-red-500/15 text-red-300" };
  if (d.type === "DIPLOMA" || d.type === "STUDENT_CERT") return { text: "İncelemede", cls: "bg-amber-500/15 text-amber-300" };
  return null;
}
