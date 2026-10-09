# Playwright API Automation

API test automation with **Playwright**, **TypeScript**, and **Zod**, covering two public APIs:

- [GoRest](https://gorest.co.in): user management (CRUD, requires a bearer token)
- [Restful-Booker](https://restful-booker.herokuapp.com/apidoc/index.html): hotel booking

## Tech Stack

| Tool                                      | Purpose                                                   |
| ----------------------------------------- | --------------------------------------------------------- |
| [Playwright Test](https://playwright.dev) | Test runner and HTTP client (`request` fixture)           |
| TypeScript                                | Type safety for payloads and test code                    |
| [Zod](https://zod.dev)                    | Runtime validation of response schemas (contract testing) |
| [Faker](https://fakerjs.dev)              | Unique test data (names, emails)                          |
| dotenv                                    | Loads secrets from `.env`                                 |
| GitHub Actions                            | Runs the suite on every push and pull request             |

## Project Structure

```
tests/
├── api/
│   ├── gorest/                   # One folder per API, each with the same layout
│   │   ├── schemas/user.schema.ts   # Zod schemas: the expected shape of each response
│   │   ├── types/user.types.ts      # TypeScript types for request payloads
│   │   ├── data/user.data.ts        # Test data factories with default values + overrides
│   │   └── users.spec.ts
│   └── booker/
│       ├── schemas/booker.schema.ts
│       ├── types/booker.types.ts
│       ├── data/booker.data.ts
│       └── booker.spec.ts
└── web/                          # UI tests
```

Each API is a separate Playwright project in `playwright.config.ts` with its own `testDir` and `baseURL`. Adding a new API means adding a folder with the same layout and one project entry.

## Getting Started

### Prerequisites

- Node.js 18 or newer
- A GoRest access token: log in at [gorest.co.in](https://gorest.co.in) and open **API Tokens**

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
npm run test:api                       # all API tests
npx playwright test --project=gorest   # GoRest only
npx playwright test --project=booker   # Restful-Booker only
npx playwright test                    # everything, including web tests
npx playwright show-report             # open the HTML report
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
- **Test data factories.** `createUserPayload()` and `createBookingPayload()` return valid defaults; each test overrides only the fields relevant to its scenario.

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

## Findings

Observations from exploring Restful-Booker:

- **Missing required field returns `500`.** Creating a booking without `depositpaid` returns `500 Internal Server Error`. A client error such as `400 Bad Request` would be expected.
- **Name search is exact and case-sensitive.** `firstname=ega` does not match `Ega`, and `firstname=Ega` does not match `Ega12345`.
- **No match returns `200` with an empty list**, not `404`.

## CI

`.github/workflows/playwright.yml` runs the full suite on every push and pull request to `main`. The GoRest token is read from the repository secret `GOREST_TOKEN` (**Settings → Secrets and variables → Actions**).
