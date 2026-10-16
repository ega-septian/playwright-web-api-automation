import { rmSync } from "node:fs";
import path from "node:path";

/** Hasil Allure run sebelumnya (allure-playwright tidak menghapusnya sendiri). Lihat allurerc.mjs. */
export const ALLURE_RESULTS_DIR = path.join(__dirname, "test-results", "allure-results");

/** Laporan Allure run sebelumnya. `allure generate` tidak mengosongkannya, jadi file lama bisa tertinggal. */
export const ALLURE_REPORT_DIR = path.join(__dirname, "test-results", "allure-report");

/** Kosongkan hasil dan laporan Allure sekali sebelum test berjalan, supaya laporan hanya berisi run ini. */
export default function globalSetup() {
  rmSync(ALLURE_RESULTS_DIR, { recursive: true, force: true });
  rmSync(ALLURE_REPORT_DIR, { recursive: true, force: true });
}
