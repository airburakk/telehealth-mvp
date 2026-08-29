import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // `_` öneki = "bilerek kullanılmıyor" (yerleşik TS/ESLint konvansiyonu). Kod tabanında imza
  // korunurken kullanılmayan parametreler (`missingSteps(docs, _mmss)`), prop'tan bilinçli
  // atlananlar (`caseId: _caseId`) ve rest-destructuring ile alan çıkarma
  // (`({ targetBranches: _tb, ...card }) => card`) bu şekilde işaretlenir. Satır satır
  // eslint-disable yerine konvansiyon TEK yerde tanınır — kural `error` seviyesinde kalır.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // ✅ TODO KAPANDI (v6.183): React Compiler kuralları (set-state-in-effect · purity ·
  // immutability · refs · preserve-manual-memoization) ve react/no-unescaped-entities artık
  // eslint-config-next@16 VARSAYILANINDA — yani `error`. Geçici `warn` override'ı KALDIRILDI.
  //
  // Neden kaldırılabildi: 59 uyarının tamamı kapatıldı — 18'i gerçek temizlik (ölü kod, tipografik
  // kesme işareti, img gerekçesi), 3'ü gerçek düzeltme (PackageBuilder eksik dep = fiyat bayatlama
  // hatası · DoctoriumSidebar render-içi mutasyon · iki WebRTC odasında isDoctor dep'i), kalanı
  // satır bazlı GEREKÇELİ disable (her biri neden o desenin doğru olduğunu yazar).
  //
  // Neden `warn`a dönülmemeli: eski override 26 ihlalle konmuştu, ölçülmeden 38'e çıkmıştı —
  // uyarı seviyesi ihlallerin sessizce birikmesine izin veriyor. `error` ile yeni ihlal CI lint
  // kapısını kırar; bilinçli istisna gerekiyorsa gerekçesiyle disable yazılır.
]);

export default eslintConfig;
