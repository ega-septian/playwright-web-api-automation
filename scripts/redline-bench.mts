/**
 * Benchmark Redline: tanam bug yang jawabannya sudah diketahui, lalu ukur seberapa sering Redline benar.
 *
 *   npm run redline:bench
 *   npm run redline:bench -- --only=T01,B02 --scenario=cold --memory=off
 *
 * Bug ditanam di salinan project (kode asli tidak diubah):
 *   test_bug     kode test diubah (redline-bench/cases.json, "edit")
 *   backend_bug  proxy di depan Toolshop merusak response ("proxy")
 *   environment  baseURL salah, atau koneksi diputus ("baseURL", "proxy.hangup")
 *
 * Skenario:
 *   history  semua spec dijalankan bersih dulu, jadi Redline punya pembanding (matriks perubahan)
 *   cold     tanpa riwayat, seperti test yang baru ditulis
 * Setiap skenario memakai server Redline sendiri dengan schema database terpisah (bench_<skenario>),
 * jadi data Redline yang biasa tidak tercampur.
 *
 * --memory=on (default): setelah dinilai, kasus diberi label jawaban benar, sehingga kasus berikutnya
 * bisa memakai kasus mirip (butuh VOYAGE_API_KEY di .env Redline). --memory=off mematikan Voyage.
 *
 * Env: REDLINE_DIR (default ~/Developer/redline), TOOLSHOP_URL (default http://localhost:8091),
 *      BENCH_REDLINE_PORT (8788), BENCH_PROXY_PORT (8095)
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { makeSandbox, resetSandbox } from "./sandbox.mts";

const ROOT = process.cwd();
const REDLINE_DIR = process.env.REDLINE_DIR || path.join(homedir(), "Developer", "redline");
const TOOLSHOP = (process.env.TOOLSHOP_URL || "http://localhost:8091").replace(/\/$/, "");
const SERVER_PORT = Number(process.env.BENCH_REDLINE_PORT || 8788);
const PROXY_PORT = Number(process.env.BENCH_PROXY_PORT || 8095);
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const CONFIG = "redline-bench/playwright.bench.config.ts";
const OUT_DIR = path.join(ROOT, "test-results", "redline-bench");

type Category = "test_bug" | "backend_bug" | "environment";
type ProxyMutation = {
  method: string;
  path: string;
  status?: number;
  body?: unknown;
  drop?: string;
  rename?: [string, string];
  stringify?: string;
  set?: Record<string, unknown>;
  hangup?: boolean;
};
type Case = {
  id: string;
  truth: Category;
  test: string;
  about: string;
  edit?: { file: string; find: string; replace: string };
  proxy?: ProxyMutation;
  baseURL?: string;
};
type Analysis = {
  source: string;
  category: string;
  confidence: string;
  summary: string;
  cost_usd: number;
  similar?: unknown[];
};
type Result = {
  scenario: string;
  id: string;
  about: string;
  truth: Category;
  status: "graded" | "not_failed" | "error";
  predicted?: string;
  source?: string;
  confidence?: string;
  correct?: boolean;
  similar?: number;
  cost: number;
  note?: string;
};

// ---------- proxy: meneruskan ke Toolshop, atau merusak response sesuai kasus ----------

let mutation: ProxyMutation | null = null;

function transform(value: unknown, m: ProxyMutation): unknown {
  if (Array.isArray(value)) return value.map((v) => transform(v, m));
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === m.drop) continue;
    const key = m.rename && k === m.rename[0] ? m.rename[1] : k;
    out[key] = k === m.stringify ? String(v) : transform(v, m);
  }
  return out;
}

function startProxy(): http.Server {
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const url = new URL(req.url ?? "/", TOOLSHOP);
    const m =
      mutation && mutation.method === req.method && mutation.path === url.pathname
        ? mutation
        : null;
    if (m?.hangup) {
      req.socket.destroy();
      return;
    }
    try {
      const headers: Record<string, string> = {};
      for (const h of ["content-type", "accept", "authorization"]) {
        const v = req.headers[h];
        if (typeof v === "string") headers[h] = v;
      }
      const upstream = await fetch(TOOLSHOP + (req.url ?? "/"), {
        method: req.method,
        headers,
        body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
      });
      let status = upstream.status;
      let text = await upstream.text();
      if (m) {
        if (m.status) status = m.status;
        if (m.body !== undefined) {
          text = JSON.stringify(m.body);
        } else if (m.drop || m.rename || m.stringify || m.set) {
          let json = transform(JSON.parse(text), m);
          if (m.set && json && typeof json === "object" && !Array.isArray(json))
            json = { ...json, ...m.set };
          text = JSON.stringify(json);
        }
      }
      res.writeHead(status, {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      });
      res.end(text);
    } catch (e) {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`proxy benchmark: ${(e as Error).message}`);
    }
  });
  server.listen(PROXY_PORT);
  return server;
}

// ---------- server Redline khusus benchmark ----------

function buildServer(): string {
  const bin = path.join(tmpdir(), "redline-bench-server");
  const r = spawnSync("go", ["build", "-o", bin, "./cmd/server"], {
    cwd: REDLINE_DIR,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`go build gagal di ${REDLINE_DIR}: ${r.stderr}`);
  return bin;
}

async function startServer(bin: string, scenario: string, memory: boolean): Promise<ChildProcess> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(SERVER_PORT),
    DATABASE_SCHEMA: `bench_${scenario}`,
    DATABASE_SCHEMA_RESET: "1",
    STATUS_FROM: "all",
    RETENTION_DAYS: "0",
  };
  if (!memory) env.VOYAGE_API_KEY = ""; // ada tapi kosong: .env tidak menimpanya
  const child = spawn(bin, [], { cwd: REDLINE_DIR, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout?.on("data", (d) => (log += d));
  child.stderr?.on("data", (d) => (log += d));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${SERVER_URL}/healthz`)).ok) return child;
    } catch {
      // belum siap
    }
    if (child.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error(`server Redline benchmark tidak jalan:\n${log.slice(-1500)}`);
}

async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(SERVER_URL + url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(180_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

// ---------- menjalankan spec di salinan ----------

type LastRun = { failures: { fingerprint: string; test: string }[] };

// Async: proxy berjalan di proses ini, jadi event loop tidak boleh diblokir selama Playwright jalan.
async function runSpecs(sandbox: string, grep: string | null, baseURL?: string): Promise<LastRun> {
  const results = path.join(sandbox, "redline-bench", "test-results");
  rmSync(results, { recursive: true, force: true });
  const args = ["playwright", "test", "-c", CONFIG];
  if (grep) args.push(`--grep=${grep}`);
  const child = spawn("npx", args, {
    cwd: sandbox,
    env: {
      ...process.env,
      REDLINE_URL: SERVER_URL,
      REDLINE_AI: "0",
      BENCH_BASE_URL: baseURL ?? `http://localhost:${PROXY_PORT}/`,
    },
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  const timer = setTimeout(() => child.kill(), 3 * 60_000);
  const exit = await new Promise<string>((resolve) =>
    child.on("close", (code, signal) => resolve(`exit ${code ?? ""} ${signal ?? ""}`.trim())),
  );
  clearTimeout(timer);
  const file = path.join(results, "redline-last-run.json");
  if (!existsSync(file)) {
    writeFileSync(path.join(tmpdir(), "redline-bench-last-error.log"), output);
    throw new Error(
      `reporter Redline tidak menulis redline-last-run.json (${exit}):\n${output.slice(-1500)}`,
    );
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

function applyEdit(sandbox: string, edit: NonNullable<Case["edit"]>) {
  const file = path.join(sandbox, edit.file);
  const src = readFileSync(file, "utf8");
  const hits = src.split(edit.find).length - 1;
  if (hits !== 1) throw new Error(`teks yang diganti muncul ${hits}x di ${edit.file} (harus 1)`);
  writeFileSync(
    file,
    src.replace(edit.find, () => edit.replace),
  );
}

async function runCase(
  sandbox: string,
  scenario: string,
  c: Case,
  memory: boolean,
): Promise<Result> {
  const base: Result = {
    scenario,
    id: c.id,
    about: c.about,
    truth: c.truth,
    status: "error",
    cost: 0,
  };
  try {
    if (c.edit) applyEdit(sandbox, c.edit);
    mutation = c.proxy ?? null;
    const run = await runSpecs(sandbox, c.test, c.baseURL);
    if (run.failures.length === 0)
      return { ...base, status: "not_failed", note: "bug tidak membuat test gagal" };

    const fp = run.failures[0].fingerprint;
    const { analysis: a } = await api<{ analysis: Analysis }>(
      "POST",
      `/api/groups/${fp}/analyze?force=1`,
    );
    if (a.source === "human") {
      return {
        ...base,
        status: "not_failed",
        note: "kelompok sama dengan kasus sebelumnya (sudah dilabeli)",
      };
    }
    if (memory) {
      await api("PUT", `/api/groups/${fp}/label`, {
        label: c.truth,
        note: c.about,
        by: "benchmark",
      });
    }
    return {
      ...base,
      status: "graded",
      predicted: a.category,
      source: a.source,
      confidence: a.confidence,
      correct: a.category === c.truth,
      similar: a.similar?.length ?? 0,
      cost: a.source === "ai" ? a.cost_usd : 0,
    };
  } catch (e) {
    return { ...base, note: (e as Error).message.slice(0, 200) };
  } finally {
    mutation = null;
    resetSandbox(sandbox);
  }
}

// ---------- laporan ----------

const names: Record<string, string> = {
  test_bug: "BUG DI TEST",
  backend_bug: "BUG BACKEND",
  environment: "ENVIRONMENT",
  flaky: "FLAKY",
  unknown: "BELUM JELAS",
};
const sources: Record<string, string> = { rule: "aturan", ai: "AI" };
const pct = (n: number, d: number) => (d === 0 ? "-" : `${Math.round((n / d) * 100)}%`);

function summarize(results: Result[], scenario: string, memory: boolean): string {
  const rows = results.filter((r) => r.scenario === scenario);
  const graded = rows.filter((r) => r.status === "graded");
  const guessed = graded.filter((r) => r.predicted !== "unknown");
  const correct = graded.filter((r) => r.correct);
  const out = [
    `## Skenario: ${scenario === "history" ? "dengan riwayat (pernah lulus)" : "cold start (test baru)"}` +
      ` · ingatan ${memory ? "on" : "off"}`,
    "",
    `**Benar ${correct.length}/${graded.length} (${pct(correct.length, graded.length)})** · ` +
      `kalau menebak: ${correct.length}/${guessed.length} (${pct(correct.length, guessed.length)}) · ` +
      `tidak menebak: ${graded.length - guessed.length}`,
    "",
    "| Jawaban benar | Benar | Salah | Tidak menebak |",
    "|---|---|---|---|",
  ];
  for (const cat of ["test_bug", "backend_bug", "environment"]) {
    const g = graded.filter((r) => r.truth === cat);
    const ok = g.filter((r) => r.correct).length;
    const unk = g.filter((r) => r.predicted === "unknown").length;
    out.push(`| ${names[cat]} | ${ok}/${g.length} | ${g.length - ok - unk} | ${unk} |`);
  }
  out.push("", "| Diputuskan oleh | Benar |", "|---|---|");
  for (const src of ["rule", "ai"]) {
    const g = graded.filter((r) => r.source === src);
    out.push(
      `| ${sources[src]} | ${g.filter((r) => r.correct).length}/${g.length} (${pct(g.filter((r) => r.correct).length, g.length)}) |`,
    );
  }
  out.push("", "| Kasus | Bug | Jawaban | Tebakan | Oleh | Mirip |", "|---|---|---|---|---|---|");
  for (const r of rows) {
    const mark =
      r.status !== "graded" ? "⚠️" : r.correct ? "✅" : r.predicted === "unknown" ? "➖" : "❌";
    const guess =
      r.status === "graded"
        ? `${mark} ${names[r.predicted!] ?? r.predicted} (${r.confidence})`
        : `${mark} ${r.note}`;
    out.push(
      `| ${r.id} | ${r.about} | ${names[r.truth]} | ${guess} | ${r.source ? (sources[r.source] ?? r.source) : "-"} | ${r.similar ?? "-"} |`,
    );
  }
  const cost = rows.reduce((n, r) => n + r.cost, 0);
  out.push("", `Biaya AI skenario ini: $${cost.toFixed(4)}`, "");
  return out.join("\n");
}

// ---------- main ----------

async function main() {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const only = arg("only")?.split(",");
  const scenarios = arg("scenario") ? [arg("scenario")!] : ["history", "cold"];
  const memory = arg("memory") !== "off";
  const cases = (
    JSON.parse(readFileSync(path.join(ROOT, "redline-bench", "cases.json"), "utf8")) as Case[]
  ).filter((c) => !only || only.includes(c.id));

  console.log(
    `Benchmark Redline: ${cases.length} kasus × ${scenarios.length} skenario, ingatan ${memory ? "on" : "off"}`,
  );
  const bin = buildServer();
  const proxy = startProxy();
  const sandbox = makeSandbox(ROOT);
  const results: Result[] = [];
  try {
    for (const scenario of scenarios) {
      console.log(`\n━━ skenario ${scenario}`);
      const server = await startServer(bin, scenario, memory);
      try {
        if (scenario === "history") {
          process.stdout.write("  baseline (semua spec bersih)… ");
          const base = await runSpecs(sandbox, null);
          if (base.failures.length > 0) {
            throw new Error(
              `baseline harus lulus semua, tapi ${base.failures.length} gagal. Toolshop jalan?`,
            );
          }
          console.log("lulus");
        }
        for (const c of cases) {
          process.stdout.write(`  ${c.id} ${c.about.padEnd(58)} `);
          const r = await runCase(sandbox, scenario, c, memory);
          results.push(r);
          console.log(
            r.status !== "graded"
              ? `⚠️  ${r.note}`
              : `${r.correct ? "✅" : r.predicted === "unknown" ? "➖" : "❌"} ${names[r.predicted!] ?? r.predicted} (${sources[r.source!] ?? r.source})`,
          );
        }
      } finally {
        server.kill();
      }
    }
  } finally {
    proxy.close();
    rmSync(sandbox, { recursive: true, force: true });
  }

  const md = [
    "# Benchmark Redline",
    "",
    `${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB · ${cases.length} bug tertanam · ingatan ${memory ? "on" : "off"}`,
    "",
    ...scenarios.map((s) => summarize(results, s, memory)),
  ].join("\n");
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  writeFileSync(path.join(OUT_DIR, `bench-${stamp}.md`), md);
  writeFileSync(path.join(OUT_DIR, `bench-${stamp}.json`), JSON.stringify(results, null, 2));
  console.log("\n" + md);
  console.log(`Laporan: ${path.relative(ROOT, path.join(OUT_DIR, `bench-${stamp}.md`))}`);
}

main().catch((e) => {
  console.error(`[bench] ${(e as Error).message}`);
  process.exit(1);
});
