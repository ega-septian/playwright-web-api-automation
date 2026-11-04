/**
 * Report which tests are affected by the files changed in a pull request, using Redline's impact graph.
 *
 *   node scripts/redline-impact.mts --comment
 *   node scripts/redline-impact.mts --files schemas/brand.ts,tests/api/toolshop/brand.spec.ts
 *   node scripts/redline-impact.mts --json
 *
 * In GitHub Actions the impact step needs REDLINE_URL, REDLINE_API_KEY, GITHUB_TOKEN and
 * GITHUB_REPOSITORY. It is advisory: the full suite still runs. The comment is updated in place,
 * marked with <!-- redline-impact -->.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

type ImpactTest = { test: string; test_case_id?: string; run_id: number };
type ImpactResponse = { tests?: ImpactTest[] };
type ChangedFile = { file: string; tests: ImpactTest[]; error?: string };
type GithubFile = { filename: string };

const args = process.argv.slice(2);
const hasFlag = (name: string) => args.includes(name);
const valueOf = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const base = process.env.REDLINE_BASE || valueOf("--base") || "origin/main";
const shouldComment = hasFlag("--comment");
const asJson = hasFlag("--json");
const explicitFiles = (valueOf("--files") || "")
  .split(",")
  .map((file) => file.trim())
  .filter(Boolean);
const redlineURL = (process.env.REDLINE_URL || "http://localhost:8787").replace(/\/$/, "");
const apiKey = process.env.REDLINE_API_KEY || "";

async function changedFiles(): Promise<string[]> {
  if (explicitFiles.length > 0) return explicitFiles;
  const fromPR = await pullRequestFiles();
  if (fromPR !== null) return fromPR;
  const result = spawnSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git diff ${base}...HEAD failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

/** In Actions, ask GitHub for the PR files; no shallow-clone merge base is needed. */
async function pullRequestFiles(): Promise<string[] | null> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const pr = pullRequestNumber();
  if (!token || !repo || !pr) return null;
  const api = process.env.GITHUB_API_URL || "https://api.github.com";
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "redline-impact",
  };
  const files: string[] = [];
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(
      `${api}/repos/${repo}/pulls/${pr}/files?per_page=100&page=${page}`,
      {
        headers,
      },
    );
    if (!response.ok) {
      console.log(`[redline-impact] GitHub file list gagal (${response.status}); fallback ke git.`);
      return null;
    }
    const batch = (await response.json()) as GithubFile[];
    files.push(...batch.map((file) => file.filename));
    if (batch.length < 100) break;
  }
  return files;
}

async function impact(file: string): Promise<ImpactTest[]> {
  const response = await fetch(`${redlineURL}/api/impact?file=${encodeURIComponent(file)}`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const body = (await response.json()) as ImpactResponse;
  return body.tests ?? [];
}

function keyOf(test: ImpactTest): string {
  return test.test_case_id || test.test;
}

function dedupe(tests: ImpactTest[]): ImpactTest[] {
  const seen = new Map<string, ImpactTest>();
  for (const test of tests) {
    if (!seen.has(keyOf(test))) seen.set(keyOf(test), test);
  }
  return [...seen.values()].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function markdown(files: ChangedFile[], tests: ImpactTest[]): string {
  const lines = ["<!-- redline-impact -->", "### Redline impact", ""];
  if (files.length === 0) {
    lines.push("No changed files found.");
    return lines.join("\n");
  }
  lines.push(
    `**${files.length} changed file${files.length === 1 ? "" : "s"}** → **${tests.length} affected test${tests.length === 1 ? "" : "s"}**.`,
    "",
  );
  if (tests.length === 0) {
    lines.push("No mapped test for these changes. The full suite still runs.");
  } else {
    lines.push("| TC | Test |", "| --- | --- |");
    for (const test of tests.slice(0, 40)) {
      lines.push(`| ${test.test_case_id || "—"} | ${escapeCell(test.test)} |`);
    }
    if (tests.length > 40) lines.push(`| … | ${tests.length - 40} more |`);
    const ids = tests.map((test) => test.test_case_id).filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      lines.push(
        "",
        "Run only these locally:",
        "",
        "```bash",
        `npx playwright test --grep "(${ids.join("|")})"`,
        "```",
      );
    }
  }
  const failed = files.filter((file) => file.error);
  if (failed.length > 0) {
    lines.push(
      "",
      "Impact lookup failed for:",
      ...failed.map((file) => `- \`${file.file}\`: ${file.error}`),
    );
  }
  lines.push("", "_Full suite still runs in CI. This comment is advisory._");
  return lines.join("\n");
}

type GithubComment = { id: number; body?: string };

function pullRequestNumber(): number | null {
  const explicit = Number(process.env.REDLINE_PR_NUMBER || "");
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && existsSync(eventPath)) {
    const event = JSON.parse(readFileSync(eventPath, "utf8")) as {
      pull_request?: { number?: number };
      issue?: { number?: number };
    };
    const number = event.pull_request?.number ?? event.issue?.number;
    if (number) return number;
  }
  return null;
}

async function postComment(body: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.log("[redline-impact] GITHUB_TOKEN/GITHUB_REPOSITORY tidak ada; komentar dilewati.");
    return;
  }
  const pr = pullRequestNumber();
  if (!pr) {
    console.log("[redline-impact] nomor PR tidak ditemukan; komentar dilewati.");
    return;
  }
  const api = process.env.GITHUB_API_URL || "https://api.github.com";
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "redline-impact",
    "Content-Type": "application/json",
  };
  const baseURL = `${api}/repos/${repo}/issues`;
  const list = await fetch(`${baseURL}/${pr}/comments?per_page=100`, { headers });
  if (!list.ok) {
    throw new Error(`GitHub menolak daftar komentar (${list.status})`);
  }
  const comments = (await list.json()) as GithubComment[];
  const marker = "<!-- redline-impact -->";
  const existing = comments.find((comment) => comment.body?.includes(marker));
  const url = existing
    ? `${api}/repos/${repo}/issues/comments/${existing.id}`
    : `${baseURL}/${pr}/comments`;
  const response = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers,
    body: JSON.stringify({ body }),
  });
  if (!response.ok) {
    throw new Error(
      `GitHub menolak komentar (${response.status}): ${(await response.text()).slice(0, 200)}`,
    );
  }
  console.log(`[redline-impact] komentar PR ${existing ? "diperbarui" : "dibuat"}: ${repo}#${pr}`);
}

async function main() {
  const files = await changedFiles();
  const results: ChangedFile[] = await Promise.all(
    files.map(async (file) => {
      try {
        return { file, tests: await impact(file) };
      } catch (error) {
        return {
          file,
          tests: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
  const tests = dedupe(results.flatMap((result) => result.tests));

  if (asJson) {
    console.log(JSON.stringify({ base, files: results, tests }, null, 2));
    return;
  }

  const body = markdown(results, tests);
  console.log(body);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, `${body}\n`);
  if (shouldComment) await postComment(body);
}

main().catch((error: unknown) => {
  console.error(`[redline-impact] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
