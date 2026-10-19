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

Toolshop's contract has these quirks:

- **No field is marked `required`.** For a request, find out what is required from a 422 response. For a response schema, make the fields the API returns in that scenario required, and the fields that are documented but not returned optional. `RegisterUserResponse` in `schemas/user.schema.ts` is an example.
- **Some status codes are missing from the contract.** For example, `POST /users/login` documents only 200, but the code also returns 401 for a wrong password and 423 for a locked account. Test the real codes, and add a comment such as `// 401 is not in the contract`. If one of those tests fails, Redline reports an undocumented status as a contract violation.
- When the contract and `~/Developer/practice-software-testing/sprint5/API` disagree, the source code shows what really happens, and the contract is what should happen.

## 2. Test-case matrix (before any code)

Write a table and show it to the user before writing tests:

| ID         | Scenario                       | Request           | Expected           | Source       |
| ---------- | ------------------------------ | ----------------- | ------------------ | ------------ |
| TC-USR-004 | Login succeeds with a new user | POST /users/login | 200 + token schema | contract 200 |

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
4. **Not sure:** run `npm run test:ai <TC-ID>` and read Redline's verdict and evidence. If it is still unclear, ask the user.

## 6. Verify and report

```bash
REDLINE=0 npx playwright test --grep "(@TC-USR-004|@TC-USR-005)\b"   # the new tests, 3 times if they create data
npm run format && npm run lint && npx tsc -p . && npm run check:ids
```

Report the matrix with a result per row: pass, skipped with FIXME, or not testable and why. Report any contract findings separately.

## Pitfalls

- **Three failed logins lock a customer account** (423); admins are never locked or counted. Never use the seed accounts for negative login tests: register a fresh customer, also for lockout tests.
- **JWT tokens live 5 minutes.** Don't store tokens in files.
- **Ids are ULID strings** (`01m51z…`), not numbers.
- **The local database keeps test data between runs.** Make unique values (email, slug) with Faker, and don't assert on list lengths.
