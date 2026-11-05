# Web Platform History

Historical context only; current contracts and implementation links are in [Web Platform Design](../design/web-platform.md).

- **SA2-154:** A persisted query cache could hydrate results from an earlier server build after output semantics changed. A release buster was introduced; the data-model-v2 buster replaced `2026-10-room-archive`.
- **SA2-159:** On shared devices, a cache not scoped to users could expose the previous account's data after sign-out. The sign-out flow was changed to clear both in-memory and persisted queries, including on request failure.
- **SA2-163:** The PWA's former `/dashboard` start URL pointed at a removed route, producing a 404 when launched from the home screen. The manifest moved to `/`.
- **SA2-97:** Inactive Radix tab panels unmounted their forms, leaving an external Save button without its target. Keeping the form mounted resolved the silent submission failure.
- **SA2-170:** Maps short-link resolution introduced an explicitly allowlisted exception to the prohibition on fetching user-supplied URLs.
- **SA2-145:** Date-only UTC round-trip drift motivated separating UTC date formatting from local instant formatting; see [data integrity](../design/data-integrity.md) for the broader contract.
- **SA2-185:** Comparing the latest release only against the most recently viewed release skipped auto-opening for users with no view records. The decision now uses the full viewed set once loaded.
