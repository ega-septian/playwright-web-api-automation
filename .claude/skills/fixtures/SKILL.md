---
name: fixtures
description: Use, add or change Playwright fixtures in this repo — the admin and customer auth tokens, login() for other users, adding a user role, or a new fixture file merged with the Redline fixture. Use when a test needs a login or shared setup, or when the same setup code repeats across tests.
---

# Fixtures

## What exists

- `tests/api/toolshop/fixtures/index.ts` merges every fixture with `mergeTests(redlineTest, authTest, targetTest).extend(cleanup)`. Specs import `test` and `expect` from `./fixtures`, and only from there.
- `tests/api/toolshop/fixtures/auth.fixture.ts` provides:
  - `adminToken` (the seed admin from `.env`) and `customerToken` (a customer registered for the worker): worker-scoped, so each worker logs in once and the token is reused;
  - `tokenFor(envPrefix)`: builds a token fixture from `<PREFIX>_EMAIL` and `<PREFIX>_PASSWORD`;
  - `login(api, credentials)`: `POST /users/login`, checks for 200, validates the token schema and returns `access_token`;
  - `credentials(envPrefix)`: reads the env pair and fails with a clear message when it is missing.
- `fixtures/target.fixture.ts`: `toolshopTarget` (`"live"` or `"local"`), set by `playwright.config.ts` from `TOOLSHOP_TARGET`.
- `fixtures/cleanup.fixture.ts`: wraps `request` and deletes, with the admin token, every brand (`POST /brands`) and user (`POST /users/register`) a test created. To clean up another collection, add its create path and delete path to `CLEANED_UP`. Users registered by the `customerToken` fixture are not cleaned up yet.

## Using them

```ts
test("Delete brand id", { tag: "@TC-BRD-005" }, async ({ request, adminToken }) => {
  await request.delete(`/brands/${id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
});
```

- **Only ask for the fixture you need.** A fixture runs only when a test asks for it, so tests without a token don't log in.
- **A user created in the test:** `const token = await login(request, { email, password })`. Import it with `import { login } from "./fixtures/auth.fixture"`.
- **Auth tests** (no token, wrong role, wrong password) call the API directly, so the failure is visible in the test.

## Adding a user role

1. Add `customer2Token: string;` to `AuthFixtures`, and `customer2Token: tokenFor("TOOLSHOP_CUSTOMER2"),` to `extend`.
2. Add `TOOLSHOP_CUSTOMER2_EMAIL` and `TOOLSHOP_CUSTOMER2_PASSWORD`:
   - in `.env`; ask the user, because you can't edit it;
   - in the env of the test step in `.github/workflows/playwright.yml`;
   - in the README list.

## Adding a fixture file

Add one when the same setup or teardown repeats in 3 or more tests, or in more than one spec. For setup used once, keep it in the test.

1. Create `fixtures/<topic>.fixture.ts`, with `base` from `@playwright/test`. Fixture files may import from there; spec files may not.
2. Choose the scope:
   - **test scope** (the default) for data that one test owns, such as a fresh brand;
   - **worker scope** (`{ scope: "worker" }`) only for read-only things that are expensive to make, such as tokens.

   A worker fixture can't use `request`, because `request` belongs to one test. Create a context with `playwright.request.newContext({ baseURL: workerInfo.project.use.baseURL })` and dispose it afterwards.

3. Clean up after `await use(value)` if the fixture creates something that would get in other tests' way.
4. Add the new file to `mergeTests` in `fixtures/index.ts`. Specs don't change.

## Don't

- Don't save tokens to a file: they expire after 5 minutes. A worker that runs longer than that against live would need a fresh login.
- Don't use the seed accounts for negative login tests. Three failed logins lock a customer account (admins are exempt), for everyone on live. Register a fresh user instead.
- Don't build a fixture for one test.
