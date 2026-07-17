import { describe, expect, it } from "vitest";
import { detectSecondOpinionIntent } from "@/lib/so-intent";

// İkinci Görüş niyet algılama — 10 dil kalıpları + Türkçe İ küçük-harf tuzağı.
describe("detectSecondOpinionIntent", () => {
  it.each([
    ["TR", "Kalp ameliyatı için ikinci görüş istiyorum."],
    ["TR büyük İ", "İKİNCİ GÖRÜŞ almak istiyorum"],
    ["TR varyant", "ikinci bir görüş almak isterim"],
    ["AZ", "Əməliyyat üçün ikinci rəy istəyirəm"],
    ["EN", "I would like a second opinion on my diagnosis"],
    ["RU yalın", "Хочу получить второе мнение по диагнозу"],
    ["RU çekim", "Прошу второго мнения врача"],
    ["AR", "أريد رأي ثانٍ من طبيب مختص"],
    ["FA", "من نظر دوم می‌خواهم"],
    ["FR", "Je souhaite un deuxième avis médical"],
    ["DE", "Ich möchte eine Zweitmeinung"],
    ["KK", "Диагноз бойынша екінші пікір алғым келеді"],
    ["KY", "Экинчи пикир алгым келет"],
  ])("yakalar: %s", (_label, text) => {
    expect(detectSecondOpinionIntent(text)).toBe(true);
  });

  it.each([
    ["normal şikayet", "Dizimde ağrı var, merdiven inerken artıyor."],
    ["görüş kelimesi tek başına", "Doktor görüşü almak istiyorum."],
    ["ikinci kelimesi tek başına", "İkinci ameliyatım olacak."],
    ["boş", ""],
  ])("yanlış alarm vermez: %s", (_label, text) => {
    expect(detectSecondOpinionIntent(text)).toBe(false);
  });
});
