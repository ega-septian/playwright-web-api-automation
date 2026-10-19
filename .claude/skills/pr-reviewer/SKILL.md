---
name: pr-reviewer
description: Review a branch, a pull request or a set of test files in this repo against its own rules (AGENTS.md and the skills), running the checks instead of only reading. Use for "review this PR", "review my branch", "review brand.spec.ts", or before merging a change written by AI. The result is a report; fixing is a separate step the user asks for.
---

# PR reviewer

Review the way a careful teammate on this repo would: against this repo's contract, not generic best practice. The contract is `AGENTS.md` (the Constitution) plus the skills that own the files that changed. **Every finding needs a reason you can point to:** a rule (quote its section), a contract mismatch (the `npm run contract` output) or a concrete bug (input, then wrong result). Opinions with no rule behind them go under "Suggestions" at most.

## 1. Scope

| Request                            | Target             | In scope                                                                             |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| "review my branch" or nothing      | the current branch | `git diff --name-status $(git merge-base origin/main HEAD)` plus uncommitted changes |
| "review PR 27"                     | that PR            | `gh pr view 27 --json headRefName,files,body`, and `gh pr diff 27`                   |
| "review brand.spec.ts" or a folder | those files        | the whole file: every test is in scope                                               |

Run `git fetch origin main -q` first. To run a PR's checks, its branch has to be checked out. If it isn't the current branch, ask before switching (`gh pr checkout 27`), and never switch with uncommitted changes in the way. Without checking it out, you can still review from the diff, but say so in the report.

In branch and PR mode, review the changed lines **and the whole tests they belong to**. Report problems in untouched code of a changed file separately, as **pre-existing**. Those don't block the PR.

## 2. Route the files to the skills

| Changed file                                   | Read with                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `tests/**/*.spec.ts`                           | `api-testing` (§2–§5), `data-strategy`, `fixtures` when tokens are used |
| `tests/**/schemas/*.ts`                        | `api-testing` §3, and the contract of the endpoints that use the schema |
| `tests/**/data/*`, `types/*`                   | `data-strategy`                                                         |
| `tests/**/fixtures/*`                          | `fixtures`                                                              |
| `.claude/**`, `AGENTS.md`, `docs/orchestra.md` | `docs/orchestra.md`, "Rules for the orchestra itself"                   |
| `scripts/*`, configs, `.github/*`              | `AGENTS.md` Git and Commands, and the CI section of the README          |

## 3. Run the checks (don't only read)

```bash
npx eslint <changed .ts files>                 # warnings count too: say which rule
npx tsc -p . --noEmit
npm run check:ids
npm run check:weakening                        # tests deleted, fewer expects, a status removed or replaced, new skip/only
REDLINE=0 npx playwright test <changed spec files>
```

If a changed spec fails, triage it the way the `workflow` skill does (§6, Redline categories) before writing the finding. A failing test is a blocking finding in itself.

Every line from `check:weakening` needs a reason in the PR (a contract change, a `FIXME`, the user's agreement). If there is none, it is a blocking finding.

## 4. Review against the rules

For each test in scope, go through `AGENTS.md` in order:

- **MUST:**
  - imports;
  - ID;
  - one describe per endpoint;
  - own data and no seed ids;
  - schemas are strict and match the contract;
  - the order status → contract → values;
  - follow-up reads, including after a rejected write;
  - auth through the fixtures;
  - contract mismatches handled with skip + FIXME;
  - verified.
- **SHOULD:**
  - a step per call;
  - negative cases per field;
  - **the title matches what the test sends** ("missing" vs "empty");
  - step names match what the step does.
- **WON'T:**
  - fixed waits;
  - hardcoded ids;
  - negative logins with seed accounts;
  - weakened expectations;
  - `only`, `any`, secrets.

Then check the expectations against the contract: `npm run contract -- <METHOD> <path>` for each endpoint the tests call. An expected status or field the contract does not allow needs a comment that explains it.

Last, look for coverage gaps in the endpoints touched: documented status codes with no test, and required fields with no missing or wrong-type case (`api-testing` §2). Report these as **Should** at most.

## 5. Severity

- **Blocking:** a failing or weakened test, a broken MUST or WON'T in the changed code, a test that does not test what its title says, a contract mismatch with no FIXME.
- **Should:** a broken SHOULD, a missing follow-up read in untouched parts of the test, a coverage gap, unclear names.
- **Nit:** style that no rule covers but that makes the code harder to read. Keep these few.

## 6. Report

```
## Review: <branch / PR #n / files>
Verdict: Approve | Approve with suggestions | Changes requested
Checks: lint <n errors, n warnings> · types · ids · weakening · tests <passed/failed>

### Blocking
| # | File:line (test ID) | Rule | Finding | Suggested fix |

### Should
| ... same columns ... |

### Pre-existing (not caused by this change)
| ... same columns ... |

### Nits and questions
- ...
```

Keep each finding one or two lines. Quote the rule by its `AGENTS.md` section, for example "MUST › Writes are verified with a follow-up read".

## 7. After the report

- **Don't fix anything unless the user asks.** When they do, use the `workflow` skill: plan which findings, get approval, fix them, then run `npm run check:weakening` and the tests. A fix must not weaken a test.
- **Post on GitHub only when asked:** `gh pr comment <n> --body-file <report.md>`. Write the report body in English, like the rest of the repo. Never add AI attribution.
