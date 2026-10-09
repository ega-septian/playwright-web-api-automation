import { defineConfig } from "@playwright/test";

// Dipakai scripts/redline-bench.mts di salinan project. baseURL menunjuk ke proxy benchmark,
// yang meneruskan ke Toolshop atau sengaja merusak response untuk kasus bug backend.
export default defineConfig({
  testDir: "./specs",
  retries: 0,
  workers: 1,
  reporter: [["json", { outputFile: "test-results/results.json" }], ["../reporters/redline.ts"]],
  use: { baseURL: process.env.BENCH_BASE_URL || "http://localhost:8095/" },
  projects: [{ name: "bench" }],
});
