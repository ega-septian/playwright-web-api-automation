---
name: api-testing
description: Plan, write or review Playwright API tests for a Toolshop endpoint or area in this repo — contract first from the OpenAPI, a test-case matrix covering every status code, Zod strict schemas, negative cases per field, and handling contract mismatches. Use for "add tests for /users/login", "what should we test for categories", "review this spec", or when a test fails because the API and the test disagree.
---

# API testing

The rules are in `AGENTS.md` (Constitution). This skill is the order of work. The best examples in the code are in `tests/api/toolshop/brand.spec.ts`:

- TC-BRD-017: a rejected write leaves the data unchanged.
- TC-BRD-018: a validation error on the brand the test created itself.
- TC-BRD-019 and TC-BRD-020: auth tests with no token and with the wrong role.

## 1. Read the contract

```bash
npm run contract -- /users                  # endpoints in an area, and which need auth
npm run contract -- POST /users/register    # request body, auth, every response with its shape
```

The contract, not what the API happens to return, is the source of truth. Read it before you call the API, and call the API (or read the source code) only for what the contract doesn't say.

Toolshop's contract has these quirks:

- **No field is marked `required`.** For a request, find out what is required from a 422 response. For a response schema, make the fields the API returns in that scenario required, and the fields that are documented but not returned optional. `UserResponseSchema` in `schemas/user.schema.ts` is an example.
- **Some status codes are missing from the contract.** For example, `POST /users/login` documents only 200, but the code also returns 401, 403 and 423. Observed behaviour is a stopgap, not the spec: test the real codes, say in a comment that they pin current behaviour, and report the missing documentation. If one of those tests fails, Redline reports an undocumented status as a contract violation.
- When the contract and `~/Developer/practice-software-testing/sprint5/API` disagree, the source code shows what really happens, and the contract is what should happen.

## 2. Test-case matrix (before any code)

Write a table and show it to the user before writing tests:

| ID         | Scenario                          | Request           | Expected           | Oracle            |
| ---------- | --------------------------------- | ----------------- | ------------------ | ----------------- |
| TC-USR-002 | Login succeeds with a new user    | POST /users/login | 200 + token schema | contract          |
| TC-USR-005 | Login fails when email is missing | POST /users/login | 401                | current behaviour |

The **oracle** is what says the expected result is right:

- `contract`: the OpenAPI contract;
- `requirement`: the user, a ticket or the app's documentation;
- `current behaviour`: only the source code or a call to the API. Such a test pins what the API does today, so it can't find a bug in that behaviour.

For every `current behaviour` row, ask whether a tester would expect something else (for example 401 where a missing field usually gives 422). If so, don't quietly make it the expectation: list it under **QA questions** with the plan, and let the user decide. Accepted: keep the test with a comment that says why. A bug: write the test as it should be, with `test.skip` and `FIXME` (§5).

The rows to cover:

1. **Happy path.** It is verified with a follow-up read when it writes.
2. **Every documented status code.** If one cannot be triggered (for example 405), say why in the table instead of dropping it.
3. **Each required field missing**, one test per field. **Each field with a wrong type** (number for a string, and so on). **Boundary lengths** (max and max + 1).
4. **Auth.** No token gives 401. The wrong role gives 403, using the `customerToken` fixture on an admin endpoint.
5. **Not found.** Use an id that existed: create the record, delete it, then call the endpoint. Never use a made-up or hardcoded id.
6. **Conflicts** (409), and that the rejected write changed nothing.

For IDs, use the next free `@TC-<AREA>-<NNN>`. Check the IDs in use with `npx playwright test --list | grep -o "@TC-[A-Z]*-[0-9]*" | sort`. One area per resource: BRD for brands, USR for users, CAT for categories, PRD for products.

In a new area, the user writes the first tests themselves (see `AGENTS.md`). For those, stop after the matrix and review what they write.

## 3. Schemas

- Put them in `tests/api/toolshop/schemas/<resource>.schema.ts`, as `z.strictObject` (checked by ESLint and the hook). Names: `<Resource>ResponseSchema`, plus error schemas for 401/404/409/422 bodies.
- Reuse a schema when the body really has the same shape; add a new one when the meaning differs.
- When `strictObject` rejects a field, compare it with the contract first:
  - documented → add it to the schema;
  - not documented → that is a finding to report. Don't loosen the schema.

## 4. Write the tests

- One `test.describe` per endpoint, named `"POST /users/login"`. One `test.step` per API call when there is more than one.
- The order inside each step: `expect(response.status())`, then `Schema.parse(await response.json())`, then the values that matter.
- Data comes from factories (`data-strategy` skill) and tokens from fixtures (`fixtures` skill).
- Name the test after what it sends: "fails when name is missing" means the field is omitted, "is empty" means `""`.

## 5. When the test and the API disagree

1. Read the contract for that endpoint and status.
2. **The contract allows what the API did:** the test is wrong. Fix the test, and say which part of the contract allows it. Example: TC-BRD-016, where `BrandRequest` has no required fields, so a PUT without a name returns 200.
3. **The contract does not allow it:** the API is wrong. Keep the test as the contract says, add `test.skip` with `// FIXME: <what the API does vs the contract>`, and report it. Never change the expected status or the schema to match.
4. **Not sure:** run the test with `REDLINE_AI=1` and read Redline's verdict and evidence in `test-results/redline-report.md`. If it is still unclear, ask the user.

## 6. Verify and report

```bash
REDLINE=0 npx playwright test --grep "(@TC-USR-004|@TC-USR-005)\b"   # the new tests, 3 times if they create data
npm run format && npm run lint && npx tsc -p . && npm run check:ids
```

Report the matrix with a result per row: pass, skipped with FIXME, or not testable and why. Report contract findings (including missing documentation) and open QA questions separately.

## Pitfalls

- **Three failed logins lock a customer account** (423); admins are never locked or counted. Never use the seed accounts for negative login tests: register a fresh customer, also for lockout tests.
- **JWT tokens live 5 minutes.** Don't store tokens in files.
- **Ids are ULID strings** (`01m51z…`), not numbers.
- **Login errors are `{ "error": "<reason>" }`** (`LoginErrorSchema`), not `{ message }`: 401 `Unauthorized` (wrong password, unknown email, a non-string field) or `Invalid login request` (email or password missing or empty), 403 `Account disabled`, 423 after three wrong passwords. A successful login resets the count.
- **Admin `GET /users/{userId}` also returns `role`**, which the contract doesn't list, so `UserResponseSchema` rejects it. Don't add `role` to the schema to make a test pass; report it (`api-testing` §5).
- **`/brands/search` uses MySQL full-text in BOOLEAN MODE**, and caches each query for an hour.
  - `-` means "exclude this word", so a hyphenated UUID can hide the brand it names. Search with a unique word without `-`.
  - Any one word matches, so assert `toContainEqual`, never an exact list.
  - Create the data before the first search with that query; a query searched earlier keeps its old result.
- **Creating a product flushes Toolshop's whole cache.** Several product creates running in parallel can return 500. Keep product-creating setup to one test (`helper/product.helper.ts`), or run those tests serially.
- **`GET /brands` is cached and the cache can go stale under parallel tests.** A read that misses the cache can store a list read before another test's insert, so a brand just created is missing. `brand.spec.ts` runs in one worker (`test.describe.configure({ mode: "default" })`); keep it that way, and use the same for any new spec that asserts a new item appears in a cached list.
- **The local database keeps test data between runs.** Make unique values (email, slug) with Faker, and don't assert on list lengths.
