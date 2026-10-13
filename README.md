# Playwright API Automation

API test automation with **Playwright**, **TypeScript**, and **Zod** for
[Practice Software Testing](https://testsmith-io.github.io/practice-software-testing/) ("Toolshop"):
an e-commerce API that grows sprint by sprint, run locally with Docker. Tests follow the sprints,
starting with Sprint 1 (brands, categories, products, images).

Failed tests are triaged by [Redline](https://github.com/ega-septian/redline), a failure-analysis server I built alongside this suite: it groups failures by cause, explains them with rules and AI, and can prove a cause by rerunning the test with a patch. See [Failure triage with Redline](#failure-triage-with-redline).

## Tech Stack

| Tool                                      | Purpose                                                   |
| ----------------------------------------- | --------------------------------------------------------- |
| [Playwright Test](https://playwright.dev) | Test runner and HTTP client (`request` fixture)           |
| TypeScript                                | Type safety for payloads and test code                    |
| [Zod](https://zod.dev)                    | Runtime validation of response schemas (contract testing) |
| [Faker](https://fakerjs.dev)              | Unique test data (names, slugs)                           |
| dotenv                                    | Loads local settings from `.env` (optional)               |
| ESLint + Prettier                         | Linting (incl. `eslint-plugin-playwright`) and formatting |
| GitHub Actions                            | Runs the suite on every push and pull request             |

## Project Structure

```
tests/api/toolshop/
├── schemas/brand.schema.ts          # Zod schemas: the expected shape of each response
├── types/brand.types.ts             # TypeScript types for request payloads
├── data/brand.data.ts               # Test data factories with default values + overrides
├── helper/                          # Small helpers shared by specs
├── brand.spec.ts
└── register.user.spec.ts            # skipped until the sprint that adds users
fixtures/redline.ts                  # request fixture: records response shapes and a curl per request
reporters/redline.ts                 # sends results to Redline and prints the triage summary
scripts/redline.mts                  # Redline CLI: verify, learn, rules, score
scripts/redline-bench.mts            # benchmark with planted bugs
redline-bench/                       # benchmark specs and bug catalogue
```

`playwright.config.ts` has one project, `toolshop`, with its `testDir` and `baseURL`. Each Toolshop
feature (brands, categories, products, …) gets its own spec, schema, type and data files.

## Getting Started

### Prerequisites

- Node.js 22.6 or newer (the scripts in `scripts/` are TypeScript run directly by Node)
- [Practice Software Testing](https://github.com/testsmith-io/practice-software-testing) running locally with Docker, API at `http://localhost:8091`
- Optional: a [Redline](https://github.com/ega-septian/redline) server at `http://localhost:8787`. Without it, tests run normally and the reporter prints a warning.

### Install

```bash
npm install
```

The tests only call the API, so no browser needs to be installed. A `.env` file in the project
root is optional (for example `REDLINE_URL`); it is listed in `.gitignore` and must never be committed.

### Run

```bash
npm run test:api                               # all Toolshop tests
npx playwright test tests/api/toolshop/brand.spec.ts
npx playwright test --grep @TC-BRD-003         # one test case by its ID
npx playwright show-report                     # open the HTML report
```

### Lint and format

```bash
npm run lint           # ESLint, incl. Playwright rules such as missing await on expect/test.step
npm run format         # Prettier, rewrites files
npm run format:check   # Prettier, check only
```

## Test Approach

Every test validates the response in three layers:

1. **Status code**: e.g. `200`, `201`, `404`, `422`
2. **Contract**: the body is parsed with a Zod schema, so a missing field, a wrong type, or an unexpected enum value fails the test with a clear message
3. **Data**: the values match what was sent (`toMatchObject`) or what was searched for (`toContainEqual`)

Other conventions:

- **Tests create their own data.** Preconditions (e.g. creating a brand before reading, updating or deleting it) run inside the test, so tests do not depend on existing data or on each other.
- **Writes are verified with a follow-up read.** After creating or updating a brand, the test fetches it by ID to confirm it was actually saved, not just echoed back.
- **Data-driven tests.** Scenarios that differ only by input are generated with a `for...of` loop, so each case is reported separately.
- **Test data factories.** `createBrandPayload()` and `updateBrandPayload()` return valid defaults; each test overrides only the fields relevant to its scenario.
- **Test case IDs as tags.** `test("...", { tag: "@TC-BRD-001" }, ...)`. Redline uses the tag as the test case ID in its reports.

## Test Cases

### Toolshop: Brands (`brand.spec.ts`, Sprint 1)

| ID         | Test            | Type     | Expected                                                                |
| ---------- | --------------- | -------- | ----------------------------------------------------------------------- |
| TC-BRD-001 | Get all brands  | Positive | 200, list matches schema                                                |
| TC-BRD-002 | Create brand    | Positive | 201, response matches payload                                           |
| TC-BRD-003 | Get brand by id | Positive | 200, the created brand is returned (id, name, slug)                     |
| TC-BRD-004 | Update brand    | Positive | 200 `success: true`, a follow-up GET returns the new name/slug          |
| TC-BRD-005 | Delete brand    | Positive | Delete succeeds, a follow-up GET returns 404 `Requested item not found` |

## Failure triage with Redline

`reporters/redline.ts` sends every run to a [Redline](https://github.com/ega-septian/redline) server. Failures with the same cause are grouped into one incident and explained in the terminal and in `test-results/redline-report.md`:

```
[redline] run #12 · 8 Okt 2026, 19.36 WIB: 40 lulus, 9 gagal, 0 flaky, 1 skip
  #  INSIDEN                    TEST  STATUS  KATEGORI     PENYEBAB
  1  POST /users/login → 500       8  BARU    BUG BACKEND  API membalas 500 padahal test…
```

The report includes a **curl command for every request of a failed test** (secrets redacted), so a failure can be reproduced outside Playwright.

| Command                                             | What it does                                                                                                                                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REDLINE_AI=1 npx playwright test`                  | Also asks Redline for the cause of each incident (rules first, AI only when needed)                                                                                                                      |
| `npm run redline:verify`                            | Proves the cause: reruns the failed test as-is (flaky?), then lets the AI patch the test in a copy of the project and reruns it. A patch that makes the test pass is saved under `test-results/redline/` |
| `REDLINE_AI=1 REDLINE_VERIFY=1 npx playwright test` | Both in one go: analyse, then prove each new failure right after the run (local only, skipped in CI)                                                                                                     |
| `npm run redline:learn`                             | Turns proven cases into regex rules, backtested against past failures; `npm run redline -- approve <id>` activates one                                                                                   |
| `npm run redline -- score`                          | How often the rule and AI guesses turned out right, compared with proof                                                                                                                                  |
| `npm run redline -- impact schemas/brand.ts`        | Which tests depend on a file (through any chain of imports), with a `--grep` to run only them; also works with an endpoint: `impact GET /brands/1`                                                       |

What the reporter sends: test results, a hash of each test's code, the local files each test imports, the shape of API responses (field names and types, no values), and **the source code of failed tests** so the AI can read it. Secrets in code and messages are redacted by the server.

### Benchmark

`npm run redline:bench` measures how accurate Redline is. Bugs with known answers are planted in a copy of the project (wrong test code, a proxy that breaks Toolshop responses, wrong base URL), and each one is analysed by a separate Redline server with its own Neo4j database (`bench-<scenario>`, emptied on start).

| Scenario                                           | Correct | Wrong guesses |
| -------------------------------------------------- | ------- | ------------- |
| New test, no history (24 bugs)                     | 92%     | 0             |
| Test that passed before (24 bugs)                  | 100%    | 0             |
| App upgrade: outdated test vs regression (6 cases) | 6/6     | 0             |

The remaining cases were answered "unclear" rather than guessed. One run per scenario with Claude Haiku 5.5; AI results can vary slightly between runs. Options: `--scenario=history|cold|upgrade|kag` (`kag`: specs with nested imports and a shared endpoint, the baseline for knowledge-augmented analysis), `--only=T01,B02`, `--memory=off`, `--contract=off`. Server logs are saved to `test-results/redline-bench/server-<scenario>.log`.

## CI

`.github/workflows/ci.yml` runs on every push and pull request to `main`, without starting any server:

| Step           | Command                        | Catches                                        |
| -------------- | ------------------------------ | ---------------------------------------------- |
| Type check     | `npx tsc -p .`                 | Wrong types, typos in field names, bad imports |
| Lint           | `npm run lint`                 | Missing `await`, unused code, leftover `.only` |
| Format         | `npm run format:check`         | Code not formatted with Prettier               |
| All specs load | `npx playwright test --list`   | Specs that fail to load (syntax, imports)      |
| Security audit | `npm audit --audit-level=high` | Vulnerable dependencies (warning only)         |

The Playwright tests themselves are in `.github/workflows/playwright.yml` and run manually for now
(**Actions → Playwright Tests → Run workflow**), because the Toolshop tests need the app at
`localhost:8091`. Next step: start Practice Software Testing with
Docker in the workflow and run the tests on every pull request again.
