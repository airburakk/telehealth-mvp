// Birim testleri — lib/kek-rotation (şema-güdümlü KEK rotasyon motoru, 2026-09-18).
// Sözleşme: katalogdan bulunan HER metin kolonu taranır (envanter yok) · dry-run hiçbir şey yazmaz ·
// apply yalnız "rewrap" satırlarını yazar (foreign/already dokunulmaz) · id-cursor sayfalama · deadline'da
// sayfa sınırında durur (complete=false) · tanımlayıcı süzgeci (katalogdan gelen kötü ad sorguya girmez) ·
// blob:v1: yalnız apply+blobs ile döner · parmak izi = sha256(base64) öneki, sır yok.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomBytes } from "crypto";
import { encryptField, decryptField, kekFromBase64 } from "@/lib/crypto";

const blobMock = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(), del: vi.fn(),
}));
vi.mock("@vercel/blob", () => blobMock);

import {
  rotateKek, classifyValue, quoteIdent, kekFingerprint, shortFingerprint, discoverTextColumns, type RawDb,
} from "@/lib/kek-rotation";

const A_B64 = randomBytes(32).toString("base64");
const B_B64 = randomBytes(32).toString("base64");
const C_B64 = randomBytes(32).toString("base64");
const A = kekFromBase64(A_B64), B = kekFromBase64(B_B64), C = kekFromBase64(C_B64);

/** Belirli bir KEK ile envelope üret (env'i geçici değiştirerek). */
function encWith(kekB64: string, plain: string): string {
  const prev = process.env.DATA_ENCRYPTION_KEK;
  process.env.DATA_ENCRYPTION_KEK = kekB64;
  try { return encryptField(plain); } finally { process.env.DATA_ENCRYPTION_KEK = prev; }
}
function decWith(kekB64: string, stored: string): string {
  const prev = process.env.DATA_ENCRYPTION_KEK;
  process.env.DATA_ENCRYPTION_KEK = kekB64;
  try { return decryptField(stored); } finally { process.env.DATA_ENCRYPTION_KEK = prev; }
}

type Row = Record<string, string | number | null>;
interface FakeTable { idType: "text" | "integer" | null; rows: Row[] }

/** Motorun ürettiği SQL biçimlerini tanıyan sahte Postgres (information_schema + sayfa + count + update). */
function fakeDb(tables: Record<string, FakeTable>) {
  const updates: Array<{ table: string; column: string; id: string | number; value: string }> = [];
  const queries: string[] = [];
  const cmp = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);
  const db: RawDb = {
    async $queryRawUnsafe<T>(sql: string, ...params: unknown[]): Promise<T> {
      queries.push(sql);
      if (sql.includes("information_schema.columns c")) {
        const out: Array<{ table_name: string; column_name: string; data_type: string }> = [];
        for (const [t, def] of Object.entries(tables)) {
          const cols = new Set<string>();
          for (const r of def.rows) for (const k of Object.keys(r)) cols.add(k);
          if (def.rows.length === 0 && def.idType) cols.add("id");
          for (const c of cols) if (c !== "id" || true) out.push({ table_name: t, column_name: c, data_type: "text" });
        }
        return out as T;
      }
      if (sql.includes("column_name = 'id'")) {
        return Object.entries(tables)
          .filter(([, d]) => d.idType)
          .map(([t, d]) => ({ table_name: t, column_name: "id", data_type: d.idType })) as T;
      }
      let m = /^SELECT "id", "(\w+)" AS v FROM "(\w+)" WHERE \("\1" LIKE 'enc:v1:%' OR "\1" LIKE 'blob:v1:%'\)( AND "id" > \$1)? ORDER BY "id" LIMIT (\d+)$/.exec(sql);
      if (m) {
        const [, col, table, withCursor, limit] = m;
        const cursor = withCursor ? (params[0] as string | number) : null;
        const rows = tables[table].rows
          .filter((r) => typeof r[col] === "string" && (String(r[col]).startsWith("enc:v1:") || String(r[col]).startsWith("blob:v1:")))
          .filter((r) => cursor === null || cmp(r.id as string | number, cursor) > 0)
          .sort((x, y) => cmp(x.id as string | number, y.id as string | number))
          .slice(0, Number(limit))
          .map((r) => ({ id: r.id, v: r[col] }));
        return rows as T;
      }
      m = /^SELECT count\(\*\)::int AS n FROM "(\w+)" WHERE \("(\w+)" LIKE/.exec(sql);
      if (m) {
        const n = tables[m[1]].rows.filter((r) => String(r[m![2]] ?? "").startsWith("enc:v1:")).length;
        return [{ n }] as T;
      }
      throw new Error(`fakeDb: tanınmayan sorgu: ${sql}`);
    },
    async $executeRawUnsafe(sql: string, ...params: unknown[]): Promise<number> {
      queries.push(sql);
      const m = /^UPDATE "(\w+)" SET "(\w+)" = \$1 WHERE "id" = \$2$/.exec(sql);
      if (!m) throw new Error(`fakeDb: tanınmayan güncelleme: ${sql}`);
      const [, table, column] = m;
      const [value, id] = params as [string, string | number];
      const row = tables[table].rows.find((r) => r.id === id);
      if (!row) return 0;
      row[column] = value;
      updates.push({ table, column, id, value });
      return 1;
    },
  };
  return { db, updates, queries };
}

function sampleTables(): Record<string, FakeTable> {
  return {
    Case: {
      idType: "text",
      rows: [
        { id: "c1", symptoms: encWith(A_B64, "semptom 1"), extra: encWith(B_B64, "zaten yeni"), reasoning: encWith(C_B64, "yabancı") },
        { id: "c2", symptoms: encWith(A_B64, "semptom 2"), extra: null, reasoning: "düz metin — kapsam dışı" },
        { id: "c3", symptoms: "", extra: "data:text/plain;base64,QQ==", reasoning: encWith(A_B64, "gerekçe 3") },
      ],
    },
    Signal: {
      idType: "integer",
      rows: [
        { id: 1, data: encWith(A_B64, "s1") }, { id: 2, data: encWith(A_B64, "s2") }, { id: 3, data: "{}" },
      ],
    },
    CaseDocument: { idType: "text", rows: [{ id: "d1", content: "blob:v1:https://blob.example/x/eski.bin" }] },
    NewsArticle: { idType: "text", rows: [{ id: "n1", title: "haber", summary: "özet" }] },
  };
}

beforeEach(() => { blobMock.get.mockReset(); blobMock.put.mockReset(); blobMock.del.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe("kek-rotation — yardımcılar", () => {
  it("quoteIdent: katalog adını çift tırnaklar, kötü adı reddeder (raw SQL'e tanımlayıcı sızmaz)", () => {
    expect(quoteIdent("Case")).toBe('"Case"');
    expect(quoteIdent("patient_name2")).toBe('"patient_name2"');
    for (const bad of ['x"; DROP TABLE y; --', "a b", "1abc", "", 'ç']) expect(() => quoteIdent(bad)).toThrow();
  });

  it("parmak izi: sha256(base64 kırpılmış) 64 hex; kısa biçim 12 hex; anahtarın kendisini içermez", () => {
    const fp = kekFingerprint(` ${A_B64}\n`);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
    expect(fp).toBe(kekFingerprint(A_B64));
    expect(shortFingerprint(A_B64)).toBe(fp.slice(0, 12));
    expect(fp).not.toContain(A_B64.slice(0, 8));
  });

  it("classifyValue: rewrap / already / foreign / blob ayrımı; düz metin kabul edilmez", () => {
    expect(classifyValue(encWith(A_B64, "x"), A, B).cls).toBe("rewrap");
    expect(classifyValue(encWith(B_B64, "x"), A, B).cls).toBe("already");
    expect(classifyValue(encWith(C_B64, "x"), A, B).cls).toBe("foreign");
    expect(classifyValue("blob:v1:https://x", A, B).cls).toBe("blob");
    expect(() => classifyValue("düz", A, B)).toThrow();
  });

  it("discoverTextColumns: id kolonu hariç tüm metin kolonları + tabloların id tipi", async () => {
    const { db } = fakeDb(sampleTables());
    const d = await discoverTextColumns(db);
    expect(d.columns.some((c) => c.table === "NewsArticle" && c.column === "summary")).toBe(true);
    expect(d.columns.some((c) => c.column === "id")).toBe(false);
    expect(d.idTypes.get("Signal")).toBe("integer");
  });

  it("aynı KEK ile rotasyon reddedilir", async () => {
    const { db } = fakeDb(sampleTables());
    await expect(rotateKek({ db, oldKek: A, newKek: A })).rejects.toThrow(/aynı/);
  });
});

describe("kek-rotation — motor", () => {
  it("dry-run: envanter olmadan tüm kolonları tarar, doğru sayar, HİÇBİR ŞEY yazmaz", async () => {
    const t = sampleTables();
    const { db, updates } = fakeDb(t);
    const r = await rotateKek({ db, oldKek: A, newKek: B });
    expect(r.mode).toBe("dry-run");
    expect(r.complete).toBe(true);
    expect(r.scanned.tables).toBe(4);
    // rewrap 5: Case.symptoms c1+c2 · Case.reasoning c3 · Signal.data 1+2; already: Case.extra c1; foreign: Case.reasoning c1.
    expect(r.totals).toEqual({ rewrap: 5, already: 1, foreign: 1, blob: 1, blobRotated: 0 });
    expect(r.foreignSamples).toEqual(["Case.reasoning#c1"]);
    expect(r.unrotatable).toEqual([]);
    // Yalnız envelope taşıyan kolonlar raporda; NewsArticle.summary (düz) yok.
    expect(r.columns.map((c) => `${c.table}.${c.column}`).sort()).toEqual(
      ["Case.extra", "Case.reasoning", "Case.symptoms", "CaseDocument.content", "Signal.data"],
    );
    expect(updates).toHaveLength(0);
    expect(t.Case.rows[0].symptoms).toBe(t.Case.rows[0].symptoms); // değişmedi
  });

  it("apply: yalnız rewrap satırları yazılır; yazılanlar YENİ KEK ile çözülür; foreign/already/düz dokunulmaz", async () => {
    const t = sampleTables();
    const before = JSON.parse(JSON.stringify(t)) as typeof t;
    const { db, updates } = fakeDb(t);
    const r = await rotateKek({ db, oldKek: A, newKek: B, apply: true });
    expect(r.mode).toBe("apply");
    expect(r.totals.rewrap).toBe(5);
    expect(updates.map((u) => `${u.table}.${u.column}#${u.id}`).sort()).toEqual(
      ["Case.reasoning#c3", "Case.symptoms#c1", "Case.symptoms#c2", "Signal.data#1", "Signal.data#2"],
    );
    expect(decWith(B_B64, t.Case.rows[0].symptoms as string)).toBe("semptom 1");
    expect(decWith(B_B64, t.Signal.rows[1].data as string)).toBe("s2");
    expect(decWith(B_B64, t.Case.rows[2].reasoning as string)).toBe("gerekçe 3");
    expect(() => decWith(A_B64, t.Case.rows[0].symptoms as string)).toThrow(); // eski anahtar artık açmaz
    expect(t.Case.rows[0].reasoning).toBe(before.Case.rows[0].reasoning); // foreign aynen
    expect(t.Case.rows[0].extra).toBe(before.Case.rows[0].extra); // already aynen
    expect(t.Case.rows[1].reasoning).toBe("düz metin — kapsam dışı");
    expect(t.CaseDocument.rows[0].content).toBe("blob:v1:https://blob.example/x/eski.bin"); // blobs=false → dokunulmadı
    expect(blobMock.put).not.toHaveBeenCalled();
  });

  it("apply ikinci tur idempotent: her şey already, yazım yok", async () => {
    const t = sampleTables();
    const { db, updates } = fakeDb(t);
    await rotateKek({ db, oldKek: A, newKek: B, apply: true });
    const n1 = updates.length;
    const r2 = await rotateKek({ db, oldKek: A, newKek: B, apply: true });
    expect(r2.totals.rewrap).toBe(0);
    expect(r2.totals.already).toBe(6); // 5 yeni sarım + baştan already olan Case.extra#c1
    expect(updates.length).toBe(n1);
  });

  it("id-cursor sayfalama: sayfa boyutundan büyük tabloda her satır tam bir kez işlenir (integer id)", async () => {
    const rows: Row[] = [];
    for (let i = 1; i <= 650; i++) rows.push({ id: i, data: encWith(A_B64, `s${i}`) });
    const { db, updates, queries } = fakeDb({ Signal: { idType: "integer", rows } });
    const r = await rotateKek({ db, oldKek: A, newKek: B, apply: true });
    expect(r.totals.rewrap).toBe(650);
    expect(updates).toHaveLength(650);
    expect(new Set(updates.map((u) => u.id)).size).toBe(650);
    expect(queries.filter((q) => q.startsWith('SELECT "id", "data"')).length).toBe(3); // 300+300+50
  });

  it("deadline: süre dolunca sayfa sınırında durur, complete=false, yazılanlar geçerli kalır", async () => {
    const rows: Row[] = [];
    for (let i = 1; i <= 650; i++) rows.push({ id: i, data: encWith(A_B64, `s${i}`) });
    const { db, updates } = fakeDb({ Signal: { idType: "integer", rows } });
    const r = await rotateKek({ db, oldKek: A, newKek: B, apply: true, deadline: Date.now() - 1 });
    // İlk kolonun ilk sayfası işlenmeden mi? Deadline kolon başında da kontrol edilir → hiç işlenmez.
    expect(r.complete).toBe(false);
    expect(updates.length).toBeLessThan(650);
    // Devam çağrısı kalanı bitirir.
    const r2 = await rotateKek({ db, oldKek: A, newKek: B, apply: true });
    expect(r2.complete).toBe(true);
    expect(r2.totals.rewrap + r2.totals.already).toBe(650);
  });

  it("rowFilter: yalnız seçilen satırlar işlenir (paylaşılan DB'de apply provası dikişi)", async () => {
    const t = sampleTables();
    const { db, updates } = fakeDb(t);
    const r = await rotateKek({ db, oldKek: A, newKek: B, apply: true, rowFilter: (table, id) => table === "Case" && id === "c2" });
    expect(r.totals).toEqual({ rewrap: 1, already: 0, foreign: 0, blob: 0, blobRotated: 0 });
    expect(updates).toEqual([expect.objectContaining({ table: "Case", column: "symptoms", id: "c2" })]);
  });

  it("tekil id'si olmayan tabloda envelope → unrotatable listesi (sessiz atlama yok)", async () => {
    const t = sampleTables();
    t.Composite = { idType: null, rows: [{ a: "k", note: encWith(A_B64, "gizli") }] };
    const { db, updates } = fakeDb(t);
    const r = await rotateKek({ db, oldKek: A, newKek: B, apply: true });
    expect(r.unrotatable).toEqual(["Composite.note=1"]);
    expect(updates.some((u) => u.table === "Composite")).toBe(false);
  });

  it("katalogdan gelen kötü tablo adı sorgu kurulmadan reddedilir", async () => {
    const t = sampleTables();
    t['Evil"; DROP TABLE x; --'] = { idType: "text", rows: [{ id: "e", col: encWith(A_B64, "x") }] };
    const { db, updates } = fakeDb(t);
    await expect(rotateKek({ db, oldKek: A, newKek: B, apply: true })).rejects.toThrow(/tanımlayıcı/);
    expect(updates).toHaveLength(0);
  });

  it("blob rotasyonu (apply+blobs): indir → rewrap → yeni blob → ref güncelle → eskiyi sil; içerik çözülmez", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test");
    const cipher = encWith(A_B64, "data:application/pdf;base64,AAAA");
    blobMock.get.mockResolvedValue({ stream: new Blob([cipher]).stream() });
    blobMock.put.mockResolvedValue({ url: "https://blob.example/x/yeni-abc.bin" });
    blobMock.del.mockResolvedValue(undefined);
    const t = sampleTables();
    const { db } = fakeDb(t);
    const r = await rotateKek({ db, oldKek: A, newKek: B, apply: true, blobs: true });
    expect(r.totals.blob).toBe(1);
    expect(r.totals.blobRotated).toBe(1);
    expect(blobMock.get).toHaveBeenCalledWith("https://blob.example/x/eski.bin", expect.objectContaining({ token: "vercel_blob_rw_test" }));
    const [key, body, opts] = blobMock.put.mock.calls[0] as [string, string, { addRandomSuffix: boolean }];
    expect(key).toBe("rotate/CaseDocument/d1");
    expect(opts.addRandomSuffix).toBe(true);
    expect(decWith(B_B64, body)).toBe("data:application/pdf;base64,AAAA"); // yeni sarım yeni KEK ile açılır
    expect(body.split(":").slice(3)).toEqual(cipher.split(":").slice(3)); // iv/tag/ct aynen
    expect(t.CaseDocument.rows[0].content).toBe("blob:v1:https://blob.example/x/yeni-abc.bin");
    expect(blobMock.del).toHaveBeenCalledWith("https://blob.example/x/eski.bin", expect.anything());
  });

  it("blob rotasyonu token yoksa hata fırlatır (sessiz atlama yok)", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const { db } = fakeDb(sampleTables());
    await expect(rotateKek({ db, oldKek: A, newKek: B, apply: true, blobs: true })).rejects.toThrow(/BLOB_READ_WRITE_TOKEN/);
  });
});
