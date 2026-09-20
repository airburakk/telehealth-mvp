import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clinicalDoctorFor } from "@/lib/doctor-activation";
import { CASE_LIST_SELECT, caseLaneOf, doctorQueueScope, queueOrderBy, scopedWhere, staffQueueScope } from "@/lib/case-access";
import { runTriage } from "@/lib/triage-llm";
import { notifyDoctorsByBranch, notifyUser } from "@/lib/notify";
import { requireUser, requireStaff } from "@/lib/api-auth";
import { stampPatientProfile } from "@/lib/patient-journey";
import { parseContactFields } from "@/lib/contact-pref";
import { encryptField, decryptField } from "@/lib/crypto";
import { PREVIEW_ANON_LABEL } from "@/lib/case-preview";
import { storeDocument, deleteDocument } from "@/lib/storage";
import { detectDocumentKind, DOC_REJECT_MESSAGE } from "@/lib/document-mime";
import { requireAiTriage } from "@/lib/ai-gate";

// GET /api/cases — vaka kuyruğu (filtrelenebilir + sayfalı, /denetim getChainAudit deseni)
export async function GET(req: Request) {
  // Vaka kuyruğu = klinik personel. Kimliksiz PHI dökümü kapandı (T1/P0).
  const { user, error } = await requireStaff();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  // Sayfalama: varsayılan 50, üst sınır 100 (tüm tabloyu tek yanıtta taşıma).
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10) || 50));

  // Kapsam TEK KAYNAK — lib/case-access (kontrol raporu 2026-09-17 K02): doktor ana sayfası ile bu uç eskiden
  // AYRI where kuruyordu (sayfada doctorId:null/deletionLockedAt:null yoktu, burada activatedAt bakılmıyordu).
  // DOCTOR → clinicalDoctorFor (verified + activatedAt + branş; eksikse boş küme — 2026-08-03 `verified` dersi
  // + v6.87 aktivasyon şartı), COORDINATOR/ETHICS/ADMIN → tüm kuyruk. Hesap silme kilidi (v6.11) her kapsamda:
  // kilitli vaka nesne düzeyinde HERKESE kapalıdır, liste de onu göstermez. Havuz dalı NEW/IN_REVIEW allowlist
  // (DOCS_PENDING havuza düşmez — 2026-07-24).
  const scope = user.role === "DOCTOR" ? doctorQueueScope(await clinicalDoctorFor(user.id)) : staffQueueScope();
  const where = scopedWhere(scope, { branch, status });
  const total = await db.case.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // İstenen sayfayı geçerli aralığa sıkıştır (0/negatif/NaN/aşırı-büyük güvenli).
  const page = Math.min(Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1), totalPages);

  const cases = await db.case.findMany({
    where,
    select: CASE_LIST_SELECT, // dar liste-DTO (sayfa ile aynı): klinik metin/belge içeriği taşınmaz
    orderBy: queueOrderBy("urgency"),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  // Yalnız kimlik (patientName) at-rest şifreli → çöz (E2EE inc.2c). attachments/tourismPlan/freeCare ham
  // hâlleriyle DEĞİL türetimleriyle (hasFiles / lane) döner.
  const items = cases.map(({ attachments, tourismPlan, freeCare, ...c }) => ({
    ...c,
    // K06 1C-a: doktorun ATANMAMIŞ havuz satırı kimliksiz (A09 madde 10.1) — ad yalnız atanmış vakada çözülür; personel dalı 1C-b'ye kadar aynen.
    patientName: user.role === "DOCTOR" && !c.doctor ? PREVIEW_ANON_LABEL : decryptField(c.patientName),
    hasFiles: !!attachments,
    lane: caseLaneOf({ tourismPlan, freeCare }),
  }));
  return NextResponse.json({ items, total, page, pageSize, totalPages });
}

// POST /api/cases — yeni vaka oluştur (triyaj sunucu tarafında yeniden hesaplanır)
export async function POST(req: Request) {
  // Vaka oluşturma giriş ister → anonim vaka + ölçümsüz AI (DoS/maliyet) kapandı (T1).
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => ({}));

  const patientName = String(body.patientName ?? "").trim();
  const symptoms = String(body.symptoms ?? "").trim();
  if (!patientName || !symptoms) {
    return NextResponse.json({ error: "Hasta adı ve şikayet zorunludur." }, { status: 400 });
  }

  // ── AI kapısı (kontrol raporu 2026-09-17 K04, P1): rol · hız (kullanıcı+IP) · AKTİF rıza · boyut — `runTriage`'dan
  // ÖNCE, önizleme ucu (/api/triage/analyze) ile AYNI yardımcı. Eskiden bu uç yalnız requireUser'a bakıyordu; istemcideki
  // AiConsentGate atlanınca rızasız / sınırsız LLM çağrısı + 201 mümkündü (raporun yerel provası bunu doğruladı).
  const gate = await requireAiTriage(user, req, body);
  if (!gate.ok) return gate.response;

  // ── Belge doğrulaması (K07, P2) — HİÇBİR yazımdan ve LLM çağrısından ÖNCE. Eskiden vaka önce yazılıyor, 415 sonra
  // dönüyordu → hasta hata görürken DB'de vaka kalıyor, tekrar denemede kopya başvuru oluşuyordu.
  // Yalnız base64 içerikli olanlar saklanır; büyük dosyalar yalnız ad olarak attachments'ta kalır.
  // DICOM (v6.33): ≤8MB .dcm ASLIYLA (kullanıcı kararı — tıbbi kayıt aslı; şifreli) saklanır; AI
  // değerlendirme DICOM'u atlar, doktor kokpit görüntüleyicisi /api/cases/[id]/documents/[docId]/dicom'dan açar.
  type RawDoc = { label?: unknown; mimeType?: unknown; content?: unknown };
  const documents: RawDoc[] = Array.isArray(body.documents) ? body.documents : [];
  const validDocs = documents
    .filter((d) => typeof d.content === "string" && (d.content as string).startsWith("data:"))
    .slice(0, 12);
  // İçerik-tipi kapısı (2026-08-03 P0): tip istemci beyanından DEĞİL dosya imzasından tespit edilir.
  // Tanınmayan dosya SESSİZCE DÜŞÜRÜLMEZ — hasta belgesini yüklediğini sanmasın diye açık hata döner.
  const kinds = validDocs.map((d) => detectDocumentKind(d.content as string));
  if (kinds.some((k) => k === null)) {
    return NextResponse.json({ error: DOC_REJECT_MESSAGE }, { status: 415 });
  }

  const a = await runTriage(gate.input);

  const attachments: string | null = Array.isArray(body.attachments) && body.attachments.length
    ? body.attachments.join(",")
    : null;

  const contact = parseContactFields(body); // FAZ 8 — telefon + iletişim tercihi

  // Eksik zorunlu belge beyanı (triyaj adım-2 docAck yolu): etiket listesi client'tan gelir.
  const missingDocs: string[] = Array.isArray(body.missingDocs)
    ? body.missingDocs.filter((d: unknown) => typeof d === "string").map((d: string) => d.slice(0, 80)).slice(0, 12)
    : [];
  // DOCS_PENDING (2026-07-24, kullanıcı kararı): eksik zorunlu belgeyle gelen başvuru doktor
  // havuzuna DÜŞMEZ — hasta vaka merkezinde belgeleri tamamlayınca NEW'e geçer (pending-docs ucu).
  // ACİL İSTİSNASI (kullanıcı kararı): aciliyet 4-5 vaka belge yüzünden BEKLETİLMEZ (klinik risk).
  const docsPending = missingDocs.length > 0 && a.urgency < 4;

  // Belge içerikleri object storage'a (varsa) taşınır; yoksa at-rest şifreli inline (E2EE Faz 1). T11.
  // Yükleme İŞLEMDEN ÖNCE (Blob çağrısı transaction içinde tutulamaz); işlem düşerse nesneler temizlenir (yetim yok).
  const storedRefs = await Promise.all(validDocs.map((d) => storeDocument(d.content as string, { keyPrefix: "case-doc" })));

  // Vaka + belgeler TEK işlem (K07): ikisi de yazılır ya da hiçbiri — yarım başvuru kalmaz. Triyajda yüklenen
  // içerikli belgeler → CaseDocument (doktor kokpitte AI ile değerlendirir + Türkçeye çevirir).
  const created = await db
    .$transaction(async (tx) => {
      const c = await tx.case.create({
        data: {
          userId: user.id, // vaka sahibi = oturum kullanıcısı (hasta yalnız kendi vakalarını görür)
          patientName: encryptField(patientName), // kimlik at-rest şifreli (E2EE inc.2c)
          country: String(body.country ?? "TR"),
          language: String(body.language ?? "Türkçe"),
          symptoms: encryptField(symptoms),
          durationText: body.durationText ? String(body.durationText) : null,
          extra: encryptField(body.answers ? JSON.stringify(body.answers) : null), // branş soruları JSON (E2EE Faz 1)
          attachments,
          branch: a.branch,
          urgency: a.urgency,
          confidence: a.confidence,
          reasoning: encryptField(a.reasoning), // triyaj gerekçesi (E2EE Faz 1)
          status: docsPending ? "DOCS_PENDING" : "NEW",
          pendingDocs: docsPending ? JSON.stringify(missingDocs) : null,
          // Hasta iletişim (FAZ 8): telefon kimlik verisi → şifreli; tercih (APP|SMS|EMAIL) düz.
          patientPhone: contact.phone ? encryptField(contact.phone) : null,
          contactPreference: contact.contactPreference,
          consultFee: typeof body.consultFee === "number" ? body.consultFee : null,
          // Sigortayla ödeme yolu kaldırıldı (2026-08-05): INSURED artık kabul edilmez; Case.policyNo
          // kolonu yalnız tarihsel kayıtlar için şemada durur, yeni vakaya yazılmaz.
          payStatus: String(body.payStatus) === "PAID" ? "PAID" : "PENDING",
          payMethod: body.payMethod ? String(body.payMethod) : null,
          payRef: body.payRef ? String(body.payRef).slice(0, 40) : null,
        },
      });
      if (validDocs.length) {
        await tx.caseDocument.createMany({
          data: validDocs.map((d, i) => ({
            caseId: c.id,
            label: typeof d.label === "string" ? d.label.slice(0, 200) : "belge",
            mimeType: kinds[i]!.mime, // TESPİT EDİLEN tip saklanır (istemcinin beyanı kullanılmaz)
            content: storedRefs[i],
          })),
        });
      }
      return c;
    })
    .catch(async (e: unknown) => {
      await Promise.all(storedRefs.map((r) => deleteDocument(r)));
      throw e;
    });

  if (docsPending) {
    // DOCS_PENDING: doktor bildirimleri GÖNDERİLMEZ (vaka havuzda değil) — hasta belgeleri
    // tamamlayınca pending-docs ucu NEW_CASE bildirimini o anda gönderir. Hastaya yol gösterici
    // bildirim (metin kullanıcı onaylı; içerik jenerik — belge adları PHI değil ama gerek de yok).
    await notifyUser(user.id, {
      type: "MISSING_DOCS",
      title: `📄 Belgeleriniz bekleniyor`,
      body: `Başvurunuz alındı; doktora iletilmesi için eksik belgelerinizi yükleyin.`,
      href: `/vaka/${created.id}`,
    });
  } else {
    // §1/§7: yeni klinik vaka koordinatöre DEĞİL doktor kuyruğuna düşer (koordinatör yalnız M3/S3 rezervasyon).
    // Yeni vakada henüz atanan doktor YOK → tüm doktorlara yayın yerine yalnız vakanın BRANŞINDAKİ
    // portal doktorlarına kişisel bildirim (atama Nöbetçi/İcapçı kapınca yapılır).
    await notifyDoctorsByBranch(a.branch, {
      type: "NEW_CASE",
      title: `${a.urgency >= 4 ? "🔴 " : ""}Yeni vaka`, // isim bildirime gömülmez (E2EE inc.2c) → personel kokpitte görür
      body: `${a.branch} · aciliyet ${a.urgency}/5`,
      href: `/doktor/vaka/${created.id}`,
    });

    // Eksik belge bildirim botu: yalnız acil-istisna yolunda anlamlı (aciliyet 4-5 belge beklemeden
    // havuza düştü → doktor eksik belgeyle geleceğini bilsin). Belge-bekleyen vakada gönderilmez.
    if (missingDocs.length) {
      await notifyDoctorsByBranch(a.branch, {
        type: "MISSING_DOCS",
        title: `📄 Eksik belge`,
        body: `${a.branch} · eksik: ${missingDocs.join(", ")}`,
        href: `/doktor/vaka/${created.id}`,
      });
    }
  }

  // Nav bileşimi + profil hafızası (Faz 0): journey ve iletişim/ülke/dil User'a yaz-geri
  await stampPatientProfile(user.id, user.role, {
    journey: "GENERAL",
    country: String(body.country ?? ""), language: String(body.language ?? ""),
    phone: contact.phone, contactPref: contact.contactPreference,
  });

  return NextResponse.json(created, { status: 201 });
}
