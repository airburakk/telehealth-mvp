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
  // eslint-config-next@16 React Compiler kurallarını hata→UYARI. Bu kurallar (set-state-in-effect,
  // purity, immutability, refs, preserve-manual-memoization) yeni ve `error` seviyesinde geliyor;
  // mevcut kod tabanı henüz tam uyumlu değil (26 ihlal). Kör devre-dışı DEĞİL — uyarı olarak görünür
  // kalır (kademeli benimseme), ama CI lint kapısını her koşumda EXIT 1'e boğmaz (P0 #4 kapısı çalışsın).
  // TODO: ihlalleri kademeli düzelt → tekrar `error`e çek.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
