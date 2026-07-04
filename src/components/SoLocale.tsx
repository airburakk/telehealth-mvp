"use client";

// İkinci Görüş dil durumu — Faz 1'de genel hasta diline (air_lang) BİRLEŞTİRİLDİ; ayrı "air_so_lang"
// EMEKLİ. İsimler (useSoLang / SoLangSelect) geriye dönük uyum için korunur ama artık ortak
// usePatientLang / LangSelect'e delege eder → /basla'da seçilen dil SO akışında da geçerlidir.
export { usePatientLang as useSoLang } from "@/components/PatientLocale";
export { LangSelect as SoLangSelect } from "@/components/LangSelect";
