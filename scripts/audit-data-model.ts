import { appendFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { AUDIT_IDS, type AuditId } from "./data-model-audit/catalogue";
import {
	AuditDatabaseError,
	wranglerDatabase,
} from "./data-model-audit/database";
import {
	type AuditReport,
	type CheckResult,
	runAudit,
} from "./data-model-audit/run";

const USAGE = `usage: bun scripts/audit-data-model.ts (--local | --remote) --database <name>
  [--config apps/server/wrangler.toml] [--persist-to <dir>] [--enable A-6,A-8] [--json]

Read-only data-model-v2 audit (docs/design/data-model-v2.md §16.7).
--enable runs the named pending audits ahead of their enabling task (rehearsal and pre-audit).
Exit 0: no gate violation. Exit 1: a violation or a check error. Exit 2: usage or database failure.`;

const SAMPLE_ROWS = 20;

function describe(result: CheckResult): string {
	const count =
		result.status === "pass" ||
		result.status === "violation" ||
		result.status === "report"
			? ` — ${result.rows.length} row(s)`
			: "";
	const detail = result.detail ? ` (${result.detail})` : "";
	return `[${result.status}] ${result.audit} ${result.part}${count}${detail}`;
}

function printText(report: AuditReport): void {
	console.log(`Data model audit of ${report.database}`);
	for (const result of report.results) {
		console.log(describe(result));
		for (const row of result.rows.slice(0, SAMPLE_ROWS)) {
			console.log(`    ${JSON.stringify(row)}`);
		}
		if (result.rows.length > SAMPLE_ROWS) {
			console.log(`    … ${result.rows.length - SAMPLE_ROWS} more`);
		}
	}
	console.log(report.failed ? "Audit FAILED" : "Audit passed");
}

function writeStepSummary(report: AuditReport): void {
	const file = process.env.GITHUB_STEP_SUMMARY;
	if (!file) {
		return;
	}
	const lines = [
		`### Data model audit: ${report.failed ? "failed" : "passed"}`,
		"",
		`Database: \`${report.database}\``,
		"",
		"| Audit | Check | Status | Rows | Detail |",
		"| --- | --- | --- | --- | --- |",
		...report.results.map(
			(result) =>
				`| ${result.audit} | ${result.part} | ${result.status} | ${result.rows.length} | ${(result.detail ?? "").replaceAll("|", "\\|")} |`
		),
		"",
	];
	appendFileSync(file, `${lines.join("\n")}\n`);
}

const OPTIONS = {
	local: { type: "boolean" },
	remote: { type: "boolean" },
	database: { type: "string" },
	config: { type: "string" },
	"persist-to": { type: "string" },
	enable: { type: "string" },
	json: { type: "boolean" },
} as const;

function parseOptions(argv: string[]) {
	try {
		return parseArgs({ args: argv, options: OPTIONS }).values;
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		return null;
	}
}

function parseEnabled(value: string | undefined): Set<AuditId> | null {
	const ids = (value ?? "").split(",").filter((id) => id !== "");
	const known: readonly string[] = AUDIT_IDS;
	const unknown = ids.filter((id) => !known.includes(id));
	if (unknown.length > 0) {
		console.error(`unknown audit id: ${unknown.join(", ")}`);
		return null;
	}
	return new Set(AUDIT_IDS.filter((id) => ids.includes(id)));
}

function main(argv: string[]): number {
	const values = parseOptions(argv);
	const enablePending = parseEnabled(values?.enable);
	if (
		!(values && enablePending) ||
		values.local === values.remote ||
		!values.database
	) {
		console.error(USAGE);
		return 2;
	}
	const db = wranglerDatabase({
		database: values.database,
		mode: values.remote ? "remote" : "local",
		config: path.resolve(
			values.config ??
				path.join(import.meta.dirname, "../apps/server/wrangler.toml")
		),
		persistTo: values["persist-to"],
	});
	let report: AuditReport;
	try {
		report = runAudit(db, { enablePending });
	} catch (error) {
		if (!(error instanceof AuditDatabaseError)) {
			throw error;
		}
		console.error(`Audit could not read ${db.label}: ${error.message}`);
		return 2;
	}
	if (values.json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		printText(report);
	}
	writeStepSummary(report);
	return report.failed ? 1 : 0;
}

if (import.meta.main) {
	process.exit(main(process.argv.slice(2)));
}
