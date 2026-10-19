# AI orchestra: roadmap

How AI assistants work in this repo, built up in phases. The idea: instead of explaining the rules in every prompt, the repo carries them. A short always-loaded rulebook (`CLAUDE.md`), skills that load when a task needs them, hooks that block what breaks the rules, and a workflow that ends with running the tests and Redline. The user reviews and decides.

Each phase is one PR and is proven with a real task, not only written.

| Phase | What                                                                                                                                                                                                                                                   | Proven by                                                                                            | Status  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------- |
| 0     | **Rulebook.** `CLAUDE.md`: context, commands, Constitution (MUST / SHOULD / WON'T), how to work with AI, skills index. This roadmap.                                                                                                                   | A fresh agent, given only "review `brand.spec.ts`", finds known issues by citing the rules.          | Done    |
| 1     | **Guardrails.** A Claude Code `PreToolUse` hook (Node) that blocks writes breaking mechanical rules: spec imports, missing or duplicate `@TC-` tag, `waitForTimeout`, `test.only`, hardcoded ids. The same checks in CI, so they also apply to people. | The hook rejects a planted bad write with a clear message; CI fails on the same file.                | Planned |
| 2     | **API skills.** `api-testing` (contract-first test cases, status-code matrix from OpenAPI, per-field negative tests, contract mismatches as `test.skip` + `FIXME`), `fixtures`, `data-strategy`. Schemas move to `z.strictObject()`.                   | An agent writes a new area's tests (after the user wrote the first ones) that pass review unchanged. | Planned |
| 3     | **Workflow.** One entry skill: understand → pick skills → plan with confidence and unknowns → user approves → write → verify (tests, then `npm run test:ai` for failures) → report.                                                                    | A task end to end, with a stop-and-ask when the contract is unclear.                                 | Planned |
| 4     | **Reviewer.** `pr-reviewer`: review a branch against the Constitution and the skills it touches, running lint, types and the changed specs.                                                                                                            | It finds planted issues in a test PR and ties each to a rule.                                        | Planned |
| 5     | **Upkeep.** A drift check that keeps `CLAUDE.md`, the hook and the CI checks in sync; small evals for the skills.                                                                                                                                      | CI fails when a rule is added to one place only.                                                     | Planned |
| Later | **Web UI tests** (page objects, semantic locators, UI exploration) and the matching Redline facts (browser network calls, failed locators, console errors).                                                                                            |                                                                                                      | Later   |

## Rules for the orchestra itself

- `CLAUDE.md` stays short: it is loaded on every turn. Detail goes into skills.
- The Constitution states the rules the tests follow today. A rule that changes code (such as `z.strictObject`) is added in the same PR as the change. When a review finds code that breaks a rule, fix the code, not the rule.
- Skills point at the code (`tests/api/toolshop/fixtures/auth.fixture.ts`) instead of copying it.
- The user writes the first tests of each new area; the AI reviews. This repo is also interview preparation.
