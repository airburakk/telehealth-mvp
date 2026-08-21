import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasDoctoriumAccess } from "@/lib/doctor-activation";
import {
  BRANCH_OPTIONS, effectiveBranches, parseFeedModules, personalFeedPage, singleBranchFeedPage,
  localizeTitles, savedArticleIds, type FeedCursors, type FeedModuleKey,
} from "@/lib/doctorium";

// Doctorium Akışım — sonsuz kaydırma "sonraki sayfa" (2026-08-21). Middleware /api'yi KORUMAZ —
// rota kendi auth'unu yapar (proje kuralı): sayfa kapısıyla (layout.tsx) AYNI şart, derinlik
// savunması. DOCTOR rolü hasDoctoriumAccess (Aşama 1: doğrulanmış diploma veya öğrenci belgesi)
// ister; COORDINATOR/ADMIN gözetim erişimiyle geçer (layout.tsx'teki dal aynen).
//
// `cursor` OPAK: istemci page.tsx'te ilk sayfayla gelen cursor'ı olduğu gibi saklar, her istekte
// geri gönderir, yanıttaki `nextCursor`'ı bir sonraki isteğe taşır — içeriğini hiç ayrıştırmaz
// (personalFeedPage modül-başına cursor / singleBranchFeedPage tek cursor döndürür, biçim
// çağırana göre değişir; JSON.stringify ile sarmalanmış opak string bu farkı gizler).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  let branches: string[] = [];
  let feedMods: FeedModuleKey[] = [];
  let doctorId: string | null = null;
  if (user.role === "DOCTOR") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    const doctor = me?.doctorId
      ? await db.doctor.findUnique({
          where: { id: me.doctorId },
          select: {
            id: true, branch: true, newsBranches: true, feedModules: true,
            diplomaVerifiedAt: true, studentVerifiedAt: true,
          },
        })
      : null;
    if (!doctor || !hasDoctoriumAccess(doctor)) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    branches = effectiveBranches(doctor.newsBranches, doctor.branch);
    feedMods = parseFeedModules(doctor.feedModules);
    doctorId = doctor.id;
  }
  // COORDINATOR/ADMIN branches=[]/feedMods=[] (tümü) ile devam eder — page.tsx'te doctor=null
  // olduğunda personalFeed(branches=[], ...) aynı şekilde çağrılıyor (gözetim erişimi).

  const url = new URL(req.url);
  const focusParam = url.searchParams.get("focus");
  const cursorParam = url.searchParams.get("cursor");
  if (!cursorParam) return NextResponse.json({ error: "cursor gerekli" }, { status: 400 });

  let focus: string | null = null;
  if (focusParam) {
    // Yalnız doktorun AKIŞINDAKİ branşlar (page.tsx'teki ?b= kuralıyla aynı — sayfa kararı
    // 2026-08-18: rastgele slug'la başka akış açılmasın).
    const validSlugs = new Set(BRANCH_OPTIONS.map((b) => b.slug));
    if (!validSlugs.has(focusParam) || !branches.includes(focusParam)) {
      return NextResponse.json({ error: "Geçersiz branş" }, { status: 400 });
    }
    focus = focusParam;
  }

  try {
    const page = focus
      ? await singleBranchFeedPage(focus, 30, JSON.parse(cursorParam) as { at: string; id: string })
          .then((p) => ({ items: p.items, nextCursor: p.cursor ? JSON.stringify(p.cursor) : null }))
      : await personalFeedPage(branches, feedMods, JSON.parse(cursorParam) as FeedCursors, 40)
          .then((p) => ({ items: p.items, nextCursor: p.done ? null : JSON.stringify(p.cursors) }));

    const items = page.items.length ? await localizeTitles(page.items) : page.items;
    // Faz 2 (2026-08-14) deseni: Kaydet düğmesinin başlangıç durumu — yalnız DOCTOR'da (personel
    // kaydedemez, page.tsx'te de aynı ayrım). Öğrenci-sınırlı üye DAHİL (kaydetme içerik işlevi).
    const saved = doctorId ? await savedArticleIds(doctorId) : null;
    return NextResponse.json({
      items: items.map((it) => ({ ...it, saved: saved ? saved.has(it.id) : null })),
      nextCursor: page.nextCursor,
    });
  } catch {
    return NextResponse.json({ error: "Geçersiz cursor" }, { status: 400 });
  }
}
