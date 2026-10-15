/**
 * Bagian ReportPortal untuk benchmark skenario "rp" (scripts/redline-bench.mts): membuat project kosong,
 * menunggu Auto-Analysis ReportPortal selesai, membaca tebakannya, dan memberi label jawaban benar seperti
 * tim QA yang melakukan triage. ReportPortal memakai pengaturan bawaannya (tidak diubah).
 */

export type RP = { url: string; project: string; key: string }; // url tanpa /api, misalnya http://localhost:8585

/** Jenis defect ReportPortal → kategori Redline. To Investigate = tidak menebak. */
export const CATEGORY: Record<string, string> = {
  pb001: "backend_bug",
  ab001: "test_bug",
  si001: "environment",
};
export const LOCATOR: Record<string, string> = {
  backend_bug: "pb001",
  test_bug: "ab001",
  environment: "si001",
};

async function call<T>(rp: RP, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${rp.url}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${rp.key}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok)
    throw new Error(`ReportPortal ${method} ${path}: ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/** Project baru yang kosong, supaya Auto-Analysis mulai tanpa riwayat label seperti Redline. */
export async function createProject(rp: Omit<RP, "project">, name: string): Promise<RP> {
  await call({ ...rp, project: name }, "POST", "/project", {
    projectName: name,
    entryType: "INTERNAL",
  });
  return { ...rp, project: name };
}

type Launch = { id: number; status: string; analysing?: string[] };

/**
 * Tunggu launch dengan atribut redline_run=token ditutup agen Playwright, lalu tunggu Auto-Analysis
 * ReportPortal (berjalan otomatis setelah launch selesai) sampai tidak ada analyzer yang berjalan.
 */
export async function waitForAnalysis(rp: RP, token: string): Promise<number> {
  const q = new URLSearchParams({ "filter.has.compositeAttribute": `redline_run:${token}` });
  const deadline = Date.now() + 120_000;
  let finishedAt = 0;
  let idle = 0;
  while (Date.now() < deadline) {
    const { content } = await call<{ content: Launch[] }>(rp, "GET", `/${rp.project}/launch?${q}`);
    const l = content[0];
    if (l && l.status !== "IN_PROGRESS") {
      finishedAt ||= Date.now();
      idle = (l.analysing ?? []).length === 0 ? idle + 1 : 0;
      // Auto-Analysis mulai sesaat setelah launch ditutup: tunggu minimal 4 detik, lalu dua kali berturut
      // tanpa analyzer yang berjalan.
      if (Date.now() - finishedAt >= 4000 && idle >= 2) return l.id;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `launch ReportPortal redline_run=${token} tidak selesai dianalisis dalam 2 menit`,
  );
}

export type Guess = { itemId: number; issueType: string; auto: boolean; predicted: string };

/** Tebakan ReportPortal untuk test target (dicari lewat atribut tc dari tag @TC-). */
export async function guessFor(rp: RP, launchId: number, caseId: string): Promise<Guess | null> {
  const q = new URLSearchParams({
    "filter.eq.launchId": String(launchId),
    "filter.has.compositeAttribute": `tc:${caseId}`,
    "filter.eq.hasStats": "true",
    "filter.eq.hasChildren": "false",
  });
  const { content } = await call<{
    content: { id: number; status: string; issue?: { issueType: string; autoAnalyzed: boolean } }[];
  }>(rp, "GET", `/${rp.project}/item?${q}`);
  const item = content.find((i) => i.status === "FAILED");
  if (!item) return null;
  const issueType = item.issue?.issueType ?? "ti001";
  const auto = item.issue?.autoAnalyzed ?? false;
  // Hanya label dari Auto-Analysis yang dihitung sebagai tebakan ReportPortal.
  return {
    itemId: item.id,
    issueType,
    auto,
    predicted: auto ? (CATEGORY[issueType] ?? "unknown") : "unknown",
  };
}

/** Label jawaban benar oleh "manusia", menjadi riwayat untuk Auto-Analysis berikutnya. */
export async function label(rp: RP, itemId: number, category: string, comment: string) {
  await call(rp, "PUT", `/${rp.project}/item`, {
    issues: [
      {
        testItemId: itemId,
        issue: {
          issueType: LOCATOR[category],
          comment,
          autoAnalyzed: false,
          ignoreAnalyzer: false,
        },
      },
    ],
  });
}
