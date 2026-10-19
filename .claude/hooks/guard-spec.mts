/**
 * Hook PreToolUse Claude Code: tolak penulisan spec file yang melanggar aturan repo (AGENTS.md, Constitution),
 * sebelum file berubah. ESLint dan check:ids di CI mengecek hal yang sama untuk semua orang; hook ini memberi
 * umpan balik lebih cepat ke AI.
 *
 * Yang dicek hanya baris yang BARU ditulis, jadi kode lama yang belum rapi tidak memblokir edit di tempat lain.
 *
 * Kontrak hook: input JSON di stdin ({ tool_name, tool_input }). Exit 0 = boleh, exit 2 = tolak (stderr
 * dikirim ke AI sebagai alasan).
 */
import { existsSync, readFileSync } from "node:fs";

type Edit = { old_string?: string; new_string?: string };
type ToolInput = { file_path?: string; content?: string; edits?: Edit[] } & Edit;

const SPEC_FILE = /(^|\/)tests\/.+\.spec\.ts$/;

const RULES: { test: (added: string) => boolean; message: string }[] = [
  {
    test: (s) => /from\s+["'](@playwright\/test|redline-playwright\/fixture)["']/.test(s),
    message:
      "Spec import test dan expect dari ./fixtures, bukan @playwright/test atau redline-playwright/fixture (MUST: Imports).",
  },
  {
    test: (s) => /\bwaitForTimeout\s*\(/.test(s),
    message:
      "waitForTimeout dilarang. Tunggu kondisinya (status, response, assertion) (WON'T: fixed waits).",
  },
  {
    test: (s) => /\b(test|describe)\.only\s*\(/.test(s),
    message: "test.only atau describe.only tertinggal (WON'T: test.only).",
  },
  {
    test: (s) => /["'`]\/[a-z_-]+\/[0-9]+([/?"'`]|$)/m.test(s),
    message:
      "ID hardcode di URL, misalnya /brands/1. Buat datanya di test dan pakai id-nya (WON'T: hardcoded ids).",
  },
  {
    // Deklarasi test baru (bukan test.step/test.describe) harus membawa tag @TC- di teks yang sama.
    test: (s) => {
      const tests = s.match(/\btest\(\s*(["'`]|$)/gm)?.length ?? 0;
      const ids = s.match(/@TC-[A-Z0-9]+(-[0-9]+)?\b/g)?.length ?? 0;
      return tests > ids;
    },
    message:
      'Setiap test butuh tepat satu tag @TC-<AREA>-<NNN>, misalnya { tag: "@TC-BRD-021" } (MUST: Test case IDs).',
  },
];

/** Baris di `after` yang belum ada di `before`. */
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

if (["Write", "Edit", "MultiEdit"].includes(tool) && SPEC_FILE.test(input.file_path ?? "")) {
  const added = addedText(tool, input);
  const broken = RULES.filter((r) => r.test(added)).map((r) => `- ${r.message}`);
  if (broken.length > 0) {
    console.error(`Ditolak oleh aturan repo (AGENTS.md):\n${broken.join("\n")}`);
    process.exit(2);
  }
}
process.exit(0);
