/**
 * Quarantine as code.
 *
 * The gate reads this file so an ephemeral Redline (empty database) can still allow known failures.
 * The file is validated on every PR by `npm run check:quarantine`; the gate merges it with the active
 * quarantines stored in Redline, so quarantines created from the UI keep working too.
 */
import { existsSync, readFileSync } from "node:fs";

export type FileQuarantine = {
  test: string;
  owner: string;
  reason: string;
  until: string;
};

export type QuarantineSet = {
  active: FileQuarantine[];
  expired: FileQuarantine[];
};

export class QuarantineFileError extends Error {}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 90;
const DEFAULT_FILE = "redline-quarantine.json";

export function quarantineFile(): string {
  return process.env.REDLINE_QUARANTINE_FILE || DEFAULT_FILE;
}

export function loadQuarantines(file = quarantineFile()): QuarantineSet {
  if (!existsSync(file)) return { active: [], expired: [] };

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new QuarantineFileError(`${file}: bukan JSON valid (${(error as Error).message})`);
  }
  if (!Array.isArray(raw)) {
    throw new QuarantineFileError(`${file}: root harus array`);
  }

  const today = todayUTC();
  const maxUntil = addDays(today, MAX_DAYS);
  const seen = new Set<string>();
  const active: FileQuarantine[] = [];
  const expired: FileQuarantine[] = [];

  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new QuarantineFileError(`${file}[${index}]: harus object`);
    }
    const item = entry as Record<string, unknown>;
    for (const key of Object.keys(item)) {
      if (!["test", "owner", "reason", "until"].includes(key)) {
        throw new QuarantineFileError(`${file}[${index}]: field tidak dikenal "${key}"`);
      }
    }
    const test = text(item.test, "test", file, index, 300);
    const owner = text(item.owner, "owner", file, index, 64);
    const reason = text(item.reason, "reason", file, index, 500);
    const until = text(item.until, "until", file, index, 10);
    if (!DATE.test(until) || Number.isNaN(Date.parse(`${until}T00:00:00Z`))) {
      throw new QuarantineFileError(`${file}[${index}]: until harus tanggal YYYY-MM-DD`);
    }
    if (until > maxUntil) {
      throw new QuarantineFileError(
        `${file}[${index}] (${test}): until ${until} lebih dari ${MAX_DAYS} hari; maksimal ${maxUntil}`,
      );
    }
    if (seen.has(test)) {
      throw new QuarantineFileError(`${file}[${index}]: ${test} dobel`);
    }
    seen.add(test);
    const quarantine = { test, owner, reason, until };
    if (until < today) expired.push(quarantine);
    else active.push(quarantine);
  });

  return { active, expired };
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function text(
  value: unknown,
  field: string,
  file: string,
  index: number,
  maxLength: number,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new QuarantineFileError(`${file}[${index}]: ${field} wajib diisi`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new QuarantineFileError(`${file}[${index}]: ${field} maksimal ${maxLength} karakter`);
  }
  return trimmed;
}
