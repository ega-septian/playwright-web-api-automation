import { defineConfig } from "allure";

// Allure Report 3 (npm "allure", tanpa Java). Hasil dari allure-playwright ada di test-results/allure-results.
//   npm run report:allure        buat laporan HTML di test-results/allure-report
//   npm run report:allure:open   buka laporannya di browser
export default defineConfig({
  name: "Toolshop API tests",
  resultsDir: "test-results/allure-results",
  output: "test-results/allure-report",
  // Riwayat antar run lokal untuk grafik tren. Di CI, riwayatnya dibawa dari laporan sebelumnya.
  historyPath: "test-results/allure-history.jsonl",
  historyLimit: 20,
  // Penyebab kegagalan dari Redline (label "redline", ditulis reporter redline-playwright). Test gagal tanpa
  // analisis Redline (REDLINE_AI tidak aktif) masuk kategori bawaan Allure.
  categories: [
    { name: "Backend bug (Redline)", matchers: { labels: { redline: "backend_bug" } } },
    { name: "Test bug (Redline)", matchers: { labels: { redline: "test_bug" } } },
    { name: "Environment (Redline)", matchers: { labels: { redline: "environment" } } },
    { name: "Flaky (Redline)", matchers: { labels: { redline: "flaky" } } },
    { name: "Unclear (Redline)", matchers: { labels: { redline: "unknown" } } },
  ],
  plugins: {
    awesome: {
      options: {
        reportLanguage: "en",
      },
    },
  },
});
