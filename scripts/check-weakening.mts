/**
 * Cek apakah perubahan spec melemahkan test, dibanding base (default: titik cabang dari origin/main).
 * Dipakai skill pr-reviewer, dan sebelum menerima perbaikan test buatan AI.
 *
 *   npm run check:weakening              bandingkan working tree dengan merge-base origin/main
 *   npm run check:weakening -- <ref>     bandingkan dengan ref lain
 *
 * Per test (dikenali dari tag @TC-): test hilang, jumlah expect berkurang, status code yang diharapkan
 * hilang atau diganti (status tambahan, misalnya GET setelah write, tidak dihitung), atau skip/fixme/only baru. Ini bukan larangan (kadang memang benar), tapi harus disetujui user.
 * Exit 1 kalau ada temuan.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const git = (...args: string[]) => spawnSync("git", args, { encoding: "utf8" }).stdout.trim();

const base = process.argv[2] ?? git("merge-base", "origin/main", "HEAD");
const files = git("diff", "--name-only", base, "--", "tests")
  .split("\n")
  .filter((f) => f.endsWith(".spec.ts"));

type TestInfo = { expects: number; statuses: string[]; flags: string[] };

/** Potong file per deklarasi test, lalu catat per ID @TC-. */
function testsOf(source: string): Map<string, TestInfo> {
  const out = new Map<string, TestInfo>();
  const parts = source.split(/\n(?=\s*test(?:\.(?:skip|fixme|only))?\(\s*(?:["'`]|$))/m);
  for (const part of parts) {
    const id = part.match(/@TC-[A-Z0-9]+(?:-[A-Z0-9]+)*/)?.[0];
    if (!id) continue;
    out.set(id, {
      expects: part.match(/\bexpect\(/g)?.length ?? 0,
      statuses: [...part.matchAll(/\.toBe\((\d{3})\)/g)].map((m) => m[1]),
      flags: (part.match(/\btest\.(skip|fixme|only)\(/g) ?? []).map((f) => f.slice(5, -1)),
    });
  }
  return out;
}

/** Elemen `before` yang jumlahnya berkurang di `after`. */
function removed(before: string[], after: string[]): string[] {
  const left = [...after];
  return before.filter((x) => {
    const i = left.indexOf(x);
    if (i === -1) return true;
    left.splice(i, 1);
    return false;
  });
}

const findings: string[] = [];
for (const file of files) {
  const before = testsOf(
    spawnSync("git", ["show", `${base}:${file}`], { encoding: "utf8" }).stdout ?? "",
  );
  const after = testsOf(existsSync(file) ? readFileSync(file, "utf8") : "");
  for (const [id, old] of before) {
    const now = after.get(id);
    if (!now) {
      findings.push(`${file} ${id}: test dihapus (atau ID-nya diganti)`);
      continue;
    }
    if (now.expects < old.expects) {
      findings.push(`${file} ${id}: expect berkurang ${old.expects} → ${now.expects}`);
    }
    // Status yang ditambah (misalnya GET baru setelah write) memperkuat test; yang hilang atau diganti tidak.
    const gone = removed(old.statuses, now.statuses);
    if (gone.length > 0) {
      findings.push(
        `${file} ${id}: status yang diharapkan hilang atau diganti: ${gone.join(", ")} (sekarang: ${now.statuses.join(" ") || "-"})`,
      );
    }
    for (const flag of now.flags.filter((f) => !old.flags.includes(f))) {
      findings.push(`${file} ${id}: test.${flag} baru`);
    }
  }
  for (const [id, now] of after) {
    if (!before.has(id) && now.flags.length > 0) {
      findings.push(
        `${file} ${id}: test baru langsung ${now.flags.map((f) => `test.${f}`).join(", ")}`,
      );
    }
  }
}

if (findings.length === 0) {
  console.log(
    `✓ Tidak ada test yang dilemahkan (${files.length} spec berubah sejak ${base.slice(0, 7)})`,
  );
} else {
  console.log(`${findings.length} perubahan yang melemahkan test, perlu persetujuan user:`);
  for (const f of findings) console.log(`  - ${f}`);
  process.exit(1);
}
