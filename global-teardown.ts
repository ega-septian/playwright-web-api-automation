import { readdirSync, rmdirSync } from "node:fs";
import path from "node:path";

/** Folder bukti per test (trace, error-context). Lihat outputDir di playwright.config.ts. */
export const ARTIFACTS_DIR = path.join(__dirname, "test-results", "artifacts");

/**
 * Hapus folder kosong di ARTIFACTS_DIR setelah semua test selesai. Playwright membuat satu folder per test,
 * tapi untuk test yang lulus isinya (trace) dihapus; yang tersisa hanya folder test yang gagal.
 */
export default function globalTeardown() {
  removeEmpty(ARTIFACTS_DIR);
}

/** Hapus folder kosong secara rekursif. Mengembalikan true kalau dir sendiri ikut terhapus. */
function removeEmpty(dir: string): boolean {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false; // belum ada
  }
  let remaining = entries.length;
  for (const e of entries) {
    if (e.isDirectory() && removeEmpty(path.join(dir, e.name))) remaining--;
  }
  if (remaining > 0) return false;
  rmdirSync(dir);
  return true;
}
