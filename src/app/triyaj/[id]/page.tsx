import { redirect } from "next/navigation";

// Triyaj sonuç sayfası tek hasta vaka merkezine taşındı (basitleştirme Faz 6, 2026-07-12) —
// içerik + 3-seçenek kapısı + tracker artık /vaka/[caseId] hub'ında. Eski linkler/bildirimler
// için kalıcı köprü (auth/BOLA kapısını hub kendisi yapar).
export default async function TriyajResultRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/vaka/${id}`);
}
