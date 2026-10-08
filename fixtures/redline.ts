/**
 * Catat bentuk response API (field + tipe, tanpa nilai) untuk Redline.
 * Pakai: import { test, expect } from "../../../fixtures/redline";
 */
import { test as base, expect, type APIResponse } from "@playwright/test";

/** Contoh: "string", "null|string", ["number"], { id: "string" } */
export type Shape = string | Shape[] | { [field: string]: Shape };
export type HttpCall = { method: string; path: string; status: number; shape: Shape | null };

const METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "fetch"]);
const MAX_CALLS = 30;
const MAX_DEPTH = 6;
const MAX_KEYS = 100;
const MAX_ITEMS = 20;

export const test = base.extend({
  request: async ({ request }, use, testInfo) => {
    const calls: HttpCall[] = [];
    const recorded = new Proxy(request, {
      get(target, prop) {
        const value = Reflect.get(target, prop);
        if (typeof value !== "function") return value;
        if (typeof prop !== "string" || !METHODS.has(prop)) return value.bind(target);
        return async (urlOrRequest: unknown, options?: { method?: string }) => {
          const res: APIResponse = await value.call(target, urlOrRequest, options);
          if (calls.length < MAX_CALLS) {
            calls.push(await describe(methodOf(prop, urlOrRequest, options), res));
          }
          return res;
        };
      },
    });
    await use(recorded);
    if (calls.length > 0) {
      await testInfo.attach("redline-http", { body: JSON.stringify(calls), contentType: "application/json" });
    }
  },
});

export { expect };

function methodOf(prop: string, urlOrRequest: unknown, options?: { method?: string }): string {
  if (prop !== "fetch") return prop.toUpperCase();
  if (options?.method) return options.method.toUpperCase();
  const req = urlOrRequest as { method?: () => string };
  return typeof req?.method === "function" ? req.method().toUpperCase() : "GET";
}

async function describe(method: string, res: APIResponse): Promise<HttpCall> {
  let shape: Shape | null = null;
  if ((res.headers()["content-type"] ?? "").includes("json")) {
    try {
      shape = shapeOf(await res.json(), 0);
    } catch {
      shape = null; // body bukan JSON valid
    }
  }
  return { method, path: normalizePath(new URL(res.url()).pathname), status: res.status(), shape };
}

/** /brands/01JC2X... -> /brands/:id */
export function normalizePath(path: string): string {
  return path
    .split("/")
    .map((seg) =>
      /^\d+$/.test(seg) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) ||
      /^[0-9A-HJKMNP-TV-Z]{26}$/.test(seg) ||
      /^[0-9a-f]{16,}$/i.test(seg) ||
      seg.includes("@")
        ? ":id"
        : seg,
    )
    .join("/");
}

export function shapeOf(value: unknown, depth: number): Shape {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    if (depth >= MAX_DEPTH) return ["..."];
    let merged: Shape | undefined;
    for (const item of value.slice(0, MAX_ITEMS)) {
      const s = shapeOf(item, depth + 1);
      merged = merged === undefined ? s : mergeShapes(merged, s);
    }
    return [merged as Shape];
  }
  if (typeof value === "object") {
    if (depth >= MAX_DEPTH) return "object";
    const out: { [field: string]: Shape } = {};
    for (const key of Object.keys(value as object).slice(0, MAX_KEYS)) {
      out[key] = shapeOf((value as Record<string, unknown>)[key], depth + 1);
    }
    return out;
  }
  return typeof value; // string, number, boolean
}

function kind(s: Shape): string {
  return typeof s === "string" ? s : Array.isArray(s) ? "array" : "object";
}

/** Gabung bentuk elemen array; tipe berbeda jadi "a|b". */
export function mergeShapes(a: Shape, b: Shape): Shape {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length === 0) return b;
    if (b.length === 0) return a;
    return [mergeShapes(a[0], b[0])];
  }
  const isObj = (s: Shape) => typeof s === "object" && !Array.isArray(s);
  if (isObj(a) && isObj(b)) {
    const ao = a as { [f: string]: Shape };
    const bo = b as { [f: string]: Shape };
    const out: { [f: string]: Shape } = { ...ao };
    for (const [k, v] of Object.entries(bo)) out[k] = k in ao ? mergeShapes(ao[k], v) : v;
    return out;
  }
  const kinds = new Set([...kind(a).split("|"), ...kind(b).split("|")]);
  return [...kinds].sort().join("|");
}
