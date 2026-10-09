# Playwright API Automation

API test automation with **Playwright**, **TypeScript**, and **Zod**, covering three APIs:

- [GoRest](https://gorest.co.in): user management (CRUD, requires a bearer token)
- [Restful-Booker](https://restful-booker.herokuapp.com/apidoc/index.html): hotel booking
- [Practice Software Testing](https://testsmith-io.github.io/practice-software-testing/) ("Toolshop"): an e-commerce API that grows sprint by sprint, run locally with Docker. Tests follow the sprints, starting with Sprint 1 (brands, categories, products, images).

Failed tests are triaged by [Redline](https://github.com/ega-septian/redline), a failure-analysis server I built alongside this suite: it groups failures by cause, explains them with rules and AI, and can prove a cause by rerunning the test with a patch. See [Failure triage with Redline](#failure-triage-with-redline).

## Tech Stack

| Tool                                      | Purpose                                                   |
| ----------------------------------------- | --------------------------------------------------------- |
| [Playwright Test](https://playwright.dev) | Test runner and HTTP client (`request` fixture)           |
| TypeScript                                | Type safety for payloads and test code                    |
| [Zod](https://zod.dev)                    | Runtime validation of response schemas (contract testing) |
| [Faker](https://fakerjs.dev)              | Unique test data (names, emails)                          |
| dotenv                                    | Loads secrets from `.env`                                 |
| ESLint + Prettier                         | Linting (incl. `eslint-plugin-playwright`) and formatting |
| GitHub Actions                            | Runs the suite on every push and pull request             |

## Project Structure

```
tests/
├── api/
│   ├── gorest/                      # One folder per API, each with the same layout
│   │   ├── schemas/user.schema.ts   # Zod schemas: the expected shape of each response
│   │   ├── types/user.types.ts      # TypeScript types for request payloads
│   │   ├── data/user.data.ts        # Test data factories with default values + overrides
│   │   └── users.spec.ts
│   ├── booker/
│   └── toolshop/                    # Practice Software Testing (local Docker)
│       ├── schemas/  types/  data/  helper/
│       ├── brand.spec.ts
│       └── register.user.spec.ts    # skipped until the sprint that adds users
└── web/                             # UI tests
fixtures/redline.ts                  # request fixture: records response shapes and a curl per request
reporters/redline.ts                 # sends results to Redline and prints the triage summary
scripts/redline.mts                  # Redline CLI: verify, learn, rules, score
scripts/redline-bench.mts            # benchmark with planted bugs
redline-bench/                       # benchmark specs and bug catalogue
```

Each API is a separate Playwright project in `playwright.config.ts` with its own `testDir` and `baseURL`. Adding a new API means adding a folder with the same layout and one project entry.

## Getting Started

### Prerequisites

- Node.js 22.6 or newer (the scripts in `scripts/` are TypeScript run directly by Node)
- A GoRest access token: log in at [gorest.co.in](https://gorest.co.in) and open **API Tokens**
- For the Toolshop tests: [Practice Software Testing](https://github.com/testsmith-io/practice-software-testing) running locally with Docker, API at `http://localhost:8091`
- Optional: a [Redline](https://github.com/ega-septian/redline) server at `http://localhost:8787`. Without it, tests run normally and the reporter prints a warning.

### Install

```bash
npm install
npx playwright install
```

### Configure

Create a `.env` file in the project root:

```
GOREST_TOKEN=your_gorest_token
```

`.env` is listed in `.gitignore` and must never be committed.

### Run

```bash
npm run test:api                         # GoRest and Restful-Booker
npx playwright test --project=gorest     # GoRest only
npx playwright test --project=booker     # Restful-Booker only
npx playwright test --project=toolshop   # Toolshop (needs the local Docker app)
npx playwright test                      # everything, including web tests
npx playwright show-report               # open the HTML report
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

- **Tests create their own data.** Preconditions (e.g. creating a booking before searching for it) run inside the test, so tests do not depend on existing data or on each other.
- **Writes are verified with a follow-up read.** After creating a booking, the test fetches it by ID to confirm it was actually saved, not just echoed back.
- **Data-driven tests.** Scenarios that differ only by input are generated with a `for...of` loop, so each case is reported separately.
- **Test data factories.** `createUserPayload()`, `createBookingPayload()` and `createBrandPayload()` return valid defaults; each test overrides only the fields relevant to its scenario.
- **Test case IDs as tags.** `test("...", { tag: "@TC-BRD-001" }, ...)`. Redline uses the tag as the test case ID in its reports.

## Test Cases

### GoRest: Users (`users.spec.ts`)

| Test                                              | Type     | Expected                                |
| ------------------------------------------------- | -------- | --------------------------------------- |
| GET `/users` returns a valid user list            | Positive | 200, list matches schema                |
| Create a new user                                 | Positive | 201, response matches payload           |
| Create a user with an email that is already taken | Negative | 422, `email` / `has already been taken` |
| Update user name and status to inactive           | Positive | 200, response matches update payload    |
| Update a user that does not exist                 | Negative | 404, `Resource not found`               |

### Restful-Booker: Bookings (`booker.spec.ts`)

| Test                                       | Type     | Expected                                               |
| ------------------------------------------ | -------- | ------------------------------------------------------ |
| Create booking with deposit paid = `true`  | Positive | 200, saved booking matches payload (verified with GET) |
| Create booking with deposit paid = `false` | Positive | 200, saved booking matches payload (verified with GET) |
| Search booking by firstname                | Positive | 200, created booking ID is in the results              |
| Search booking by lastname                 | Positive | 200, created booking ID is in the results              |

### Toolshop: Brands (`brand.spec.ts`, Sprint 1, in progress)

| ID         | Test           | Type     | Expected                      |
| ---------- | -------------- | -------- | ----------------------------- |
| TC-BRD-001 | Get all brands | Positive | 200, list matches schema      |
| TC-BRD-002 | Create brand   | Positive | 201, response matches payload |

## Findings

Observations from exploring Restful-Booker:

- **Missing required field returns `500`.** Creating a booking without `depositpaid` returns `500 Internal Server Error`. A client error such as `400 Bad Request` would be expected.
- **Name search is exact and case-sensitive.** `firstname=ega` does not match `Ega`, and `firstname=Ega` does not match `Ega12345`.
- **No match returns `200` with an empty list**, not `404`.

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

What the reporter sends: test results, a hash of each test's code, the local files each test imports, the shape of API responses (field names and types, no values), and **the source code of failed tests** so the AI can read it. Secrets in code and messages are redacted by the server.

### Benchmark

`npm run redline:bench` measures how accurate Redline is. Bugs with known answers are planted in a copy of the project (wrong test code, a proxy that breaks Toolshop responses, wrong base URL), and each one is analysed by a separate Redline server with its own database schema.

| Scenario                                           | Correct | Wrong guesses |
| -------------------------------------------------- | ------- | ------------- |
| New test, no history (24 bugs)                     | 92%     | 0             |
| Test that passed before (24 bugs)                  | 96%     | 0             |
| App upgrade: outdated test vs regression (6 cases) | 6/6     | 0             |

The remaining cases were answered "unclear" rather than guessed. One run per scenario with Claude Haiku 5.5; AI results can vary slightly between runs. Options: `--scenario=history|cold|upgrade`, `--only=T01,B02`, `--memory=off`, `--contract=off`.

## CI

`.github/workflows/playwright.yml` runs the full suite on every push and pull request to `main`. The GoRest token is read from the repository secret `GOREST_TOKEN` (**Settings → Secrets and variables → Actions**).

The Toolshop tests need the app running at `localhost:8091`, which the workflow does not start yet, so they fail in CI. Starting Practice Software Testing with Docker in the workflow, or skipping the `toolshop` project there, is still to do.
