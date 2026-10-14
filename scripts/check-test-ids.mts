/**
 * Cek ID test case: setiap test punya tepat satu tag @TC-, formatnya benar, dan tidak ada ID yang dipakai
 * dua test. Redline memakai ID ini sebagai ID test case di laporan dan untuk menyambung riwayat test yang
 * di-rename, jadi ID yang hilang, dobel, atau beda huruf besar/kecil merusak riwayatnya.
 *
 *   npm run check:ids
 *
 * Format: TC- lalu huruf besar/angka, boleh dipisah tanda hubung. Contoh: @TC-BRD-001, @TC-00323.
 * Test dibaca lewat `playwright test --list`, jadi tidak ada test yang dijalankan.
 */
import { spawnSync } from "node:child_process";

const FORMAT = /^TC-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

type Spec = { title: string; file: string; line: number; tags?: string[] };
type Suite = { specs?: Spec[]; suites?: Suite[] };

function specsOf(suites: Suite[], out: Spec[] = []): Spec[] {
  for (const s of suites) {
    out.push(...(s.specs ?? []));
    specsOf(s.suites ?? [], out);
  }
  return out;
}

const list = spawnSync("npx", ["playwright", "test", "--list", "--reporter=json"], {
  encoding: "utf8",
  env: { ...process.env, REDLINE: "0" },
  maxBuffer: 64 * 1024 * 1024,
});
if (list.status !== 0) {
  console.error(list.stderr || list.stdout);
  process.exit(1);
}

// Spec yang sama bisa muncul di beberapa project; cukup dicek sekali.
const specs = new Map<string, Spec>();
for (const spec of specsOf((JSON.parse(list.stdout) as { suites: Suite[] }).suites)) {
  specs.set(`${spec.file}:${spec.line}`, spec);
}

const problems: string[] = [];
const owners = new Map<string, string[]>();
for (const [where, spec] of specs) {
  const ids = (spec.tags ?? []).map((t) => t.replace(/^@/, "")).filter((t) => /^TC-/i.test(t));
  const name = `${where} "${spec.title}"`;
  if (ids.length === 0) {
    problems.push(`${name}: tidak punya tag @TC-`);
    continue;
  }
  if (ids.length > 1)
    problems.push(`${name}: punya ${ids.length} tag @TC- (${ids.join(", ")}), cukup satu`);
  for (const id of ids) {
    if (!FORMAT.test(id)) {
      problems.push(
        `${name}: format @${id} salah, pakai huruf besar, angka, dan tanda hubung (misalnya @TC-BRD-001)`,
      );
    }
    owners.set(id, [...(owners.get(id) ?? []), name]);
  }
}
for (const [id, names] of owners) {
  if (names.length > 1)
    problems.push(`@${id} dipakai ${names.length} test:\n    ${names.join("\n    ")}`);
}

if (problems.length > 0) {
  console.error(`ID test case bermasalah (${problems.length}):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    "\nSetiap test butuh tepat satu tag @TC- yang unik. Lihat README, bagian Test conventions.",
  );
  process.exit(1);
}
console.log(`✓ ${specs.size} test, semuanya punya satu ID @TC- yang unik`);
