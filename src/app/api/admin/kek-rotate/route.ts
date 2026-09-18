import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { kekFromBase64 } from "@/lib/crypto";
import { rotateKek, shortFingerprint, CONFIRM_PHRASE, type RotateKekResult } from "@/lib/kek-rotation";
import { recordAccess, reqMeta } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { IS_DOCTORIUM_DEPLOY } from "@/lib/brand";

// BREAK-GLASS KEK ROTASYONU (2026-09-18 — tatbikat #1 aksiyon A1; /admin "Şifreleme anahtarı" bloğu).
//
// NEDEN: Vercel'deki DATA_ENCRYPTION_KEK Sensitive'dir (geri okunamaz) ve kod anahtarı dışarı vermez (doğru).
// İnsan-okur kopya (parola kasası + kanonik .env) kaybolursa geri dönüş yolu YOKTU: rotasyon betiği eski
// anahtarı ister. Bu uç, Vercel'de çalışan kodun eski KEK'i env'den okuyabilmesine dayanır: operatör
// YENİ KEK'i üretir ve gövdede verir → tüm sarımlar sunucu içinde yeni anahtara taşınır → operatör
// yeniden okunur bir anahtara sahip olur (escrow'lar, env'i İKİ projede değiştirir, redeploy).
//
// KAPI (üç katman — hiçbiri tek başına yetmez):
//   1) Uyku: KEK_ROTATION_SECRET env'i yokken 404 (özelliğin varlığı sızmaz; normalde HİÇ ayakta değil).
//      Operatör break-glass anında env'i Vercel'e yazar (yazma yetkisi = ikinci faktör: Sensitive değerleri
//      okuyamasa da yazabilir), redeploy eder; iş bitince siler.
//   2) ADMIN oturumu (bürünme oturumu YASAK — lib/master-guard deseni).
//   3) Aynı gizli değer istek gövdesinde, sabit-zamanlı karşılaştırma. Yanlış değer + geçerli ADMIN oturumu =
//      uzlaşma sinyali → audit KEK_ROTATION_DENIED + alarm.
// TEHDİT MODELİ: ele geçirilmiş bir yönetici oturumu kendi anahtarına rotasyon yaparsa tüm klinik veri rehin
// kalır (yalnız saldırgan açar). 2-3 bu yüzden ayrı; dry-run varsayılan; APPLY için onay ifadesi şart.
//
// ASLA-LOGLAMA: anahtarlar hiçbir log/audit/alarm/yanıt satırına girmez — yalnız sha256 önekleri (escrow
// belgesiyle aynı reçete, lib/kek-rotation shortFingerprint). Self-auth: proxy /api'yi KORUMAZ.
// Motor şema-güdümlüdür (envanter yok) — kapsam için lib/kek-rotation başlığı.
export const maxDuration = 800; // Pro/Enterprise GA; motor 700 sn bütçeyle sayfa sınırında durur, tekrar çağrı devam eder
export const dynamic = "force-dynamic";

const BUDGET_MS = 700_000;

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function summarize(r: RotateKekResult, oldFp: string, newFp: string): string {
  const t = r.totals;
  return (
    `mode=${r.mode} old=${oldFp} new=${newFp} rewrap=${t.rewrap} already=${t.already} foreign=${t.foreign} ` +
    `blob=${t.blob} blobRotated=${t.blobRotated} unrotatable=${r.unrotatable.length} complete=${r.complete} ` +
    `tables=${r.scanned.tables} columns=${r.scanned.columns} ms=${r.durationMs}`
  );
}

function nextSteps(r: RotateKekResult, newFp: string): string[] {
  const steps: string[] = [];
  const dirty = r.totals.foreign > 0 || r.unrotatable.length > 0;
  if (dirty) {
    steps.push(
      "⛔ Açılamayan (foreign) ya da döndürülemeyen satırlar var — env'i DEĞİŞTİRMEDEN ÖNCE inceleyin: başka ortamın anahtarıyla " +
      "yazılmış satır mı, bozuk veri mi? (Örnekler yanıtta: Tablo.kolon#id.)",
    );
  }
  if (!r.complete) {
    steps.push(
      "⏱ Süre bütçesine takıldı — aynı yeni KEK ile HEMEN yeniden çalıştırın (bitenler 'already' sayılır, tekrar güvenli). " +
      "Tamamlanmadan env'i DEĞİŞTİRMEYİN.",
    );
  }
  if (r.mode === "dry-run") {
    steps.push(
      `Sayımlar beklendiği gibiyse (foreign=0, unrotatable=0): yeni KEK'i ÖNCE escrow'a yazın (parola kasası + kanonik .env ` +
      `PROD_DATA_ENCRYPTION_KEK; parmak izi öneki ${newFp}), SONRA aynı anahtarla "Uygula".`,
    );
    if (r.totals.blob > 0) steps.push(`${r.totals.blob} blob belge (blob:v1:) uygulamada "Blob belgeleri de döndür" açıkken döndürülür.`);
    return steps;
  }
  if (r.complete && !dirty) {
    steps.push(
      `1) Yeni KEK escrow'da mı? (parmak izi öneki ${newFp} — La Casa + kanonik .env). Değilse ŞİMDİ yazın; bu anahtar olmadan veri okunamaz.`,
      "2) Vercel'de DATA_ENCRYPTION_KEK'i İKİ projede (telehealth-mvp + doctorium) yeni değere çevirin ve ikisini de yeniden dağıtın " +
        "(env projeler arasında devralınmaz).",
      "3) Redeploy bitince bu aracı aynı yeni KEK ile bir kez daha çalıştırın: pencere sırasında eski anahtarla yazılmış artçı " +
        "satırlar için (sonuç 'already' ağırlıklı olmalı, 'rewrap' = artçıları yakaladı).",
      "4) Eski KEK'i İMHA ETMEYİN — escrow'da 'arşiv' etiketiyle saklayın (Neon PITR/yedekler rotasyon-öncesi sarımları taşır).",
      "5) KEK_ROTATION_SECRET env'ini kaldırıp yeniden dağıtın (uç yeniden uykuya) ve escrow belgesine rotasyon kaydını düşün.",
    );
  }
  return steps;
}

export async function POST(req: Request) {
  if (IS_DOCTORIUM_DEPLOY) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  const armed = process.env.KEK_ROTATION_SECRET;
  if (!armed) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  if (user.role !== "ADMIN" || user.imp) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== "object") throw new Error();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  const meta = reqMeta(req);

  if (typeof body.secret !== "string" || !safeEqual(body.secret, armed)) {
    await recordAccess({
      actor: user, action: "KEK_ROTATION_DENIED", resourceType: "kek", resourceId: "-", subjectUserId: null,
      detail: "yanlış ikinci faktör", ...meta,
    });
    void sendAlert("kek-rotation-denied", "Break-glass KEK rotasyonu: ADMIN oturumuyla YANLIŞ ikinci faktör (uzlaşma sinyali)", `actor=${user.id}`);
    return NextResponse.json({ error: "İkinci faktör doğrulanamadı." }, { status: 403 });
  }

  const oldRaw = process.env.DATA_ENCRYPTION_KEK;
  let oldKek: Buffer;
  try {
    if (!oldRaw) throw new Error();
    oldKek = kekFromBase64(oldRaw);
  } catch {
    return NextResponse.json({ error: "DATA_ENCRYPTION_KEK bu dağıtımda tanımsız ya da geçersiz — rotasyon yapılamaz." }, { status: 503 });
  }
  const newRaw = body.newKek;
  if (typeof newRaw !== "string" || !newRaw.trim()) {
    return NextResponse.json({ error: "Yeni KEK gerekli (base64, 32 byte — openssl rand -base64 32)." }, { status: 400 });
  }
  let newKek: Buffer;
  try {
    newKek = kekFromBase64(newRaw.trim());
  } catch {
    return NextResponse.json({ error: "Yeni KEK 32 byte base64 olmalı (openssl rand -base64 32)." }, { status: 400 });
  }
  if (oldKek.equals(newKek)) return NextResponse.json({ error: "Yeni KEK mevcut anahtarla aynı — rotasyon anlamsız." }, { status: 400 });

  const apply = body.mode === "apply";
  const blobs = body.blobs !== false; // varsayılan AÇIK — runbook dersi: "--blobs unutulursa" yarım rotasyon
  if (apply && body.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json({ error: `Uygulamak için onay ifadesi tam olarak "${CONFIRM_PHRASE}" yazılmalı.` }, { status: 400 });
  }

  const oldFp = shortFingerprint(oldRaw as string);
  const newFp = shortFingerprint(newRaw.trim());
  const start = Date.now();
  let result: RotateKekResult;
  try {
    result = await rotateKek({ db, oldKek, newKek, apply, blobs, deadline: start + BUDGET_MS });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "bilinmeyen hata";
    await recordAccess({
      actor: user, action: "KEK_ROTATION", resourceType: "kek", resourceId: newFp, subjectUserId: null,
      detail: `mode=${apply ? "apply" : "dry-run"} old=${oldFp} new=${newFp} HATA: ${msg}`, ...meta,
    });
    if (apply) void sendAlert("kek-rotation", "Break-glass KEK rotasyonu HATAYLA KESİLDİ — yazılanlar geçerli, aynı anahtarla yeniden koşun", `old=${oldFp} new=${newFp} ${msg}`);
    return NextResponse.json({ error: `Rotasyon hatası: ${msg}`, oldFingerprint: oldFp, newFingerprint: newFp }, { status: 500 });
  }

  const summary = summarize(result, oldFp, newFp);
  await recordAccess({
    actor: user, action: "KEK_ROTATION", resourceType: "kek", resourceId: newFp, subjectUserId: null, detail: summary, ...meta,
  });
  if (apply) {
    void sendAlert(
      "kek-rotation",
      result.complete
        ? "Break-glass KEK rotasyonu UYGULANDI — DATA_ENCRYPTION_KEK'i İKİ Vercel projesinde yeni anahtara geçirin"
        : "Break-glass KEK rotasyonu KISMEN uygulandı (süre bütçesi) — aynı anahtarla yeniden koşun",
      summary,
    );
  }
  if (result.totals.foreign > 0 || result.unrotatable.length > 0) {
    void sendAlert("kek-rotation-foreign", "KEK rotasyonu: açılamayan (foreign) ya da döndürülemeyen satırlar var — env değiştirmeden inceleyin", summary);
  }

  return NextResponse.json({
    ok: true,
    oldFingerprint: oldFp,
    newFingerprint: newFp,
    ...result,
    nextSteps: nextSteps(result, newFp),
  });
}
