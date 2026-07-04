// Deterministic time-zone control for date-formatting tests. Node/Bun re-reads
// `process.env.TZ` on every Date operation, so wrapping an assertion in `withTz`
// exercises a specific zone regardless of the host machine's local time.
//
// The pristine host zone is captured once at module load and restored in a
// `finally`, so a test can never leak a zone into sibling files that share the
// same project under vitest's `isolate: false` (both `web-node` and `web-dom`
// run this way). When the host had no `TZ` set, the restore must `delete` the
// var — assigning `undefined` coerces to the string `"undefined"`, which Node
// treats as an invalid zone and silently falls back to UTC (SA2-145).
const ORIGINAL_TZ = process.env.TZ;

/** Common zones used by the date tests: west of / east of / at UTC. */
export const TZ_WEST = "America/Los_Angeles"; // UTC-8/-7 — reproduces the off-by-one bug
export const TZ_EAST = "Asia/Tokyo"; // UTC+9

export function withTz<T>(tz: string, fn: () => T): T {
	process.env.TZ = tz;
	try {
		return fn();
	} finally {
		if (ORIGINAL_TZ === undefined) {
			// Truly unset it: `process.env.TZ = undefined` coerces to the string
			// "undefined" (an invalid zone Node silently reads as UTC), which would
			// leak instead of restoring the pristine "no TZ" state. Reflect avoids
			// the `delete` operator that lint/performance/noDelete forbids.
			Reflect.deleteProperty(process.env, "TZ");
		} else {
			process.env.TZ = ORIGINAL_TZ;
		}
	}
}
