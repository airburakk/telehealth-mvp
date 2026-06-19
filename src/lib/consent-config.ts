// KVKK/açık onam — Edge-safe sabitler (db importu YOK → middleware'den de kullanılabilir).
// CONSENT_VERSION: onam aydınlatma/rıza metni esaslı değişince ARTIR → kullanıcılar bir kez
// yeniden onaylar (eski sürümle onaylamış olanların JWT'sindeki cv < yeni sürüm → /onam).
export const CONSENT_SCOPE = "GENERAL_KVKK";
export const CONSENT_VERSION = 1;
