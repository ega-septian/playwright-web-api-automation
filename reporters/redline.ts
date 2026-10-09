/**
 * Kirim results.json ke server Redline. Pasang SETELAH reporter "json".
 *
 * Env (opsional):
 *   REDLINE_URL          default http://localhost:8787
 *   REDLINE=0            matikan
 *   REDLINE_APP_VERSION  versi backend, misalnya sprint5-with-bugs
 *   REDLINE_AI=1         analisis penyebab kegagalan
 *   REDLINE_AI_MAX       default 10
 *   REDLINE_TRIGGERED_BY nama yang menjalankan, default user laptop atau ci:<GITHUB_ACTOR>
 *
 * ID test case diambil dari tag: test("...", { tag: "@TC-USR-001" }, ...)
 * Kegagalan dikelompokkan per insiden (penyebab sama); analisis dan REDLINE_AI_MAX dihitung per insiden.
 * Laporan lengkap ditulis ke redline-report.md di folder results.json.
 * Daftar kegagalan ditulis ke redline-last-run.json untuk `npm run redline:verify` (eksperimen).
 */
import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { execSync } from "node:child_process";
import { userInfo } from "node:os";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sourceFiles, sourceHash } from "./source-hash";

type Options = {
  /** Default: outputFile reporter "json". */
  reportFile?: string;
  url?: string;
};

type GroupChange = {
  fingerprint: string;
  test: string;
  error?: string;
  occurrences: number;
  incident?: string;
};
type Incident = {
  key: string;
  kind: string;
  label: string;
  tests: number;
  representative: string;
  fingerprints: string[];
};
type Analysis = {
  source: "rule" | "ai" | "human";
  category: string;
  confidence: string;
  summary: string;
  evidence: string[];
  next_step: string;
  cost_usd: number;
  patch?: string; // source experiment: diff yang terbukti membuat test lulus
  similar?: Similar[]; // kasus terbukti yang mirip maknanya (referensi untuk AI, bukan bukti)
};
type Similar = { test: string; category: string; source: string; similarity: number };
type IngestResult = {
  run_id: number;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  new: GroupChange[];
  recurring: GroupChange[];
  regressed: GroupChange[];
  resolved: GroupChange[];
  incidents?: Incident[]; // kosong di server Redline versi lama
  shared_status?: boolean; // false: run ini hanya pratinjau, status bersama tidak diubah
};
type Status = "BARU" | "REGRESSED" | "MASIH GAGAL";
type Row = { id: string; group: GroupChange; status: Status };
/** Satu penyebab, satu baris laporan: analisis dilakukan sekali untuk seluruh test di dalamnya. */
type IncidentView = {
  label: string;
  kind: string;
  rows: Row[];
  status: Status;
  representative: Row;
  analysis?: Analysis;
  cached?: boolean;
  note?: string;
};

export default class RedlineReporter implements Reporter {
  private options: Options;
  private config?: FullConfig;
  private testsRun = 0;
  /** "file:line" -> hash kode test. */
  private hashes: Record<string, string> = {};
  /** "file:line" -> file lokal yang dipakai test (peta kode), relatif terhadap project. */
  private files: Record<string, string[]> = {};
  /** "project › file › judul" (format server) -> ID dari tag @TC-... */
  private ids: Record<string, string> = {};
  /** "project › file › judul" -> curl dari fixture Redline, hanya untuk test yang gagal. */
  private curls: Record<string, string> = {};

  constructor(options: Options = {}) {
    this.options = options;
  }

  // Supaya reporter list/line tetap tampil.
  printsToStdio() {
    return false;
  }

  onBegin(config: FullConfig) {
    this.config = config;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status !== "skipped") this.testsRun++;
    const { file, line, column } = test.location;
    const relFile = path
      .relative(this.config?.rootDir ?? process.cwd(), file)
      .split(path.sep)
      .join("/");
    const key = `${relFile}:${line}`;
    const testKey = `${test.parent.project()?.name ?? ""} › ${relFile} › ${test.titlePath().slice(3).join(" › ")}`;
    const id = test.tags.find((t) => /^@TC-/i.test(t));
    if (id) this.ids[testKey] = id.slice(1);
    const curl = result.attachments.find((a) => a.name === "curl" && a.body);
    if (curl?.body) this.curls[testKey] = curl.body.toString();
    if (!(key in this.hashes)) {
      const hash = sourceHash(file, line, column);
      if (hash) this.hashes[key] = hash;
      const root = this.config?.configFile ? path.dirname(this.config.configFile) : process.cwd();
      this.files[key] = sourceFiles(file).map((f) =>
        path.relative(root, f).split(path.sep).join("/"),
      );
    }
  }

  async onEnd(result: FullResult) {
    if (process.env.REDLINE === "0") return;
    // --list atau semua di-skip.
    if (this.testsRun === 0) return;
    // Ctrl+C: hasil tidak lengkap.
    if (result.status === "interrupted") {
      log("run dihentikan di tengah jalan, hasil tidak dikirim.");
      return;
    }

    const file = this.reportFile();
    if (!file || !existsSync(file)) {
      log(
        `results.json tidak ditemukan${file ? ` di ${file}` : ""}. Pastikan reporter "json" dipasang sebelum reporter Redline.`,
      );
      return;
    }

    const baseURL = (
      process.env.REDLINE_URL ||
      this.options.url ||
      "http://localhost:8787"
    ).replace(/\/$/, "");
    const params = new URLSearchParams({ source: process.env.CI ? "ci" : "local" });
    const commit = git("rev-parse --short HEAD");
    const branch =
      process.env.GITHUB_HEAD_REF ||
      process.env.GITHUB_REF_NAME ||
      git("rev-parse --abbrev-ref HEAD");
    if (commit) params.set("commit", commit);
    if (branch) params.set("branch", branch);
    if (process.env.REDLINE_APP_VERSION) params.set("app_version", process.env.REDLINE_APP_VERSION);
    params.set("triggered_by", triggeredBy());
    const ciURL = githubRunURL();
    if (ciURL) params.set("ci_url", ciURL);

    let res: Response;
    try {
      res = await fetch(`${baseURL}/api/runs?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: `{"playwright":${readFileSync(file, "utf8")},"test_hashes":${JSON.stringify(this.hashes)},"test_files":${JSON.stringify(this.files)}}`,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      const timedOut = (e as Error).name === "TimeoutError";
      log(
        timedOut
          ? `server di ${baseURL} tidak membalas dalam 15 detik, hasil mungkin tidak tersimpan. Cek log server Redline.`
          : `server tidak bisa dihubungi di ${baseURL}, hasil tidak dikirim. (Matikan dengan REDLINE=0)`,
      );
      return;
    }
    if (!res.ok) {
      log(`server menolak laporan (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return;
    }
    const summary = (await res.json()) as IngestResult;
    const idOf = (g: GroupChange) => this.ids[g.test] ?? "-";
    const rows: Row[] = [
      ...summary.regressed.map((g) => ({ id: idOf(g), group: g, status: "REGRESSED" as const })),
      ...summary.new.map((g) => ({ id: idOf(g), group: g, status: "BARU" as const })),
      ...summary.recurring.map((g) => ({ id: idOf(g), group: g, status: "MASIH GAGAL" as const })),
    ];
    const incidents = toIncidents(rows, summary.incidents ?? []);
    const ai = process.env.REDLINE_AI === "1";
    const cost = ai ? await analyze(incidents, baseURL) : 0;
    const resolved = summary.resolved.map((g) => ({ id: idOf(g), test: g.test }));
    writeLastRun(
      path.join(path.dirname(file), "redline-last-run.json"),
      baseURL,
      summary,
      incidents,
    );

    const mdFile = path.join(path.dirname(file), "redline-report.md");
    const when = jakartaTime(result.startTime);
    const md = markdownReport(summary, incidents, resolved, baseURL, cost, when, this.curls);
    writeFileSync(mdFile, md);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");

    console.log(
      terminalReport(
        summary,
        incidents,
        resolved,
        path.relative(process.cwd(), mdFile),
        cost,
        when,
      ),
    );
    if (!ai && rows.length > 0)
      log("jalankan dengan REDLINE_AI=1 untuk analisis penyebab kegagalan.");
    if (rows.length > 0) {
      const score = await scoreLine(baseURL);
      if (score) log(score);
      log("buktikan penyebabnya dengan eksperimen: npm run redline:verify");
    }
  }

  private reportFile(): string | undefined {
    const configDir = this.config?.configFile
      ? path.dirname(this.config.configFile)
      : process.cwd();
    if (this.options.reportFile) return path.resolve(configDir, this.options.reportFile);
    if (process.env.PLAYWRIGHT_JSON_OUTPUT_FILE)
      return path.resolve(configDir, process.env.PLAYWRIGHT_JSON_OUTPUT_FILE);
    const json = this.config?.reporter.find(([name]) => name === "json");
    const outputFile = (json?.[1] as { outputFile?: string } | undefined)?.outputFile;
    return outputFile ? path.resolve(configDir, outputFile) : undefined;
  }
}

/** Satu baris rapor akurasi: tebakan aturan dan AI dibanding bukti. Kosong kalau belum ada yang dinilai. */
async function scoreLine(baseURL: string): Promise<string> {
  try {
    const res = await fetch(`${baseURL}/api/scoreboard?limit=1`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return "";
    const board = (await res.json()) as {
      sources: { source: string; graded: number; correct: number }[];
    };
    const parts = board.sources
      .filter((s) => s.graded > 0)
      .map((s) => `${sourceLabel[s.source] ?? s.source} ${s.correct}/${s.graded} benar`);
    return parts.length > 0
      ? `rapor tebakan Redline: ${parts.join(" · ")} (detail: npm run redline -- score)`
      : "";
  } catch {
    return "";
  }
}

/** Kegagalan run ini untuk CLI eksperimen (scripts/redline.mts). Satu entri per insiden: wakilnya saja. */
function writeLastRun(file: string, url: string, r: IngestResult, incidents: IncidentView[]) {
  const failures = incidents.map((v) => ({
    fingerprint: v.representative.group.fingerprint,
    test: v.representative.group.test,
    id: v.representative.id,
    status: v.representative.status,
    affected: v.rows.length,
  }));
  writeFileSync(file, JSON.stringify({ url, run_id: r.run_id, failures }, null, 2));
}

function triggeredBy(): string {
  if (process.env.REDLINE_TRIGGERED_BY) return process.env.REDLINE_TRIGGERED_BY;
  if (process.env.CI) return process.env.GITHUB_ACTOR ? `ci:${process.env.GITHUB_ACTOR}` : "ci";
  try {
    return userInfo().username;
  } catch {
    return "";
  }
}

/** Halaman run GitHub Actions: berisi log dan artifact (trace, screenshot). */
function githubRunURL(): string {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : "";
}

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

function log(msg: string) {
  console.log(`\n[redline] ${msg}`);
}

const categoryLabel: Record<string, string> = {
  backend_bug: "BUG BACKEND",
  test_bug: "BUG DI TEST",
  environment: "ENVIRONMENT",
  flaky: "FLAKY",
  unknown: "BELUM JELAS",
};
const sourceLabel: Record<string, string> = {
  rule: "aturan",
  ai: "AI",
  human: "label manual",
  experiment: "eksperimen (terbukti)",
};
const statusIcon: Record<Status, string> = {
  BARU: "🆕 Baru",
  REGRESSED: "🔁 Regressed",
  "MASIH GAGAL": "⏳ Masih gagal",
};

const statusRank: Record<Status, number> = { REGRESSED: 3, BARU: 2, "MASIH GAGAL": 1 };

/** Gabungkan kelompok kegagalan per insiden. Tanpa data insiden (server lama), tiap kelompok berdiri sendiri. */
function toIncidents(rows: Row[], incidents: Incident[]): IncidentView[] {
  const byFp = new Map(rows.map((r) => [r.group.fingerprint, r]));
  const used = new Set<string>();
  const views: IncidentView[] = [];
  for (const inc of incidents) {
    const members = inc.fingerprints.map((fp) => byFp.get(fp)).filter((r): r is Row => !!r);
    if (members.length === 0) continue;
    members.forEach((r) => used.add(r.group.fingerprint));
    members.sort((a, b) => statusRank[b.status] - statusRank[a.status]);
    views.push({
      label: inc.label,
      kind: inc.kind,
      rows: members,
      status: members[0].status,
      representative: byFp.get(inc.representative) ?? members[0],
    });
  }
  for (const r of rows) {
    if (!used.has(r.group.fingerprint))
      views.push({ label: "", kind: "error", rows: [r], status: r.status, representative: r });
  }
  return views;
}

/** Nama insiden: untuk satu test, ID + judul lebih berguna daripada potongan pesan error. */
function incidentName(v: IncidentView): string {
  if (v.rows.length === 1 && (v.kind === "error" || !v.label)) {
    const r = v.rows[0];
    return `${r.id !== "-" ? r.id + " " : ""}${shortTitle(r.group.test)}`;
  }
  return v.label;
}

// Satu analisis per insiden, lewat kelompok representative. Regressed dianalisis ulang (force).
async function analyze(incidents: IncidentView[], baseURL: string): Promise<number> {
  const max = Number(process.env.REDLINE_AI_MAX || 10);
  let cost = 0;
  for (const v of incidents.slice(0, max)) {
    const force = v.representative.status === "REGRESSED";
    let res: Response;
    try {
      res = await fetch(
        `${baseURL}/api/groups/${v.representative.group.fingerprint}/analyze${force ? "?force=1" : ""}`,
        {
          method: "POST",
          signal: AbortSignal.timeout(90_000),
        },
      );
    } catch {
      v.note = "gagal menghubungi server";
      continue;
    }
    const body = (await res.json()) as { analysis?: Analysis; cached?: boolean; error?: string };
    if (!res.ok || !body.analysis) {
      // 503: AI belum aktif dan tidak ada aturan yang cocok.
      v.note = body.error ?? `analisis gagal (${res.status})`;
      continue;
    }
    v.analysis = body.analysis;
    v.cached = body.cached;
    if (!body.cached) cost += body.analysis.cost_usd;
  }
  for (const v of incidents.slice(max)) v.note = "dilewati, atur REDLINE_AI_MAX";
  return cost;
}

/** Judul tanpa "project › file › ". */
function shortTitle(test: string): string {
  return test.split(" › ").slice(2).join(" › ") || test;
}

function cause(v: IncidentView): string {
  return oneLine(v.analysis?.summary ?? v.note ?? v.representative.group.error ?? "");
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function category(v: IncidentView): string {
  return v.analysis ? (categoryLabel[v.analysis.category] ?? v.analysis.category) : "-";
}

const TERMINAL_MAX = 15;

/** Waktu dalam WIB, apa pun zona waktu mesin yang menjalankan test. */
function jakartaTime(d: Date): string {
  const f = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${f.format(d)} WIB`;
}

const PREVIEW_NOTE =
  "Run lokal: hanya pratinjau, status bersama tim tidak diubah (hanya run CI yang mengubahnya).";

function isPreview(r: IngestResult): boolean {
  return r.shared_status === false;
}

function terminalReport(
  r: IngestResult,
  incidents: IncidentView[],
  resolved: { id: string; test: string }[],
  mdFile: string,
  cost: number,
  when: string,
): string {
  const out = [
    `\n[redline] run #${r.run_id} · ${when}: ${r.passed} lulus, ${r.failed} gagal, ${r.flaky} flaky, ${r.skipped} skip`,
  ];
  if (isPreview(r)) out.push(`  ${PREVIEW_NOTE}`);
  if (incidents.length > 0) {
    const failedTests = incidents.reduce((n, v) => n + v.rows.length, 0);
    if (incidents.length < failedTests)
      out.push(`  ${failedTests} kegagalan dari ${incidents.length} penyebab`);
    const shown = incidents.slice(0, TERMINAL_MAX);
    const table = [
      ["#", "INSIDEN", "TEST", "STATUS", "KATEGORI", "PENYEBAB"],
      ...shown.map((v, i) => [
        String(i + 1),
        truncate(incidentName(v), 50),
        String(v.rows.length),
        v.status,
        category(v),
        truncate(cause(v), 70),
      ]),
    ];
    const widths = table[0].map((_, i) => Math.max(...table.map((cells) => cells[i].length)));
    const right = new Set([0, 2]);
    out.push("");
    for (const cells of table) {
      out.push(
        "  " +
          cells
            .map((c, i) =>
              i === cells.length - 1
                ? c
                : right.has(i)
                  ? c.padStart(widths[i])
                  : c.padEnd(widths[i]),
            )
            .join("  "),
      );
    }
    if (incidents.length > TERMINAL_MAX)
      out.push(`  + ${incidents.length - TERMINAL_MAX} penyebab lain, lihat laporan lengkap`);
  }
  if (resolved.length > 0) {
    const names = resolved.map((x) => (x.id !== "-" ? x.id : shortTitle(x.test)));
    out.push("", `  Sudah beres (${names.length}): ${truncate(names.join(", "), 200)}`);
  }
  if (cost > 0) out.push(`  Biaya AI: $${cost.toFixed(5)}`);
  out.push("", `  Laporan lengkap: ${mdFile}`);
  return out.join("\n");
}

function cell(s: string): string {
  return oneLine(s).replace(/\|/g, "\\|");
}

const DETAILS_FROM = 10;

function markdownReport(
  r: IngestResult,
  incidents: IncidentView[],
  resolved: { id: string; test: string }[],
  baseURL: string,
  cost: number,
  when: string,
  curls: Record<string, string>,
): string {
  const md = [
    `# Redline: run #${r.run_id}`,
    "",
    `${when} · **${r.passed}** lulus · **${r.failed}** gagal · **${r.flaky}** flaky · **${r.skipped}** skip`,
    "",
  ];
  if (isPreview(r)) md.push(`> ℹ️ ${PREVIEW_NOTE}`, "");
  if (incidents.length === 0) {
    md.push("✅ Tidak ada kegagalan.", "");
  } else {
    const failedTests = incidents.reduce((n, v) => n + v.rows.length, 0);
    md.push(`${failedTests} kegagalan dari **${incidents.length}** penyebab.`, "");
    md.push(
      "| # | Insiden | Test | Status | Kategori | Keyakinan | Ringkasan |",
      "|---|---|---|---|---|---|---|",
    );
    incidents.forEach((v, i) => {
      md.push(
        `| ${i + 1} | ${cell(incidentName(v))} | ${v.rows.length} | ${statusIcon[v.status]} | ${category(v)} | ${v.analysis?.confidence ?? "-"} | ${cell(truncate(cause(v), 120))} |`,
      );
    });
    md.push("");
    incidents.forEach((v, i) => {
      const a = v.analysis;
      md.push(`## ${i + 1}. ${incidentName(v)}`, "");
      const meta = [`**Test terdampak:** ${v.rows.length}`, `**Status:** ${statusIcon[v.status]}`];
      if (a) {
        meta.push(`**Kategori:** ${category(v)}`, `**Keyakinan:** ${a.confidence}`);
        meta.push(`**Sumber:** ${sourceLabel[a.source] ?? a.source}${v.cached ? " (cache)" : ""}`);
      }
      md.push(meta.join(" · "), "");
      if (a) {
        md.push(a.summary, "");
        if (a.evidence?.length)
          md.push("**Bukti**", ...a.evidence.map((e) => `- ${oneLine(e)}`), "");
        if (a.next_step) md.push(`**Langkah berikutnya:** ${a.next_step}`, "");
        if (a.patch) md.push("**Patch yang terbukti**", "```diff", a.patch, "```", "");
        if (a.similar?.length)
          md.push(
            "**Kasus mirip yang sudah terbukti** (referensi, bukan bukti)",
            ...a.similar.map(
              (c) =>
                `- ${categoryLabel[c.category] ?? c.category} · kemiripan ${c.similarity.toFixed(2)} · ${shortTitle(c.test)}`,
            ),
            "",
          );
      } else if (v.note) {
        md.push(`_Analisis: ${v.note}_`, "");
      }
      if (v.representative.group.error)
        md.push("**Contoh error**", "```", v.representative.group.error, "```", "");
      const curl = curls[v.representative.group.test];
      if (curl) md.push("**Reproduksi dengan curl**", "```bash", curl, "```", "");

      const list = ["| ID | Test | Status |", "|---|---|---|"];
      for (const row of v.rows) {
        const times = row.group.occurrences > 1 ? ` (${row.group.occurrences}x)` : "";
        list.push(
          `| ${row.id} | ${cell(shortTitle(row.group.test))} | ${statusIcon[row.status]}${times} |`,
        );
      }
      if (v.rows.length >= DETAILS_FROM) {
        md.push(
          `<details><summary>${v.rows.length} test terdampak</summary>`,
          "",
          ...list,
          "",
          "</details>",
          "",
        );
      } else {
        md.push(...list, "");
      }
      md.push(
        `[Detail di Redline](${baseURL}/api/groups/${v.representative.group.fingerprint})`,
        "",
      );
    });
  }
  if (resolved.length > 0) {
    md.push(
      "## Sudah beres",
      "",
      ...resolved.map((x) => `- ${x.id !== "-" ? `**${x.id}** ` : ""}${shortTitle(x.test)}`),
      "",
    );
  }
  if (cost > 0) md.push(`_Biaya AI run ini: $${cost.toFixed(5)}_`, "");
  return md.join("\n");
}
