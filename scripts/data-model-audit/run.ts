import {
	type AuditId,
	CHECKS,
	type Check,
	type ReplayCheck,
	type SqlCheck,
} from "./catalogue";
import {
	type AuditDatabase,
	nullableInteger,
	type Row,
	text,
} from "./database";
import { runReplay } from "./replay";

export const CHECK_STATUSES = [
	"pass",
	"violation",
	"report",
	"error",
	"pending",
	"not-introduced",
	"not-applicable",
	"retired",
] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export interface CheckResult {
	audit: AuditId;
	detail: string | null;
	forced: boolean;
	part: string;
	rows: Row[];
	status: CheckStatus;
}

export interface AuditReport {
	database: string;
	failed: boolean;
	results: CheckResult[];
}

export interface AuditOptions {
	enablePending: ReadonlySet<AuditId>;
}

const NO_CUTOVER_BOUND = 253_402_300_799;

interface Plan {
	check: Check;
	cutoverAt: number;
	forced: boolean;
}

function settle(check: Check, status: CheckStatus, detail: string | null) {
	return {
		audit: check.audit,
		part: check.part,
		status,
		detail,
		forced: false,
		rows: [],
	} satisfies CheckResult;
}

function plan(
	check: Check,
	applied: ReadonlyMap<string, number>,
	tables: ReadonlySet<string>,
	options: AuditOptions
): Plan | CheckResult {
	const { activation } = check;
	if (activation.state === "retired") {
		return settle(check, "retired", `replaced by ${activation.replacedBy}`);
	}
	const retirement = check.historical?.notApplicableAfter;
	if (retirement?.migration && applied.has(retirement.migration)) {
		return settle(
			check,
			"not-applicable",
			`historical source removed by ${retirement.task} (${retirement.migration})`
		);
	}
	if (activation.state === "pending") {
		if (check.kind === "deferred") {
			return settle(
				check,
				"pending",
				`implemented and enabled by ${activation.enabledBy}`
			);
		}
		if (!options.enablePending.has(check.audit)) {
			return settle(check, "pending", `enabled by ${activation.enabledBy}`);
		}
	} else if (activation.since !== null && !applied.has(activation.since)) {
		return settle(
			check,
			"not-introduced",
			`active from migration ${activation.since}`
		);
	}
	const missing = check.tables.filter((table) => !tables.has(table));
	if (missing.length > 0) {
		return settle(
			check,
			"error",
			`required tables are missing: ${missing.join(", ")}`
		);
	}
	const cutoverAt =
		activation.state === "active" && activation.since !== null
			? (applied.get(activation.since) ?? NO_CUTOVER_BOUND)
			: NO_CUTOVER_BOUND;
	return { check, cutoverAt, forced: activation.state === "pending" };
}

function findingsResult(planned: Plan, rows: Row[]): CheckResult {
	const { check } = planned;
	let status: CheckStatus = "pass";
	if (rows.length > 0) {
		status = check.reportOnly ? "report" : "violation";
	}
	return {
		audit: check.audit,
		part: check.part,
		status,
		detail: planned.forced ? "run ahead of its enabling task (--enable)" : null,
		forced: planned.forced,
		rows,
	};
}

function errorResult(planned: Plan, error: unknown): CheckResult {
	return {
		...findingsResult(planned, []),
		status: "error",
		detail: error instanceof Error ? error.message : String(error),
	};
}

function runSql(
	db: AuditDatabase,
	planned: readonly (Plan & { check: SqlCheck })[]
): CheckResult[] {
	const statements = planned.map(({ check, cutoverAt }) =>
		check.sql(cutoverAt)
	);
	try {
		const results = db.query(statements);
		return planned.map((item, index) =>
			findingsResult(item, results[index] ?? [])
		);
	} catch {
		return planned.map((item) => {
			try {
				const [rows = []] = db.query([item.check.sql(item.cutoverAt)]);
				return findingsResult(item, rows);
			} catch (error) {
				return errorResult(item, error);
			}
		});
	}
}

function runReplayChecks(
	db: AuditDatabase,
	planned: readonly (Plan & { check: ReplayCheck })[]
): CheckResult[] {
	if (planned.length === 0) {
		return [];
	}
	try {
		const findings = runReplay(
			db,
			new Set(planned.map(({ check }) => check.replay))
		);
		return planned.map((item) =>
			findingsResult(item, findings[item.check.replay])
		);
	} catch (error) {
		return planned.map((item) => errorResult(item, error));
	}
}

export function runAudit(
	db: AuditDatabase,
	options: AuditOptions
): AuditReport {
	const [migrations = [], tableRows = []] = db.query([
		"SELECT name, unixepoch(applied_at) AS applied_at FROM d1_migrations",
		"SELECT name FROM sqlite_master WHERE type = 'table'",
	]);
	const applied = new Map(
		migrations.map((row) => [
			text(row, "name"),
			nullableInteger(row, "applied_at") ?? NO_CUTOVER_BOUND,
		])
	);
	const tables = new Set(tableRows.map((row) => text(row, "name")));

	const outcomes = new Map<Check, CheckResult>();
	const runnable: Plan[] = [];
	for (const check of CHECKS) {
		const outcome = plan(check, applied, tables, options);
		if ("status" in outcome) {
			outcomes.set(check, outcome);
		} else {
			runnable.push(outcome);
		}
	}

	const sqlPlans = runnable.filter(
		(item): item is Plan & { check: SqlCheck } => item.check.kind === "sql"
	);
	const replayPlans = runnable.filter(
		(item): item is Plan & { check: ReplayCheck } =>
			item.check.kind === "replay"
	);
	const executed = [
		...runSql(db, sqlPlans),
		...runReplayChecks(db, replayPlans),
	];
	[...sqlPlans, ...replayPlans].forEach((item, index) => {
		outcomes.set(item.check, executed[index] ?? errorResult(item, "no result"));
	});
	const results = CHECKS.map(
		(check) => outcomes.get(check) ?? settle(check, "error", "not evaluated")
	);
	return {
		database: db.label,
		failed: results.some(
			(result) => result.status === "violation" || result.status === "error"
		),
		results,
	};
}
