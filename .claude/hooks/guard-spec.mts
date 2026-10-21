/**
 * Claude Code PreToolUse hook: rejects writes to specs and schemas that break the repo rules (AGENTS.md,
 * Constitution) before the file changes. ESLint and check:ids check the same things for everyone in CI;
 * this hook gives the AI faster feedback.
 *
 * Only the lines being written are checked, so old code elsewhere in the file doesn't block an edit.
 * Each rule's `id` is the one in AGENTS.md's "(checked: <id>)"; `npm run check:drift` keeps them in sync.
 *
 * Hook contract: JSON on stdin ({ tool_name, tool_input }). Exit 0 = allow, exit 2 = reject (stderr goes
 * to the AI as the reason).
 */
import { existsSync, readFileSync } from "node:fs";

type Edit = { old_string?: string; new_string?: string };
type ToolInput = { file_path?: string; content?: string; edits?: Edit[] } & Edit;

const SPEC_FILE = /(^|\/)tests\/.+\.spec\.ts$/;
const SCHEMA_FILE = /(^|\/)tests\/.+\/schemas\/.+\.ts$/;

type Rule = { id: string; files: RegExp; test: (added: string) => boolean; message: string };

const RULES: Rule[] = [
  {
    id: "strict-schema",
    files: SCHEMA_FILE,
    test: (s) => /\bz\.object\(/.test(s),
    message: "Use z.strictObject, not z.object, so a field that is not in the contract fails.",
  },
  {
    id: "imports",
    files: SPEC_FILE,
    test: (s) => /from\s+["'](@playwright\/test|redline-playwright\/fixture)["']/.test(s),
    message:
      "Import test and expect from ./fixtures, not from @playwright/test or redline-playwright/fixture.",
  },
  {
    id: "no-fixed-wait",
    files: SPEC_FILE,
    test: (s) => /\bwaitForTimeout\s*\(/.test(s),
    message:
      "No waitForTimeout. Wait for the condition instead (a status, a response, an assertion).",
  },
  {
    id: "no-only",
    files: SPEC_FILE,
    test: (s) => /\b(test|describe)\.only\s*\(/.test(s),
    message: "test.only or describe.only left in.",
  },
  {
    id: "no-hardcoded-id",
    files: SPEC_FILE,
    test: (s) => /["'`]\/[a-z_-]+\/[0-9]+([/?"'`]|$)/m.test(s),
    message:
      "Hardcoded id in a URL, such as /brands/1. Create the data in the test and use its id.",
  },
  {
    id: "test-ids",
    files: SPEC_FILE,
    // A new test (not test.step or test.describe) needs its @TC- tag in the same text.
    test: (s) => {
      const tests = s.match(/\btest\(\s*(["'`]|$)/gm)?.length ?? 0;
      const ids = s.match(/@TC-[A-Z0-9]+(-[0-9]+)?\b/g)?.length ?? 0;
      return tests > ids;
    },
    message: 'Every test needs exactly one @TC-<AREA>-<NNN> tag, e.g. { tag: "@TC-BRD-021" }.',
  },
];

/** Lines in `after` that are not in `before`. */
function addedLines(before: string, after: string): string {
  const old = new Set(before.split("\n").map((l) => l.trim()));
  return after
    .split("\n")
    .filter((l) => !old.has(l.trim()))
    .join("\n");
}

function addedText(tool: string, input: ToolInput): string {
  const file = input.file_path ?? "";
  if (tool === "Write") {
    const before = existsSync(file) ? readFileSync(file, "utf8") : "";
    return addedLines(before, input.content ?? "");
  }
  const edits = tool === "MultiEdit" ? (input.edits ?? []) : [input];
  return edits.map((e) => addedLines(e.old_string ?? "", e.new_string ?? "")).join("\n");
}

const { tool_name: tool, tool_input: input } = JSON.parse(readFileSync(0, "utf8")) as {
  tool_name: string;
  tool_input: ToolInput;
};

const file = input.file_path ?? "";
const rules = RULES.filter((r) => r.files.test(file));
if (["Write", "Edit", "MultiEdit"].includes(tool) && rules.length > 0) {
  const added = addedText(tool, input);
  const broken = rules
    .filter((r) => r.test(added))
    .map((r) => `- ${r.message} (AGENTS.md: ${r.id})`);
  if (broken.length > 0) {
    console.error(`Rejected by the repo rules (AGENTS.md):\n${broken.join("\n")}`);
    process.exit(2);
  }
}
process.exit(0);
