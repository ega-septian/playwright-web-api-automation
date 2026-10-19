/**
 * Baca kontrak OpenAPI Toolshop per endpoint, sebagai titik awal menulis test (skill api-testing).
 *
 *   npm run contract -- /users                    daftar endpoint yang path-nya mengandung /users
 *   npm run contract -- POST /users/register      request body, auth, dan semua response (status + bentuk)
 *
 * Kontrak diambil dari TOOLSHOP_OPENAPI_URL (default http://localhost:8091/docs). $ref di-resolve dan bentuknya
 * ditulis ringkas: { field: type }, "?" = boleh tidak ada, "|null" = boleh null.
 */
type Schema = {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  additionalProperties?: Schema | boolean;
  enum?: unknown[];
  format?: string;
  description?: string;
};
type Operation = {
  summary?: string;
  security?: unknown[];
  parameters?: { name: string; in: string; required?: boolean; schema?: Schema }[];
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  responses?: Record<
    string,
    { $ref?: string; description?: string; content?: Record<string, { schema?: Schema }> }
  >;
};

const url = process.env.TOOLSHOP_OPENAPI_URL ?? "http://localhost:8091/docs";
const doc = await fetch(url)
  .then((r) => r.json())
  .catch((e) => {
    console.error(`Kontrak tidak bisa diambil dari ${url}: ${e.message}. Toolshop sudah jalan?`);
    process.exit(1);
  });
const paths: Record<string, Record<string, Operation>> = doc.paths;
const METHODS = ["get", "post", "put", "patch", "delete"];

function resolve<T>(node: T & { $ref?: string }): T {
  let n: T & { $ref?: string } = node;
  for (let i = 0; n?.$ref && i < 10; i++) {
    n = n.$ref
      .replace(/^#\//, "")
      .split("/")
      .reduce((o: Record<string, unknown>, k) => o?.[k] as Record<string, unknown>, doc) as T & {
      $ref?: string;
    };
  }
  return n;
}

function shape(schema: Schema | undefined, indent = "", depth = 0): string {
  if (!schema) return "(tanpa schema)";
  const s = resolve(schema);
  if (depth > 4) return "…";
  const alt = s.oneOf ?? s.anyOf;
  if (alt) return alt.map((a) => shape(a, indent, depth + 1)).join(`\n${indent}| `);
  if (s.allOf) return s.allOf.map((a) => shape(a, indent, depth + 1)).join(" & ");
  const types = ([] as string[]).concat(s.type ?? (s.properties ? "object" : "any"));
  const nullable = types.includes("null") ? "|null" : "";
  const main = types.find((t) => t !== "null") ?? "null";
  if (main === "array") return `${shape(s.items, indent, depth + 1)}[]${nullable}`;
  if (main === "object" && s.properties) {
    const inner = indent + "  ";
    const fields = Object.entries(s.properties).map(([k, v]) => {
      const opt = s.required?.includes(k) ? "" : "?";
      return `${inner}${k}${opt}: ${shape(v, inner, depth + 1)}`;
    });
    return `{\n${fields.join("\n")}\n${indent}}${nullable}`;
  }
  if (main === "object" && typeof s.additionalProperties === "object") {
    return `{ [field]: ${shape(s.additionalProperties, indent, depth + 1)} }${nullable}`;
  }
  const extra = s.enum ? ` (${s.enum.join(" | ")})` : s.format ? ` (${s.format})` : "";
  return `${main}${extra}${nullable}`;
}

const [first, second] = process.argv.slice(2);
if (!first) {
  console.error("Pakai: npm run contract -- <path>   atau   npm run contract -- <METHOD> <path>");
  process.exit(1);
}

if (!second) {
  for (const [p, ops] of Object.entries(paths)) {
    if (!p.includes(first)) continue;
    for (const m of METHODS) {
      const op = ops[m];
      if (op)
        console.log(
          `${m.toUpperCase().padEnd(7)}${p.padEnd(34)}${op.security ? "auth " : "     "}${op.summary ?? ""}`,
        );
    }
  }
  process.exit(0);
}

const op = paths[second]?.[first.toLowerCase()];
if (!op) {
  console.error(
    `${first.toUpperCase()} ${second} tidak ada di kontrak. Lihat daftarnya: npm run contract -- ${second}`,
  );
  process.exit(1);
}

console.log(`${first.toUpperCase()} ${second}  ${op.summary ?? ""}`);
console.log(`Auth: ${op.security ? "Bearer token (JWT)" : "tidak perlu"}`);
for (const p of op.parameters ?? []) {
  const param = resolve(p);
  console.log(
    `Param (${param.in}): ${param.name}${param.required ? "" : "?"}: ${shape(param.schema)}`,
  );
}
const body = op.requestBody?.content?.["application/json"]?.schema;
if (body) console.log(`\nRequest body: ${shape(body)}`);
console.log("\nResponses:");
for (const [status, raw] of Object.entries(op.responses ?? {})) {
  const r = resolve(raw);
  const schema = r.content?.["application/json"]?.schema;
  console.log(`  ${status}  ${r.description ?? ""}`);
  if (schema) console.log(`       ${shape(schema, "       ")}`);
}
