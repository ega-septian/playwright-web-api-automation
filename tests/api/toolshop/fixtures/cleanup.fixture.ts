import type {
  APIRequestContext,
  Fixtures,
  PlaywrightTestArgs,
  PlaywrightWorkerArgs,
} from "@playwright/test";
import type { AuthFixtures } from "./auth.fixture";

/** Items deleted after each test: a 201 from `POST <create path>` → `DELETE <delete path>/{id}`. */
const CLEANED_UP: Record<string, string> = {
  "/brands": "/brands",
  "/users/register": "/users",
};

/**
 * Wraps `request`: every brand and user a test creates is deleted with the admin token when the test
 * ends, so the shared live server doesn't fill up with test data. Cleanup errors are ignored (the test
 * may have deleted the item itself, or a product may still use it).
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
          if (path in CLEANED_UP && response.status() === 201) {
            const { id } = await response.json();
            if (id) created.push(`${CLEANED_UP[path]}/${id}`);
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
