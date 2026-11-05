# Testing and Tooling

Historical snapshot; for current guidance see [Testing and Tooling](../design/testing-and-tooling.md).

### Why local Miniflare/D1

At the initial assessment's base SHA `37371fd8`, Cloudflare's guidance recommended [`@cloudflare/vitest-plugin`](https://developers.cloudflare.com/workers/testing/vitest-integration/) and Wrangler's [`createTestHarness()`](https://developers.cloudflare.com/workers/testing/test-harness/); it did not assume the older `@cloudflare/vitest-pool-workers`. The minimal lockfile-compatible setup was tried. The new API required large dependency updates, so the implementation chose local Miniflare/D1 with the real repository migrations. This was neither a dependency downgrade nor a custom SQL interpreter. Local D1 does not prove production distributed behavior. The implementation and subsequent retirement of legacy test surfaces are traceable through [PR #603](https://github.com/HIRO15254/sapphire2/pull/603) and [PR #657](https://github.com/HIRO15254/sapphire2/pull/657), rather than a second, frozen inventory of current tests.


Migration specs used `bun:sqlite`, which exists only in Bun; Vitest skipped their bodies, requiring a separate `bun test` CI step and a `check:rules` listing check. The migration to `node:sqlite` removed that split (SA2-425).

