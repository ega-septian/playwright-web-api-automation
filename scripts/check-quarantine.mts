/**
 * Validate the quarantine file without running tests or contacting Redline.
 *
 *   npm run check:quarantine
 *
 * Runs in the CI workflow, so a malformed or over-long quarantine fails before the quality gate.
 */
import { loadQuarantines, QuarantineFileError, quarantineFile } from "./redline-quarantine.mts";

try {
  const file = quarantineFile();
  const { active, expired } = loadQuarantines(file);
  console.log(`✓ ${file}: ${active.length} quarantine aktif`);
  for (const item of active) {
    console.log(`  - ${item.test} sampai ${item.until} (${item.owner})`);
  }
  for (const item of expired) {
    console.warn(
      `  ! ${item.test} sudah lewat ${item.until}; hapus entri atau perpanjang sebelum test gagal lagi`,
    );
  }
} catch (error) {
  console.error(
    `[quarantine] ${error instanceof QuarantineFileError ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
