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
    // Vendored third-party code (patched picomatch), kept as published
    "vendor/**",
    // Node skripty pro zálohy a testy (CommonJS, spouštějí se ručně)
    "scripts/**/*.cjs",
    "scripts/**/*.mjs",
  ]),
]);

export default eslintConfig;
