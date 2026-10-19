/**
 * Jalankan test, buat laporan Allure, lalu buka di browser.
 *
 *   npm run test:allure                                semua test
 *   npm run test:allure TC-BRD-001                     satu test case (ID dari tag @TC-)
 *   npm run test:allure TC-BRD-001 TC-BRD-005 ...      beberapa test case
 *   npm run test:allure brand                          satu spec file (brand.spec.ts)
 *   npm run test:allure -- --grep "POST /brands"       opsi lain diteruskan ke `playwright test`
 *
 *   npm run test:ai TC-BRD-003                         sama, dengan penjelasan Redline (REDLINE_AI=1)
 *   npm run test:verify TC-BRD-003                     sama, lalu buktikan penyebabnya (REDLINE_VERIFY=1)
 *
 * ID test case (boleh tanpa @, huruf kecil juga boleh) digabung jadi satu --grep. Argumen lain, misalnya
 * nama spec file, diteruskan apa adanya ke `playwright test`.
 *
 * Laporan tetap dibuat dan dibuka walaupun ada test yang gagal. Laporan HTML Playwright tidak dibuka otomatis
 * (supaya tidak ada dua laporan). Tekan Ctrl+C untuk menutup server laporan.
 */
import { spawnSync } from "node:child_process";

const run = (args: string[], env: NodeJS.ProcessEnv = process.env) =>
  spawnSync("npx", args, { stdio: "inherit", env }).status ?? 1;

/** --ai dan --verify dipakai npm run test:ai / test:verify untuk menyalakan Redline di run ini. */
const REDLINE_FLAGS: Record<string, string> = {
  "--ai": "REDLINE_AI",
  "--verify": "REDLINE_VERIFY",
};
const redlineEnv = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a in REDLINE_FLAGS)
    .map((a) => [REDLINE_FLAGS[a], "1"]),
);

const TEST_CASE_ID = /^@?TC-[A-Z]+-\d+$/i;
const args = process.argv.slice(2).filter((a) => !(a in REDLINE_FLAGS));
const ids = args
  .filter((a) => TEST_CASE_ID.test(a))
  .map((a) => a.replace(/^@?/, "@").toUpperCase());
const rest = args.filter((a) => !TEST_CASE_ID.test(a));
// \b supaya @TC-BRD-001 tidak ikut menjalankan @TC-BRD-0010.
const grep = ids.length > 0 ? ["--grep", `(${ids.join("|")})\\b`] : [];

const testStatus = run(["playwright", "test", ...grep, ...rest], {
  ...process.env,
  ...redlineEnv,
  PLAYWRIGHT_HTML_OPEN: "never",
});
if (run(["allure", "generate"]) !== 0) process.exit(testStatus || 1);
run(["allure", "open", "test-results/allure-report"]);
process.exit(testStatus);
