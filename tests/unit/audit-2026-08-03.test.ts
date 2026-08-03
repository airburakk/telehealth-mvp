// Birim testleri — 2026-08-03 dış güvenlik denetiminde kapatılan açıklar.
//
// Bu dosyanın amacı bir REGRESYON KİLİDİDİR: aşağıdaki üç P0 canlı koda gitmiş, iç denetimden
// (41 ajan, 2026-07-18) geçmiş ve ancak dışarıdan bakılınca görülmüştü. Testler, aynı deseni
// geri getirecek bir değişikliği yakalar.
//
//   P0-A  liste ucu yetkilendirmesi   → soCaseListScope
//   P0-B  belge içerik tipi           → detectDocumentKind / documentResponseHeaders
//   P0-C  paylaşım şifre kapısı       → issueUnlockToken / verifyUnlockToken
//   +     hasta-beyanı uçları         → isCasePatient
//   +     harici bağlantı şeması      → safeExternalUrl
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: vi.fn() }, doctor: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));

import { soCaseListScope, isCasePatient } from "@/lib/ownership";
import { detectDocumentKind, documentResponseHeaders } from "@/lib/document-mime";
import { issueUnlockToken, verifyUnlockToken, SHARE_UNLOCK_TTL_MS } from "@/lib/share-unlock";
import { safeExternalUrl } from "@/lib/external-url";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

const user = (role: string, id = "u1"): SessionUser => ({ id, role } as SessionUser);

// ── P0-A: İkinci Görüş LİSTE ucu ────────────────────────────────────────────────────────────────
// Eski kod: `where: user.role === "PATIENT" ? { patientId } : {}` → PATIENT dışı HER role 100 vakanın
// düz-metin tanı özeti. Doktor self-signup açık olduğundan internetten erişilebilirdi.
describe("soCaseListScope — koleksiyon ucu yetkilendirmesi (P0-A)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("PARTNER ve AGENCY hiçbir SO vakası göremez (null = 403)", async () => {
    expect(await soCaseListScope(user("PARTNER"))).toBeNull();
    expect(await soCaseListScope(user("AGENCY"))).toBeNull();
  });

  it("tanınmayan/bozuk rol fail-closed reddedilir", async () => {
    expect(await soCaseListScope(user("SUPERUSER"))).toBeNull();
    expect(await soCaseListScope(null)).toBeNull();
  });

  it("DOĞRULANMAMIŞ doktor hiçbir şey göremez (self-signup hesabı)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: "d1" } as never);
    vi.mocked(db.doctor.findUnique).mockResolvedValue({ verified: false, branch: "Kardiyoloji" } as never);
    expect(await soCaseListScope(user("DOCTOR"))).toBeNull();
  });

  it("doktor profili olmayan DOCTOR hesabı da reddedilir", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: null } as never);
    expect(await soCaseListScope(user("DOCTOR"))).toBeNull();
  });

  it("DOĞRULANMIŞ doktor YALNIZ kendisine atanmışları görür (havuzun tamamını değil)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: "d1" } as never);
    vi.mocked(db.doctor.findUnique).mockResolvedValue({ verified: true, branch: "Kardiyoloji" } as never);
    expect(await soCaseListScope(user("DOCTOR"))).toEqual({ assignedDoctorId: "d1", deletionLockedAt: null });
  });

  it("hasta yalnız kendi vakalarını görür", async () => {
    expect(await soCaseListScope(user("PATIENT", "u9"))).toEqual({ patientId: "u9", deletionLockedAt: null });
  });

  it("koordinatör/etik/admin geniş görür AMA silme kilidi HER rolde uygulanır", async () => {
    for (const role of ["COORDINATOR", "ETHICS", "ADMIN"]) {
      expect(await soCaseListScope(user(role))).toEqual({ deletionLockedAt: null });
    }
  });
});

// ── Hasta beyanı uçları — yazma yetkisi okuma yetkisinden ayrı ───────────────────────────────────
describe("isCasePatient — hasta-beyanı uçları (check-in / şikayet)", () => {
  const CASE = { userId: "u1", doctorId: "d1", branch: "Kardiyoloji", deletionLockedAt: null };

  it("yalnız vakanın sahibi hasta true alır", () => {
    expect(isCasePatient(user("PATIENT", "u1"), CASE)).toBe(true);
    expect(isCasePatient(user("PATIENT", "baska"), CASE)).toBe(false);
  });

  it("personel hasta ADINA kayıt oluşturamaz (okuma yetkisi olsa bile)", () => {
    for (const role of ["DOCTOR", "COORDINATOR", "ETHICS", "ADMIN"]) {
      expect(isCasePatient(user(role, "u1"), CASE)).toBe(false);
    }
  });

  it("silme kilidi hasta için de geçerli", () => {
    expect(isCasePatient(user("PATIENT", "u1"), { ...CASE, deletionLockedAt: new Date() })).toBe(false);
  });

  it("sahipsiz (eski) vakada kimse hasta sayılmaz", () => {
    expect(isCasePatient(user("PATIENT", "u1"), { ...CASE, userId: null })).toBe(false);
  });
});

// ── P0-B: belge içerik tipi ─────────────────────────────────────────────────────────────────────
// Eski kod: yüklemede yalnız `data:` öneki, sunumda istemcinin MIME'ı `inline` → depolanmış XSS.
// CSP kurtarmıyordu ('unsafe-inline' script-src'de), nosniff de kurtarmıyordu (tip AÇIKÇA beyan ediliyor).
const dataUri = (mime: string, bytes: number[]) =>
  `data:${mime};base64,${Buffer.from(Uint8Array.from(bytes)).toString("base64")}`;
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];

describe("detectDocumentKind — içerikten tip tespiti (P0-B)", () => {
  it("HTML yükü, MIME'ı ne olursa olsun REDDEDİLİR (asıl saldırı)", () => {
    const html = [...Buffer.from("<html><script>alert(1)</script>")];
    expect(detectDocumentKind(dataUri("text/html", html))).toBeNull();
    // Saldırgan tipi masum gösterse bile içerik tanınmadığı için yine reddedilir:
    expect(detectDocumentKind(dataUri("image/png", html))).toBeNull();
  });

  it("SVG (script çalıştırabilen görüntü formatı) reddedilir", () => {
    const svg = [...Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')];
    expect(detectDocumentKind(dataUri("image/svg+xml", svg))).toBeNull();
  });

  it("istemcinin YALAN beyanı yok sayılır — tip içerikten belirlenir", () => {
    // İçerik gerçek PDF ama beyan text/html: sonuç application/pdf olmalı (beyan kullanılmıyor).
    expect(detectDocumentKind(dataUri("text/html", PDF))?.mime).toBe("application/pdf");
  });

  it("meşru tipler tanınır ve inline/indirme kararı doğru verilir", () => {
    expect(detectDocumentKind(dataUri("application/pdf", PDF))).toEqual({ mime: "application/pdf", inline: true, ext: "pdf" });
    expect(detectDocumentKind(dataUri("image/png", PNG))).toEqual({ mime: "image/png", inline: true, ext: "png" });
  });

  it("DICOM preamble'ı (128 bayt + DICM) tanınır ve DAİMA indirmeye düşer", () => {
    const dcm = [...new Array(128).fill(0), 0x44, 0x49, 0x43, 0x4d];
    const kind = detectDocumentKind(dataUri("application/dicom", dcm));
    expect(kind?.mime).toBe("application/dicom");
    expect(kind?.inline).toBe(false);
  });

  it("boş / bozuk / data-URI olmayan girdi fail-closed", () => {
    expect(detectDocumentKind("")).toBeNull();
    expect(detectDocumentKind("https://ornek.test/dosya.pdf")).toBeNull();
    expect(detectDocumentKind("data:application/pdf;base64,")).toBeNull();
  });
});

describe("documentResponseHeaders — sunum başlıkları (P0-B)", () => {
  it("güvenli tip sekmede açılır", () => {
    const h = documentResponseHeaders("application/pdf", "rapor.pdf") as Record<string, string>;
    expect(h["Content-Type"]).toBe("application/pdf");
    expect(h["Content-Disposition"]).toContain("inline");
  });

  it("TANINMAYAN tip (denetim öncesi kayıtlar) octet-stream + indirme olur — asla render edilmez", () => {
    for (const legacy of ["text/html", "image/svg+xml", null, undefined, "uydurma/tip"]) {
      const h = documentResponseHeaders(legacy, "dosya") as Record<string, string>;
      expect(h["Content-Type"]).toBe("application/octet-stream");
      expect(h["Content-Disposition"]).toContain("attachment");
    }
  });

  it("nosniff her yanıtta bulunur", () => {
    const h = documentResponseHeaders("image/png", "a.png") as Record<string, string>;
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
  });
});

// ── P0-C: paylaşım şifre kapısı ─────────────────────────────────────────────────────────────────
// Eski kod: çerez değeri sabit "1" → parolayı bilmeyen biri başlığı elle gönderip kapıyı aşıyordu.
describe("share-unlock — imzalı capability (P0-C)", () => {
  const SHARE = "share-1";
  const PWHASH = "$2b$10$ornekhashdegeri";

  it("üretilen token kendi paylaşımı+parolası için geçerli", () => {
    expect(verifyUnlockToken(issueUnlockToken(SHARE, PWHASH), SHARE, PWHASH)).toBe(true);
  });

  it("ESKİ AÇIK: sabit \"1\" değeri artık kapıyı AÇMAZ", () => {
    expect(verifyUnlockToken("1", SHARE, PWHASH)).toBe(false);
  });

  it("uydurma/biçimsiz token reddedilir", () => {
    for (const t of ["", "abc", "a.b", "1.2.3", "999999999999.nonce.imza", undefined, null]) {
      expect(verifyUnlockToken(t as string, SHARE, PWHASH)).toBe(false);
    }
  });

  it("BAŞKA paylaşımın token'ı bu paylaşımı açamaz", () => {
    expect(verifyUnlockToken(issueUnlockToken("share-2", PWHASH), SHARE, PWHASH)).toBe(false);
  });

  it("hasta PAROLAYI DEĞİŞTİRİRSE eldeki token anında geçersizleşir", () => {
    const t = issueUnlockToken(SHARE, PWHASH);
    expect(verifyUnlockToken(t, SHARE, "$2b$10$yeniparolahashi")).toBe(false);
  });

  it("süresi dolmuş token reddedilir", () => {
    const past = Date.now() - SHARE_UNLOCK_TTL_MS - 1000;
    expect(verifyUnlockToken(issueUnlockToken(SHARE, PWHASH, past), SHARE, PWHASH)).toBe(false);
  });

  it("süre alanı ileri çekilerek uzatılamaz (imza bozulur)", () => {
    const [, nonce, sig] = issueUnlockToken(SHARE, PWHASH).split(".");
    const forged = `${Date.now() + 10 * SHARE_UNLOCK_TTL_MS}.${nonce}.${sig}`;
    expect(verifyUnlockToken(forged, SHARE, PWHASH)).toBe(false);
  });
});

// ── Kod incelemesi bulguları (aynı gün, v6.61 SONRASI düzeltmeler) ──────────────────────────────
// v6.61 canlıya indikten sonra 5 eksenli bir inceleme üç kusur buldu; üçü de bu commit'te kapandı.
describe("v6.61 sonrası inceleme bulguları", () => {
  it("post-op fotoğrafı: HTML yükü görüntü sayılmaz (altıncı yükleme yüzeyi)", () => {
    // checkin ucu artık `detectDocumentKind(...)?.mime.startsWith("image/")` istiyor.
    const html = dataUri("image/jpeg", [...Buffer.from("<html><script>alert(1)</script>")]);
    const kind = detectDocumentKind(html);
    expect(kind).toBeNull(); // → uç 415 döner
  });

  it("post-op fotoğrafı: gerçek görüntü geçer", () => {
    const kind = detectDocumentKind(dataUri("image/png", PNG));
    expect(kind?.mime.startsWith("image/")).toBe(true);
  });

  it("PDF post-op fotoğrafı olarak KABUL EDİLMEZ (görüntü değil)", () => {
    // Tanınan bir tip olması yetmez; checkin ucu ayrıca image/ ön ekini şart koşar.
    const kind = detectDocumentKind(dataUri("application/pdf", PDF));
    expect(kind?.mime.startsWith("image/")).toBe(false);
  });
});

// ── Harici bağlantı şeması ──────────────────────────────────────────────────────────────────────
describe("safeExternalUrl", () => {
  it("tehlikeli şemalar elenir", () => {
    for (const u of ["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd", "vbscript:x"]) {
      expect(safeExternalUrl(u)).toBeNull();
    }
  });

  it("adres çubuğunu yanıltan kimlik gömülü URL elenir", () => {
    expect(safeExternalUrl("https://hastane.example.com@saldirgan.test/rapor")).toBeNull();
  });

  it("meşru http(s) bağlantı normalize edilerek geçer", () => {
    expect(safeExternalUrl("  https://Hastane.Example.com/rapor.pdf  ")).toBe("https://hastane.example.com/rapor.pdf");
  });

  it("boş/bozuk girdi fail-closed", () => {
    for (const u of ["", "   ", "hastane.example.com/rapor", null, undefined]) {
      expect(safeExternalUrl(u)).toBeNull();
    }
  });
});
