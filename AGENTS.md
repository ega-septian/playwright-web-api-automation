# AGENTS.md

API test automation for **Toolshop** (Practice Software Testing, sprint 5) with Playwright, TypeScript and Zod. Failures are triaged by **Redline** (`redline-playwright` package). This file is the rulebook for AI assistants working in this repo (Claude Code reads it through `CLAUDE.md`; Cursor, Copilot and other tools read `AGENTS.md` directly): read it before writing or reviewing tests. The roadmap for the AI setup is in `docs/orchestra.md`.

## Context

- **App under test:** Toolshop API at `http://localhost:8091`, running locally with Docker (`~/Developer/practice-software-testing`, `SPRINT=sprint5`). Reset the database with `docker exec pst-laravel-api-1 php artisan migrate:fresh --seed`.
- **Source of truth:** the OpenAPI contract at `http://localhost:8091/docs`. Build schemas and expected status codes from it, not from what the API happens to return.
- **Layout:** `tests/api/toolshop/` holds one spec per feature (`brand.spec.ts`), plus `schemas/` (Zod response schemas), `data/` (factories), `types/` (request payload types), `fixtures/` (auth tokens, merged with the Redline fixture) and `helper/`.
- **Seed accounts** (`admin@` and `customer@practicesoftwaretesting.com`) are public demo data. Locally they come from `.env` (`TOOLSHOP_ADMIN_*`, `TOOLSHOP_CUSTOMER_*`), in CI from `playwright.yml`.

## Commands

```bash
npm run contract -- POST /users/login         # the contract for one endpoint (or: npm run contract -- /users)
npx playwright test --grep @TC-BRD-003        # one test while writing (set REDLINE=0 in .env)
npm run test:allure TC-BRD-001 TC-BRD-005     # run, then open the Allure report (also: a spec name, e.g. brand)
npm run test:ai TC-BRD-003                    # same, with Redline's explanation of failures
npm run format && npm run lint && npx tsc -p . && npm run check:ids   # before every commit
npm run check:weakening                       # tests deleted, fewer expects, changed status, new skip (vs origin/main)
```

## Constitution

Rules marked **(checked)** are enforced for everyone by ESLint and CI, and for Claude Code also by a hook that blocks the write (`.claude/hooks/guard-spec.mts`). The rest are for review.

### MUST

- **Imports (checked):** specs import `test` and `expect` from `./fixtures`.
- **Test case IDs (checked):** every test has exactly one `@TC-<AREA>-<NNN>` tag (e.g. `@TC-BRD-017`), unique and never reused. Don't change a test's ID and its title in the same PR. Don't rename the Playwright project `toolshop`. Redline uses both to keep a test's history.
- **Structure:** one `test.describe` per endpoint (`"POST /brands"`), tags on tests only.
- **Own data:** tests create the data they need with factories from `data/` (Faker, override only what matters). Never depend on seed data ids or on another test.
- **Schemas (checked):** response schemas in `schemas/` use `z.strictObject`, so a field that is not in the contract fails the test. Fields the API returns are required; fields documented but not returned are optional.
- **Assertions in order:** 1. status code, 2. contract (`Schema.parse(await response.json())` with a schema from `schemas/`), 3. the values that matter for the scenario.
- **Writes are verified with a follow-up read** (`GET` after create, update and delete; after a rejected write, check the data did not change).
- **Auth:** ask for the `adminToken` or `customerToken` fixture; use `login(request, credentials)` for a user created in the test. Tests about auth itself (missing token, wrong role) call the API without the fixture token.
- **Contract mismatches:** when the API contradicts the OpenAPI contract, keep the test as the contract says, wrap it in `test.skip` with a `// FIXME:` comment that names the mismatch, and report it. When the contract allows what the API does, fix the test.
- **Verify before done:** run the affected tests and the pre-commit checks above. Never report a task as done with failing or unrun tests.
- **Git:** commit only as `ega-septian <septianega18@gmail.com>`, with no AI co-author or attribution in commits, tags or PR bodies. Open PRs against `main`; the user merges. Commit or open a PR only when asked.

### SHOULD

- Wrap each API call in `test.step` when a test makes more than one call.
- Cover negative cases per field (each required field missing, wrong type, boundary length), not only an empty body.
- Name tests after the behaviour: `"<Action> <resource> fails when <condition>"`, and make the title match what the test sends.
- Comments in code are short and in Indonesian, like the existing code.

### WON'T

- No `waitForTimeout` or other fixed waits **(checked)**.
- No hardcoded ids such as `/brands/1` **(checked)**.
- No negative login tests with the seed accounts: three failed logins lock a customer account (423) and break every test that uses `customerToken` (admins are never locked, so lockout tests also need a customer). Register a fresh user instead.
- No changing an expected status code or schema just to make a test pass against behaviour the contract does not allow.
- No `test.only` **(checked)**, no tags on `describe`, no `any`.
- No secrets in code, logs or commits. `.env` is never committed; print variable names only, never values.
- No imports from `@playwright/test` or `redline-playwright/fixture` in spec files **(checked)**.

## Working with AI

For any non-trivial task, start with the `workflow` skill: classify, explore, plan with a confidence score, wait for approval, apply, verify with the tests and Redline, report. In short:

1. **One task per prompt** (one endpoint, one spec, one schema).
2. **Plan first, with Confidence (1-10), Rationale and Unknowns.** Below 5, ask instead of planning.
3. **Change files only after the user approves the plan.**
4. **Verify:** run the tests you touched and the pre-commit checks. Triage failures with Redline (`REDLINE_AI=1 npx playwright test --grep ...`; the user runs `npm run test:ai`) and act on its category.
5. **Report**, then commit only when asked.

The user is preparing for a QA automation interview and writes the first tests of a new area themselves. For those, review and explain; don't write them unless asked.

## Skills index

Skills are in `.claude/skills/<name>/SKILL.md`. Claude Code loads them when a task matches; other tools can read the files.

| Skill           | Purpose                                                          | Status |
| --------------- | ---------------------------------------------------------------- | ------ |
| `api-testing`   | Contract-first test cases, status-code matrix, negative coverage | Ready  |
| `fixtures`      | Auth and data fixtures, when to add one                          | Ready  |
| `data-strategy` | Factories, invalid-value sets                                    | Ready  |
| `workflow`      | Plan, confidence, approval, verify with Redline, report          | Ready  |
| `pr-reviewer`   | Review a branch against this Constitution                        | Ready  |
