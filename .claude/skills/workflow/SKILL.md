---
name: workflow
description: Entry point for any non-trivial task in this repo — adding or changing tests, fixing a failing test, refactoring test code, adding a fixture, schema or script. Classifies the task, picks the skills, plans with a confidence score, waits for the user's approval, applies the change, verifies it with the tests and Redline, and reports. Load it first, before the specialised skills.
---

# Workflow

The rules are in `AGENTS.md`. This skill is the order of work, and it ends in a report the user can trust.

## Direct mode

Skip the phases for a small, clear change: fixing a typo, renaming a variable, running tests, answering a question. Still run the affected tests if you changed code.

## 1. Classify

| Task                                       | Examples                               | Skills                                     |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------ |
| **New area** (a resource with no spec yet) | "tests for /users/login"               | `api-testing`, `data-strategy`, `fixtures` |
| **More tests in an existing area**         | "add a test for PUT with its own slug" | `api-testing`, `data-strategy`             |
| **A failing test**                         | "TC-BRD-013 fails"                     | `api-testing` (§5), Redline (below)        |
| **Refactor** (no behaviour change)         | "move the login helper"                | the skill that owns the files              |
| **Fixture, schema or tooling**             | "add a customer2 role"                 | `fixtures`, `api-testing` (§3), or none    |

**In a new area, the user writes the first tests.** Stop after the plan (phase 4) and offer to review. Write tests there only when the user asks you to.

## 2. Explore

Read before you plan, and read only what the task needs:

- the contract: `npm run contract -- <METHOD> <path>`;
- the spec, schema, factory and fixture files the task touches;
- for a failure, the Redline report (below);
- the Toolshop source in `~/Developer/practice-software-testing/sprint5/API` when the contract is silent.

## 3. Plan with confidence

Show the user this block before changing anything:

```
## Plan
- Task: <one line>
- Test cases: <matrix from api-testing §2, or "none">
- Files: <files to add or change>
- Verify: <exact commands>

Confidence: <1-10>
Rationale: <why this score>
Unknowns: <what you could not confirm, or "none">
```

What the score means:

- **8–10:** the contract and the code agree, and the pattern exists in the repo.
- **5–7:** the plan rests on an assumption. Name it in Unknowns, and say how verify will check it.
- **Below 5:** don't plan. Ask the user the one or two questions that would raise it. Examples: the contract and the code disagree on a status, the expected behaviour is unclear, or the task could mean two different things.

## 4. Wait for approval

Don't edit files until the user says yes, unless they already asked you to go ahead without a plan. When they change the plan, show the new plan again if the change is not obvious.

Always stop and ask, even mid-task, before you:

- change the expected status code or schema of an existing test;
- delete or skip a test;
- touch `.env`, the CI workflow or `package.json` dependencies;
- run `npm run test:verify` (it calls the AI and costs money);
- commit, push or open a PR.

## 5. Apply

- Make one change at a time, following the skills you picked.
- **When the hook rejects a write, read its message, fix the code and write again.** Don't work around it. The message names the rule in `AGENTS.md`.
- Keep the change to what the plan says. Note anything else you find for the report; don't fix it.

## 6. Verify

```bash
REDLINE=0 npx playwright test --grep "(@TC-BRD-021|@TC-BRD-022)\b"   # the tests you touched; 3 runs if they create data
npm run format && npm run lint && npx tsc -p . && npm run check:ids
```

If a test fails, find out why before changing anything:

```bash
REDLINE_AI=1 npx playwright test --grep "@TC-BRD-021\b"   # runs it with Redline, no report server
```

The user runs `npm run test:ai TC-BRD-021` for the same thing plus the Allure report. Don't run it yourself: its report server waits for Ctrl+C.

Read `test-results/redline-report.md`. For each incident it gives the category, the confidence, the evidence, the next step and a curl command to reproduce. Then act on the category:

| Redline says                  | What to do                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BUG DI TEST** (test bug)    | Fix the test. Check the fix against the contract (`api-testing` §5), never by weakening the assertion.                                                                                                                                                                                                                                                   |
| **BUG BACKEND** (backend bug) | Keep the expectation. If the contract does not allow what the API did, follow `api-testing` §5 (`test.skip` + `FIXME`), and ask first. Report it.                                                                                                                                                                                                        |
| **ENVIRONMENT**               | Don't change the tests. Check the target is reachable (live: `curl https://api.practicesoftwaretesting.com/status`; local: `curl localhost:8091/status` and a sprint 5 database, `migrate:fresh --seed`), and that the Redline server is on `:8787`. On live, other people change data too: rerun before blaming the test. Tell the user what you found. |
| **FLAKY**                     | Rerun it 3 times. Look for shared data (fixed emails or slugs, list counts) or ordering between tests.                                                                                                                                                                                                                                                   |
| **BELUM JELAS** (unclear)     | Read the evidence and the curl output yourself. If it is still unclear, offer `npm run test:verify <ID>` to prove the cause (it costs AI money), or ask.                                                                                                                                                                                                 |

A test may be called done only when it passes, or when it is skipped with a `FIXME` that the user agreed to.

## 7. Report

```
## Done
- Changed: <files, one line each>
- Tests: <table: ID · scenario · result (pass / skip+FIXME / not testable: why)>
- Checks: format, lint, types, ids — pass/fail
- Redline: <verdicts for failures you hit, and what you did>
- Findings: <contract gaps, bugs, things noticed but not changed>
- Next: <what the user should decide or do>
```

Report failures and skipped checks plainly. Then stop: commit or open a PR only when the user asks (`AGENTS.md`, Git).
