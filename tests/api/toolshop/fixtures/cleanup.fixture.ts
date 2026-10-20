import type {
  APIRequestContext,
  Fixtures,
  PlaywrightTestArgs,
  PlaywrightWorkerArgs,
} from "@playwright/test";
import type { AuthFixtures } from "./auth.fixture";

/** Collections whose new items are deleted after each test: `POST <path>` → `DELETE <path>/{id}`. */
const CLEANED_UP = ["/brands"];

/**
 * Wraps `request`: every item a test creates with `POST /brands` is deleted with the admin token when
 * the test ends, so the shared live server doesn't fill up with test data. Cleanup errors are ignored
 * (the test may have deleted the item itself, or a product may still use it).
 */
export const cleanup: Fixtures<
  object,
  object,
  PlaywrightTestArgs,
  PlaywrightWorkerArgs & AuthFixtures
> = {
  request: async ({ request, adminToken, playwright }, use, testInfo) => {
    const created: string[] = [];
    const tracked = new Proxy(request, {
      get(target, prop) {
        const value = Reflect.get(target, prop);
        if (prop !== "post") return typeof value === "function" ? value.bind(target) : value;
        return async (...args: Parameters<APIRequestContext["post"]>) => {
          const response = await target.post(...args);
          const path = typeof args[0] === "string" ? args[0] : "";
          if (CLEANED_UP.includes(path) && response.status() === 201) {
            const { id } = await response.json();
            if (id) created.push(`${path}/${id}`);
          }
          return response;
        };
      },
    });

    await use(tracked);

    if (created.length === 0) return;
    const admin = await playwright.request.newContext({
      baseURL: testInfo.project.use.baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${adminToken}` },
    });
    for (const item of created.reverse()) await admin.delete(item).catch(() => undefined);
    await admin.dispose();
  },
};
