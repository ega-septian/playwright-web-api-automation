import { defineConfig } from "@playwright/test";

// Skenario kag dari scripts/redline-bench.mts (spec dengan import bertingkat). baseURL menunjuk ke proxy benchmark,
// yang meneruskan ke Toolshop atau sengaja merusak response untuk kasus bug backend.
export default defineConfig({
  testDir: "./kag-specs",
  retries: 0,
  workers: 1,
  reporter: [["json", { outputFile: "test-results/results.json" }], ["../reporters/redline.ts"]],
  use: { baseURL: process.env.BENCH_BASE_URL || "http://localhost:8095/" },
  projects: [{ name: "bench" }],
});
