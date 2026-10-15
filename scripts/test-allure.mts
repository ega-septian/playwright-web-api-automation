/**
 * Jalankan test, buat laporan Allure, lalu buka di browser.
 *
 *   npm run test:allure                          semua test
 *   npm run test:allure -- --grep @TC-BRD-001    argumen diteruskan ke `playwright test`
 *
 * Laporan tetap dibuat dan dibuka walaupun ada test yang gagal. Laporan HTML Playwright tidak dibuka otomatis
 * (supaya tidak ada dua laporan). Tekan Ctrl+C untuk menutup server laporan.
 */
import { spawnSync } from "node:child_process";

const run = (args: string[], env: NodeJS.ProcessEnv = process.env) =>
  spawnSync("npx", args, { stdio: "inherit", env }).status ?? 1;

const testStatus = run(["playwright", "test", ...process.argv.slice(2)], {
  ...process.env,
  PLAYWRIGHT_HTML_OPEN: "never",
});
if (run(["allure", "generate"]) !== 0) process.exit(testStatus || 1);
run(["allure", "open", "test-results/allure-report"]);
process.exit(testStatus);
