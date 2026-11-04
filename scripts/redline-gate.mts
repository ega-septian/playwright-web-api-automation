/**
 * Quality gate: read the run Redline just stored and fail only when a failed test has no active
 * quarantine. Quarantined tests still run; the gate allows their known failure until the quarantine
 * expires or is released in the Redline UI.
 *
 *   node scripts/redline-gate.mts
 *
 * Needs test-results/redline-last-run.json from the Redline reporter. REDLINE_URL and
 * REDLINE_API_KEY are optional when the report already contains the URL and the server is local.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

type LastRun = { url?: string; run_id?: number };
type RunResult = {
  test: string;
  test_case_id?: string;
  status: string;
  error?: string;
};
type RunDetail = {
  run: {
    id: number;
    total: number;
    failed: number;
    flaky: number;
    skipped: number;
    report_errors?: string[];
  };
  tests: RunResult[];
};
type Quarantine = {
  key: string;
  test?: string;
  test_case_id?: string;
  owner: string;
  reason: string;
  until: string;
};

const LAST_RUN = path.join("test-results", "redline-last-run.json");
const apiKey = process.env.REDLINE_API_KEY || "";

function readLastRun(): LastRun {
  if (!existsSync(LAST_RUN)) {
    throw new Error(`${LAST_RUN} belum ada; jalankan npx playwright test dulu`);
  }
  return JSON.parse(readFileSync(LAST_RUN, "utf8")) as LastRun;
}

async function get<T>(baseURL: string, pathname: string): Promise<T> {
  const response = await fetch(`${baseURL}${pathname}`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(
      `${pathname} returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  return (await response.json()) as T;
}

function keyOf(test: RunResult): string {
  return test.test_case_id || test.test;
}

function isQuarantined(test: RunResult, keys: Set<string>): boolean {
  return (
    keys.has(keyOf(test)) ||
    keys.has(test.test) ||
    (!!test.test_case_id && keys.has(test.test_case_id))
  );
}

function markdown(
  run: RunDetail["run"],
  failed: RunResult[],
  blocking: RunResult[],
  allowed: RunResult[],
): string {
  const lines = ["### Redline quality gate", ""];
  lines.push(
    `Run #${run.id}: **${failed.length} failed**, ${allowed.length} quarantined, **${blocking.length} blocking**, ${run.flaky} flaky.`,
  );
  if (run.report_errors?.length) {
    lines.push("", `Report errors: ${run.report_errors.join(" · ")}`);
  }
  if (blocking.length > 0) {
    lines.push("", "Blocking failures:", "");
    for (const test of blocking) {
      lines.push(`- **${test.test_case_id || "—"}** ${test.test}`);
      if (test.error) lines.push(`  ${test.error.replace(/\s+/g, " ").slice(0, 180)}`);
    }
  }
  if (allowed.length > 0) {
    lines.push("", "Allowed by active quarantine:", "");
    for (const test of allowed) {
      lines.push(`- **${test.test_case_id || "—"}** ${test.test}`);
    }
  }
  if (blocking.length === 0) lines.push("", "Gate passed.");
  return lines.join("\n");
}

async function main() {
  const last = readLastRun();
  if (!last.run_id) throw new Error("run_id tidak ada di redline-last-run.json");
  const baseURL = (process.env.REDLINE_URL || last.url || "http://localhost:8787").replace(
    /\/$/,
    "",
  );

  const [detail, quarantines] = await Promise.all([
    get<RunDetail>(baseURL, `/api/runs/${last.run_id}`),
    get<Quarantine[]>(baseURL, "/api/tests/quarantine"),
  ]);

  if (detail.run.report_errors?.length) {
    throw new Error(
      `run #${last.run_id} punya report error: ${detail.run.report_errors.join(" · ")}`,
    );
  }
  const failed = detail.tests.filter((test) => test.status === "failed");
  if (detail.run.failed !== failed.length) {
    throw new Error(
      `run #${last.run_id}: run.failed=${detail.run.failed}, detail=${failed.length}; gate menolak data tidak konsisten`,
    );
  }

  const keys = new Set(quarantines.map((q) => q.key));
  const blocking = failed.filter((test) => !isQuarantined(test, keys));
  const allowed = failed.filter((test) => isQuarantined(test, keys));
  const body = markdown(detail.run, failed, blocking, allowed);

  console.log(body);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, `${body}\n`);
  if (blocking.length > 0) {
    console.error(`[redline-gate] ${blocking.length} failure tanpa quarantine aktif`);
    process.exitCode = 1;
  } else {
    console.log(
      `[redline-gate] lolos${allowed.length ? `; ${allowed.length} failure di-quarantine` : ""}.`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(`[redline-gate] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
