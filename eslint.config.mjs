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
  // Aturan repo (AGENTS.md, Constitution) untuk spec file. Hook Claude Code mengecek hal yang sama saat menulis.
  {
    files: ["tests/**/*.spec.ts"],
    rules: {
      "playwright/no-wait-for-timeout": "error",
      // Masih warning: register.user.spec.ts belum pindah ke ./fixtures.
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@playwright/test",
              message: "Import test dan expect dari ./fixtures (AGENTS.md: MUST, Imports).",
            },
            {
              name: "redline-playwright/fixture",
              message: "Import test dan expect dari ./fixtures (AGENTS.md: MUST, Imports).",
            },
          ],
        },
      ],
      // ID hardcode di URL, misalnya "/brands/1": buat datanya sendiri di test.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\/[a-z_-]+\\/[0-9]+([/?]|$)/]",
          message:
            "ID hardcode di URL. Buat datanya di test dan pakai id-nya (AGENTS.md: WON'T, hardcoded ids).",
        },
        {
          selector: "TemplateElement[value.raw=/\\/[a-z_-]+\\/[0-9]+([/?]|$)/]",
          message:
            "ID hardcode di URL. Buat datanya di test dan pakai id-nya (AGENTS.md: WON'T, hardcoded ids).",
        },
      ],
    },
  },
  // Matikan aturan ESLint yang bentrok dengan Prettier (format diurus Prettier).
  prettier,
);
