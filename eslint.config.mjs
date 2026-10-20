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
      // test.skip(condition, reason) is allowed, e.g. a test that must not run on the live server.
      "playwright/no-skipped-test": ["warn", { allowConditional: true }],
      "no-restricted-imports": [
        "error",
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
  // Schema response memakai z.strictObject: field yang tidak ada di kontrak ikut ketahuan (AGENTS.md: MUST, Schemas).
  {
    files: ["tests/**/schemas/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='z'][callee.property.name='object']",
          message:
            "Pakai z.strictObject, bukan z.object, supaya field yang tidak ada di kontrak ketahuan (AGENTS.md: MUST, Schemas).",
        },
      ],
    },
  },
  // Matikan aturan ESLint yang bentrok dengan Prettier (format diurus Prettier).
  prettier,
);
