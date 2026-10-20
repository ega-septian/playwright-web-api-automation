## Summary

<!-- One or two sentences: what this PR does and why. -->

## Changes

<!-- Group by area. Delete the ones that don't apply. -->

### Tests

-

### Redline integration

-

### Tooling / CI

-

## How to test

<!-- Commands a reviewer can run. Mention what needs to be running (e.g. TOOLSHOP_TARGET=local for Toolshop in Docker, Redline at localhost:8787). -->

1.

## Results

<!-- Test run, lint, and benchmark numbers if they changed. -->

- [ ] `npx tsc -p .` passes
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] Tests for the affected project pass:
- [ ] `npm run check:ids` passes: every test has exactly one unique `@TC-` tag
- [ ] No test has both its `@TC-` ID and its name (title, `describe` or file) changed in this PR
- [ ] The Playwright project name is unchanged

## Known issues

<!-- Anything that is not finished, flaky, or fails in CI, and why. Write "None" if there are none. -->
