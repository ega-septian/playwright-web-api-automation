/**
 * Memastikan server Redline yang di-checkout CI sama versinya dengan paket redline-playwright.
 *
 *   npm run check:redline-ref
 *
 * package.json mem-pin paket dari GitHub dengan tag (#vX.Y.Z), sedangkan playwright.yml mem-checkout
 * server pada REDLINE_REF. Reporter dan server berbicara lewat /api, jadi keduanya harus naik versi
 * bersama; kalau berbeda, CI bisa lulus dengan kombinasi yang tidak pernah diuji.
 */
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const workflow = readFileSync(".github/workflows/playwright.yml", "utf8");

const dependency =
  pkg.devDependencies?.["redline-playwright"] ?? pkg.dependencies?.["redline-playwright"];
const packageRef = /#(v\d[^"#\s]*)$/.exec(dependency ?? "")?.[1];
const ciRef = /^\s*REDLINE_REF:\s*(\S+)\s*$/m.exec(workflow)?.[1];

const problems: string[] = [];
if (!packageRef) {
  problems.push(
    `package.json: redline-playwright harus di-pin ke tag GitHub (#vX.Y.Z), dapat ${dependency ?? "(tidak ada)"}`,
  );
}
if (!ciRef) {
  problems.push("playwright.yml: tidak menemukan REDLINE_REF");
}
if (packageRef && ciRef && packageRef !== ciRef) {
  problems.push(
    `versi berbeda: package.json memakai ${packageRef}, playwright.yml memakai ${ciRef}. Naikkan keduanya di PR yang sama.`,
  );
}

if (problems.length > 0) {
  console.error("Versi Redline tidak selaras:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`✓ Redline ${packageRef}: paket dan server di CI memakai versi yang sama`);
