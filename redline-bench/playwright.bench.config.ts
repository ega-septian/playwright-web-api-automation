import { defineConfig, type ReporterDescription } from "@playwright/test";

// Dipakai scripts/redline-bench.mts di salinan project. baseURL menunjuk ke proxy benchmark,
// yang meneruskan ke Toolshop atau sengaja merusak response untuk kasus bug backend.
// Skenario rp: hasil juga dikirim ke ReportPortal (project benchmark sendiri), dengan token run yang sama.
const reportPortal: ReporterDescription[] =
  process.env.REPORTPORTAL === "1" && process.env.RP_API_KEY
    ? [
        [
          "@reportportal/agent-js-playwright",
          {
            apiKey: process.env.RP_API_KEY,
            endpoint: process.env.RP_ENDPOINT ?? "http://localhost:8585/api/v2",
            project: process.env.RP_PROJECT,
            launch: process.env.RP_LAUNCH ?? "bench",
            attributes: [{ key: "redline_run", value: process.env.REDLINE_RUN_TOKEN ?? "" }],
            skippedIssue: false,
          },
        ],
      ]
    : [];

export default defineConfig({
  testDir: "./specs",
  retries: 0,
  workers: 1,
  reporter: [
    ["json", { outputFile: "test-results/results.json" }],
    ["redline-playwright/reporter"],
    ...reportPortal,
  ],
  use: { baseURL: process.env.BENCH_BASE_URL || "http://localhost:8095/" },
  projects: [{ name: "bench" }],
});
