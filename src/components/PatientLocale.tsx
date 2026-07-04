"use client";

// Genel hasta arayüzü dil durumu — tek "air_lang" anahtarı (hastanın TÜM yüzeyleri paylaşır;
// İkinci Görüş dahil — SoLocale artık buraya delege eder). Ortak factory: components/LangSelect.
// Geriye dönük uyum için usePatientLang / PatientLangSelect isimleri korunur.
import { createLangPersistence, LangSelect } from "@/components/LangSelect";

export const usePatientLang = createLangPersistence("air_lang");
export { LangSelect as PatientLangSelect };
