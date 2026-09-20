import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reqMeta } from "@/lib/audit";
import { auraLegalDoc } from "@/lib/aura-legal";
import { LANG_NAME_BY_CODE } from "@/lib/constants";
import { approveLegalTranslation, generateLegalTranslation, LegalApprovalConflict, revokeLegalTranslation } from "@/lib/legal-approval";

// Hukuki çeviri onay eylemleri (7-C, v6.286 · 2026-09-20) — /admin/hukuki-ceviri "Onayla · Onayı kaldır · Çeviriyi üret".
// Self-auth: yalnız ADMIN (proxy /admin'i korur ama /api'yi KORUMAZ — her uç kendi kapısı; admin/kvkk-basvurulari deseni).
// `lang` dil kodu (ru) ya da Türkçe adı (Rusça) olabilir. generate: eksik birimler Claude ile çevrilir (belge başına ~30–60 sn).
export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const doc = auraLegalDoc(String(b.slug ?? ""));
  if (!doc) return NextResponse.json({ error: "Belge bulunamadı." }, { status: 400 });
  const rawLang = String(b.lang ?? "");
  const lang = LANG_NAME_BY_CODE[rawLang] ?? rawLang;
  const action = String(b.action ?? "");
  const meta = reqMeta(req);

  try {
    if (action === "approve") {
      const row = await approveLegalTranslation({
        slug: doc.slug, lang, textHash: String(b.textHash ?? ""), note: typeof b.note === "string" ? b.note : null, actor: user, ...meta,
      });
      return NextResponse.json({ ok: true, approvedAt: row.approvedAt });
    }
    if (action === "revoke") {
      await revokeLegalTranslation({ slug: doc.slug, lang, actor: user, ...meta });
      return NextResponse.json({ ok: true });
    }
    if (action === "generate") {
      const r = await generateLegalTranslation({ slug: doc.slug, lang, actor: user, ...meta });
      return NextResponse.json({ ok: true, units: r?.units ?? 0, translated: r?.translated ?? 0, complete: r?.complete ?? false });
    }
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (e) {
    const status = e instanceof LegalApprovalConflict ? 409 : 400;
    return NextResponse.json({ error: e instanceof Error ? e.message : "İşlem tamamlanamadı." }, { status });
  }
}
