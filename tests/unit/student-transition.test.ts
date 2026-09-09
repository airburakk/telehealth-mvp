// Öğrenci → doktor geçişinde öğrenci doğrulama kaydının temizlenmesi (v6.260, hukuki belge seti Sürüm 1.4:
// 05 madde 3.4 · 07 madde A.4 — 👤 09.09.2026). Saf sözleşme: diploma doğrulanmışsa ve öğrenci alanı doluysa
// alanlar null/false'a çekilir; diploma yoksa ya da temizlenecek alan yoksa hiçbir şey yazılmaz (idempotent).
import { describe, it, expect } from "vitest";
import { studentRecordClearOnTransition } from "@/lib/doctor-activation";

const student = { studentVerifiedAt: new Date("2026-03-01"), studentTrack: true, studentUniversity: "Ege Üniversitesi", studentDepartment: "Tıp" };
const plain = { studentVerifiedAt: null, studentTrack: false, studentUniversity: null, studentDepartment: null };

describe("studentRecordClearOnTransition — 05 madde 3.4", () => {
  it("diploma doğrulanınca öğrenci kaydının tüm alanları (bekleyen token dâhil) temizlenir", () => {
    expect(studentRecordClearOnTransition(student, true)).toEqual({
      studentVerifiedAt: null, studentTrack: false, studentUniversity: null, studentDepartment: null,
      studentVerifyTokenHash: null, studentVerifySentAt: null,
    });
  });
  it("diploma doğrulanmadıysa öğrenci kaydına dokunulmaz (öğrenci üyeliği sürer)", () => {
    expect(studentRecordClearOnTransition(student, false)).toEqual({});
  });
  it("öğrenci alanı hiç yoksa boş nesne — gereksiz UPDATE yazılmaz (idempotent)", () => {
    expect(studentRecordClearOnTransition(plain, true)).toEqual({});
  });
  it("tek bir öğrenci alanı bile doluysa (ör. yalnız studentTrack) temizleme tetiklenir", () => {
    expect(studentRecordClearOnTransition({ ...plain, studentTrack: true }, true)).toMatchObject({ studentTrack: false });
    expect(studentRecordClearOnTransition({ ...plain, studentUniversity: "X" }, true)).toMatchObject({ studentUniversity: null });
  });
});
