# Browser-local release operations

**Status:** Current release and validation guidance for the served browser-local workflow
**Applies to:** `web/` workspace, browser-local docs, and supporting CI

## Purpose

This document covers the conservative operational guidance for building, validating, and publishing the browser-local workflow.

It does **not** redefine the project as a hosted conversion service. The current browser-local contract remains:

- served mode is required
- conversion runs locally in the browser runtime on the user's device
- ZIP-first intake is the supported baseline
- direct folder intake is experimental
- `file://` launch is unsupported

## Release posture

Treat the browser-local surface as a served multi-file application.

Do **not** publish documentation or release notes that imply any of the following:

- double-clickable `file://` support
- automatic desktop-style attachment-path discovery from browser pickers
- universal folder-picking support across browsers
- broad large-library guarantees beyond the currently documented evidence

## Runtime and toolchain baseline

Current repository baselines:

- Node.js: `>=20.19.0`
- package manager: `npm`
- build tool: Vite
- unit/integration test runner: Vitest
- browser automation: Playwright
- canonical browser runtime for support claims: current Chromium-class browser in served mode

## Local operator workflow

### Install dependencies

From `web/`:

- install dependencies with `npm ci`

### Run a served development instance

From `web/`:

- use `npm run dev` for the development server
- use `npm run preview` after a production build when you want a served preview of the built assets

The support contract is about the **served** result, not a direct `file://` launch of built files.

### Build the static application

From `web/`:

- run `npm run build`

This produces the static served artifact under `web/dist`.

## Required validation before marking a release candidate ready

The current repository already defines the minimum browser-local quality gates.

### Required checks

From `web/`:

- `npm run test`
- `npm run typecheck`
- `npm run build`
- `CI=true npm run test:e2e -- --project=chromium`

These align with `.github/workflows/web-ci.yml`.

### Best-effort matrix checks

Also run, or rely on CI to run:

- `CI=true npm run test:matrix -- --project=firefox`
- `CI=true npm run test:matrix -- --project=webkit`

Interpretation:

- Chromium smoke is required for the supported baseline
- Firefox and WebKit matrix runs are useful evidence for the documented **best-effort** tier
- a passing Firefox/WebKit run does **not** upgrade those browsers to the same support commitment as Chromium without an explicit support-matrix change

## Hosted deployment notes

The repository includes GitHub Pages deployment in `.github/workflows/pages.yml`.

Operationally, that means:

- the browser-local app can be published as static assets
- the deployment target must preserve served-mode behavior over HTTPS
- publishing a static site does **not** change the privacy posture into server-side conversion

If you publish via another static host, keep the same contract:

- serve the built files over HTTPS or localhost-equivalent during local validation
- do not document `file://` launch as supported
- do not add server-side upload or conversion claims unless the privacy and contract documents are updated first

## Playwright and Linux notes

The current CI workflows run on `ubuntu-latest` and install browser dependencies with Playwright itself.

Repository truth today:

- Chromium smoke installs with `npx playwright install --with-deps chromium`
- Firefox and WebKit best-effort matrix jobs install with `npx playwright install --with-deps <browser>`

For local Linux validation, prefer the same pattern instead of maintaining a hand-written distro package list. On Debian/Ubuntu-class systems, `--with-deps` is the least surprising path.

If local browser automation still fails:

- retry the exact Playwright browser install for the target browser
- confirm Node meets the repository baseline
- confirm you are running the app in served mode, not trying to automate a `file://` launch
- compare with CI behavior before broadening support claims

## Port and server behavior for E2E runs

The shared Playwright config uses a strict served-mode base URL and starts Vite with a fixed port unless you override it.

Operational details from `playwright.config.ts`:

- default base port: `4173`
- host: `127.0.0.1`
- Vite runs with `--strictPort`
- optional server reuse is controlled by `PLAYWRIGHT_REUSE_SERVER=1`

If an E2E run fails because the port is already in use:

- stop the conflicting server, or
- rerun with a different `PLAYWRIGHT_BASE_PORT`, or
- deliberately reuse an already running server when appropriate

## Documentation obligations for a browser-local release

Before publishing or tagging a browser-local release candidate, verify that user-facing docs still match the current runtime:

- [`user-guide.md`](./user-guide.md)
- [`troubleshooting.md`](./troubleshooting.md)
- [`privacy.md`](./privacy.md)
- [`support-matrix.md`](./support-matrix.md)
- [`attachment-policy.md`](./attachment-policy.md)

Specifically re-check these statements:

- local processing is true
- offline-first application support is **not** overstated
- served mode is required
- `file://` is unsupported
- folder intake is experimental
- attachment path export requires explicit user-supplied library location

## Release checklist

- [ ] user-facing docs match current runtime behavior
- [ ] support tiers remain conservative and capability-based
- [ ] privacy wording still reflects browser-local processing with no baseline server-side conversion step
- [ ] attachment behavior is documented honestly
- [ ] Chromium smoke passes
- [ ] best-effort matrix results are reviewed but not over-interpreted
- [ ] build output is served, not documented for direct `file://` launch

## Related documents

- [`user-guide.md`](./user-guide.md)
- [`troubleshooting.md`](./troubleshooting.md)
- [`support-matrix.md`](./support-matrix.md)
- [`privacy.md`](./privacy.md)
- [`performance-thresholds.md`](./performance-thresholds.md)
