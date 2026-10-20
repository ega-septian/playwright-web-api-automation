import { test as base } from "@playwright/test";
import type { ToolshopTarget } from "../../../../toolshop.target.mts";

export type TargetOptions = { toolshopTarget: ToolshopTarget };

/**
 * The target the run uses, set in playwright.config.ts. Tests that change state other people on the
 * live server depend on skip themselves there: `test.skip(toolshopTarget === "live", "<reason>")`.
 */
export const test = base.extend<object, TargetOptions>({
  toolshopTarget: ["live", { option: true, scope: "worker" }],
});
