import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import playwright from "eslint-plugin-playwright";
import tseslint from "typescript-eslint";

// Repo rules end with "(AGENTS.md: <id>)", the id in AGENTS.md's "(checked: <id>)". The Claude Code hook
// (.claude/hooks/guard-spec.mts) checks the same rules; `npm run check:drift` keeps the three in sync.
const importsMessage = "Import test and expect from ./fixtures (AGENTS.md: imports)";
const hardcodedIdMessage =
  "Hardcoded id in a URL. Create the data in the test and use its id (AGENTS.md: no-hardcoded-id)";

export default tseslint.config(
  { ignores: ["node_modules/", "test-results/", "playwright-report/", "blob-report/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allows `const { password, ...rest } = payload` to drop a field from an object.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  // Playwright rules: a missing await, a test without expect, and so on.
  { ...playwright.configs["flat/recommended"], files: ["tests/**/*.ts"] },
  {
    files: ["tests/**/*.spec.ts"],
    rules: {
      "playwright/no-wait-for-timeout": "error", // (AGENTS.md: no-fixed-wait)
      "playwright/no-focused-test": "error", // (AGENTS.md: no-only)
      // test.skip(condition, reason) is allowed, e.g. a test that must not run on the live server.
      "playwright/no-skipped-test": ["warn", { allowConditional: true }],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@playwright/test", message: importsMessage },
            { name: "redline-playwright/fixture", message: importsMessage },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "Literal[value=/\\/[a-z_-]+\\/[0-9]+([/?]|$)/]", message: hardcodedIdMessage },
        {
          selector: "TemplateElement[value.raw=/\\/[a-z_-]+\\/[0-9]+([/?]|$)/]",
          message: hardcodedIdMessage,
        },
      ],
    },
  },
  {
    files: ["tests/**/schemas/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='z'][callee.property.name='object']",
          message:
            "Use z.strictObject, not z.object, so a field that is not in the contract fails (AGENTS.md: strict-schema)",
        },
      ],
    },
  },
  // Turns off ESLint rules that clash with Prettier (Prettier owns formatting).
  prettier,
);
