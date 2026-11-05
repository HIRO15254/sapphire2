# Data Audits

The read-only [audit catalogue](../../scripts/data-model-audit/catalogue.ts) checks data invariants that are not all enforced by foreign keys or CHECK constraints. Its parts activate according to applied migration records and required tables; a missing required table for an activated part is an error. The runner reports pass, violation, error, pending or not-introduced per part. A violation or check error fails the audit.

| Check | Coverage |
|---|---|
| FK | SQLite `PRAGMA foreign_key_check`. |
| A-6 | Replay live entry projections: status and played date, days, kind details and Hero seats, projected ledger lines, and open cash EV. |
| A-8 | Every entry has a day and `played_on` is the earliest local date. |
| A-9 | Settled status matches ended days and the final day's end state. |
| A-13 | Each ring game's or tournament's current rule belongs to that master. |
| A-14 | Entry details; contiguous day, hand, action and tournament-level sequences; ended manual days; lineup structure; exchange and entry-line roles; currency base setting; rule/master parity; stake coverage; payment price linkage; and self-player/Hero consistency. |
| A-15 | Event payload registry and version, owned payload references, all-in hand links, and projected line/payment price agreement. |
| A-16 | Cleanup checks for migrated Unassigned assets and room mappings, migrated live dates, and stand-in master creation and builtin keys. |

On dev deployment, the workflow audits the migrated copy of production before deploying the API. On production deployment, the audit runs after migrations and gates both the Worker and web deployment. Run it manually from the repository root with `bun scripts/audit-data-model.ts --remote --database sapphire2-db` (or use `--local` and the relevant database name). `--enable A-6,A-8` enables named pending checks for rehearsal; `--json` emits a machine-readable report. Exit 0 means no violations or errors, 1 means at least one check violation or error, and 2 means the database could not be read. See the [deployment guide](../deploy.md) for recovery.
