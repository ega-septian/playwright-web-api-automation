/**
 * Checks that the repo rules marked "(checked: <id>)" in AGENTS.md are enforced in every place they should
 * be, so a rule can't be added to (or dropped from) one place only:
 *
 *   npm run check:drift
 *
 * For each id in AGENTS.md, the bad example below must be rejected by the Claude Code hook
 * (.claude/hooks/guard-spec.mts) and by ESLint, or by the CI script that owns the rule (CI_SCRIPTS). The other
 * way round, every id in the hook, in eslint.config.mjs or below must be in AGENTS.md. A clean spec and schema
 * must pass both, so a rule that rejects everything is caught too. Nothing is written to disk. Exit 1 on drift.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ESLint } from "eslint";

const HOOK = ".claude/hooks/guard-spec.mts";
const ESLINT_CONFIG = "eslint.config.mjs";
// Paths the examples pretend to be at: they decide which hook and ESLint rules apply.
const SPEC = "tests/api/toolshop/drift-check.spec.ts";
const SCHEMA = "tests/api/toolshop/schemas/drift-check.ts";

/** One bad example per rule id: what the rule must reject. */
const EXAMPLES: Record<string, { file: string; bad: string }> = {
  imports: { file: SPEC, bad: `import { test } from "@playwright/test";` },
  "test-ids": { file: SPEC, bad: `test("Get brands", async () => {});` },
  "strict-schema": { file: SCHEMA, bad: `export const Brand = z.object({ id: z.string() });` },
  "no-fixed-wait": { file: SPEC, bad: `await page.waitForTimeout(1000);` },
  "no-hardcoded-id": { file: SPEC, bad: `await request.get("/brands/1");` },
  "no-only": { file: SPEC, bad: `test.only("Get brands", { tag: "@TC-X-001" }, async () => {});` },
};

/** Rules that CI checks with a script instead of ESLint: id → the command a step in ci.yml runs. */
const CI_SCRIPTS: Record<string, string> = { "test-ids": "npm run check:ids" };

const GOOD: Record<string, string> = {
  [SPEC]: `import { test, expect } from "./fixtures";

test("Get brands", { tag: "@TC-DRIFT-001" }, async ({ request }) => {
  const response = await request.get("/brands");
  expect(response.status()).toBe(200);
});
`,
  [SCHEMA]: `import { z } from "zod";

export const Brand = z.strictObject({ id: z.string() });
`,
};

const read = (file: string) => readFileSync(file, "utf8");
const idsIn = (text: string, pattern: RegExp) =>
  new Set([...text.matchAll(pattern)].map((m) => m[1]));

const agentsIds = idsIn(read("AGENTS.md"), /\(checked: ([a-z-]+)\)/g);
const hookIds = idsIn(read(HOOK), /\bid: "([a-z-]+)"/g);
const eslintSource = read(ESLINT_CONFIG);
const eslintIds = idsIn(eslintSource, /AGENTS\.md: ([a-z-]+)\)/g);
// Plugin rules have their own messages, so their id is in a comment: `"plugin/rule": "error", // (AGENTS.md: id)`.
const pluginRules = new Map(
  [...eslintSource.matchAll(/"([\w@/-]+)": "error", \/\/ \(AGENTS\.md: ([a-z-]+)\)/g)].map((m) => [
    m[2],
    m[1],
  ]),
);
const ciWorkflow = read(".github/workflows/ci.yml");

/** Exit code and stderr of the hook for a Write of `content` to `file`. */
function hook(file: string, content: string): { status: number | null; stderr: string } {
  const input = JSON.stringify({
    tool_name: "Write",
    tool_input: { file_path: resolve(file), content },
  });
  const { status, stderr } = spawnSync("node", [HOOK], { input, encoding: "utf8" });
  return { status, stderr };
}

const eslint = new ESLint();
async function eslintErrors(file: string, content: string) {
  const [result] = await eslint.lintText(content, { filePath: file });
  return result.messages.filter((m) => m.severity === 2);
}

const problems: string[] = [];

for (const id of new Set([...hookIds, ...eslintIds, ...Object.keys(EXAMPLES)])) {
  if (!agentsIds.has(id))
    problems.push(`${id}: enforced or tested, but not "(checked: ${id})" in AGENTS.md`);
}

for (const id of agentsIds) {
  const example = EXAMPLES[id];
  if (!example) {
    problems.push(`${id}: in AGENTS.md as (checked) but has no example in scripts/check-drift.mts`);
    continue;
  }
  const tag = `(AGENTS.md: ${id})`;

  const fromHook = hook(example.file, example.bad);
  if (fromHook.status !== 2 || !fromHook.stderr.includes(tag)) {
    problems.push(`${id}: the hook did not reject the example with ${tag}`);
  }

  if (CI_SCRIPTS[id]) {
    if (!ciWorkflow.includes(`run: ${CI_SCRIPTS[id]}`)) {
      problems.push(`${id}: no step in ci.yml runs ${CI_SCRIPTS[id]}`);
    }
  } else {
    const errors = await eslintErrors(example.file, example.bad);
    const caught = errors.some((e) => e.message.includes(tag) || e.ruleId === pluginRules.get(id));
    if (!caught) problems.push(`${id}: ESLint did not reject the example with ${tag}`);
  }

  if (!problems.some((p) => p.startsWith(`${id}:`))) console.log(`✓ ${id}`);
}

for (const [file, content] of Object.entries(GOOD)) {
  const fromHook = hook(file, content);
  if (fromHook.status !== 0)
    problems.push(`clean ${file}: rejected by the hook\n${fromHook.stderr}`);
  for (const e of await eslintErrors(file, content)) {
    problems.push(`clean ${file}: rejected by ESLint (${e.ruleId}: ${e.message})`);
  }
}

if (problems.length > 0) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"));
  process.exit(1);
}
console.log(`No drift: ${agentsIds.size} checked rules in AGENTS.md, the hook and ESLint/CI.`);
