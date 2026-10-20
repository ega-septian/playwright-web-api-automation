/**
 * Which Toolshop the tests and `npm run contract` talk to, from TOOLSHOP_TARGET:
 *   live  (default)  the public demo API, shared with everyone who practises on it
 *   local            Practice Software Testing sprint 5 in Docker (see README)
 * A function, not a constant: playwright.config.ts loads .env after its imports run.
 */
const URLS = {
  live: "https://api.practicesoftwaretesting.com",
  local: "http://localhost:8091",
} as const;

export type ToolshopTarget = keyof typeof URLS;

export function toolshop(): { target: ToolshopTarget; url: string } {
  const target = process.env.TOOLSHOP_TARGET || "live";
  if (!(target in URLS)) {
    throw new Error(
      `TOOLSHOP_TARGET must be one of ${Object.keys(URLS).join(", ")}, got "${target}"`,
    );
  }
  return { target: target as ToolshopTarget, url: URLS[target as ToolshopTarget] };
}
