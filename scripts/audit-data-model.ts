import { appendFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
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
  [--config apps/server/wrangler.toml] [--persist-to <dir>] [--json]

Read-only data model audit (docs/design/data-audits.md).
Exit 0: no gate violation. Exit 1: a violation or a check error. Exit 2: usage or database failure.`;

const SAMPLE_ROWS = 20;

function describe(result: CheckResult): string {
	const count =
		result.status === "pass" || result.status === "violation"
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
	config: { type: "string" },
	database: { type: "string" },
	json: { type: "boolean" },
	local: { type: "boolean" },
	"persist-to": { type: "string" },
	remote: { type: "boolean" },
} as const;

function parseOptions(argv: string[]) {
	try {
		return parseArgs({ args: argv, options: OPTIONS }).values;
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		return null;
	}
}

function main(argv: string[]): number {
	const values = parseOptions(argv);
	if (!values || values.local === values.remote || !values.database) {
		console.error(USAGE);
		return 2;
	}
	const db = wranglerDatabase({
		config: path.resolve(
			values.config ??
				path.join(import.meta.dirname, "../apps/server/wrangler.toml")
		),
		database: values.database,
		mode: values.remote ? "remote" : "local",
		persistTo: values["persist-to"],
	});
	let report: AuditReport;
	try {
		report = runAudit(db);
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
