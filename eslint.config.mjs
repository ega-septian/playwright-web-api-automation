import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import playwright from "eslint-plugin-playwright";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/", "test-results/", "playwright-report/", "blob-report/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Izinkan `const { password, ...rest } = payload` untuk mengeluarkan field dari object.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  // Aturan khusus Playwright: lupa await, test.only tertinggal, test tanpa expect, dll.
  { ...playwright.configs["flat/recommended"], files: ["tests/**/*.ts"] },
  // Matikan aturan ESLint yang bentrok dengan Prettier (format diurus Prettier).
  prettier,
);
