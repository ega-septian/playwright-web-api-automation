---
name: data-strategy
description: Create or change test data in this repo — Faker factories with overrides, request payload types, missing-field and wrong-type payloads for negative tests, boundary values, and unique values such as emails and slugs. Use when a test needs request data or when adding a factory for a new resource.
---

# Data strategy

## Factories

- **One file per resource:** `tests/api/toolshop/data/<resource>.data.ts`. Examples: `brand.data.ts` and `user.data.ts`.
- **One function per request:** `create<Resource>Payload(overrides = {})` returns a valid payload. Use Faker for every field, then `...overrides` last.
- **Unique fields come from Faker** (`faker.internet.email()`, `faker.lorem.slug()`), because the local database keeps data between runs.
- **Payload types go in `types/<resource>.types.ts`**, following the request body in the contract (`npm run contract -- POST /<path>`).
- In a test, **override only what the scenario is about**:

  ```ts
  createBrandPayload({ name: "a".repeat(121) });
  ```

## Negative data

| Case          | How                                                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Field missing | `const { name, ...payload } = createBrandPayload();` and send `payload`. ESLint allows the unused `name`.                                                                           |
| Field empty   | `createBrandPayload({ name: "" })`. This is a different test from "missing": name it so.                                                                                            |
| Wrong type    | Override with a value of another type: `{ name: 123 }`, `{ name: true }`, `{ name: null }`, `{ name: [] }`. Cast the payload (`as unknown as CreateBrandRequest`), not the factory. |
| Boundary      | Inline in the test: `"a".repeat(120)` passes, `"a".repeat(121)` fails.                                                                                                              |
| Empty body    | `data: {}`.                                                                                                                                                                         |

When two or more specs need the same invalid values, move them to `data/invalid-values.ts` (create it then, not before) as `as const` arrays, and loop over them:

```ts
for (const value of INVALID_STRINGS) {
  test(`Create brand fails when name is ${JSON.stringify(value)}`, { tag: ... }, ...);
}
```

A loop needs one `@TC-` ID per generated test. Keep the list fixed and give each value its own ID, or write separate tests.

## Users

- **Every test that needs a user registers a fresh one** with `createUserPayload()`. It has a unique email and a password that meets the policy.
- **The password policy** (`StoreCustomer`):
  - at least 8 characters, with mixed case, a number and a symbol;
  - **not in public breach lists**. Laravel's `uncompromised()` asks the Have I Been Pwned API, so registration needs internet. A weak or well-known password gives 422.
- **Seed accounts are only reached through the auth fixtures** (`fixtures` skill), never for negative logins.

## Don't

- Don't depend on seed data ids or counts.
- Don't use JSON data files: they have no types and no comments.
- Don't make random values in assertions. Keep the value you sent and compare against it.
