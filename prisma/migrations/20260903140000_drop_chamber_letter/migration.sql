-- v6.212 (2026-09-03) — Tabip odası üyelik yazısı yolu KODDAN TAMAMEN KALKTI (kullanıcı kararı 03.09.2026).
-- v6.124'ten (2026-08-19) beri CHAMBER belgesi yüklenemiyor ve chamberLetterAt hiçbir akışta okunmuyordu;
-- kolon ve kalan satırlar tarihsel artıktı.
--
-- SIRA (kod-önce): önce bu şemadan üretilen Prisma client deploy edilir (kolonu SELECT etmez), SONRA bu
-- migration koşar. Ters sıra eski client'ın implicit SELECT'ini kırar (hafıza: prisma-migrate-first).
-- BLOB: CHAMBER satırlarının dosyaları ÖNCE `npx tsx scripts/purge-chamber-docs.ts` ile silinir (Blob nesnesi
-- + satır, audit'li). Aşağıdaki DELETE artık-satır güvencesidir — script koşmadıysa Blob nesnesi yetim kalır.
DELETE FROM "DoctorDocument" WHERE "type" = 'CHAMBER';

-- AlterTable
ALTER TABLE "Doctor" DROP COLUMN "chamberLetterAt";
