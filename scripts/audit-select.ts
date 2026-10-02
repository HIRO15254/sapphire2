import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export interface AuditFile {
	auditedAt: Date | null;
	auditedSha: string | null;
	churn: number;
	loc: number;
	path: string;
}

export interface LedgerRow {
	agent: string;
	date: string;
	filed: number;
	path: string;
	sha: string;
}

export interface AuditUnit {
	files: AuditFile[];
	loc: number;
	path: string;
}

export interface Selection {
	agent: string;
	files: string[];
	loc: number;
	mode: "diff" | "sweep";
	path: string;
	reason: string;
	rules: string[];
	score: number;
	sinceSha: string | null;
}

export const UNIT_LOC_BUDGET = 4000;
export const STALE_DAYS = 30;
export const DIFF_MODE_CHURN_RATIO = 0.25;
export const AGENTS = ["claude", "codex"] as const;

const ROOTS = [
	"apps/web/src",
	"apps/server/src",
	"packages/api/src",
	"packages/db/src",
	"packages/auth/src",
	"packages/mcp/src",
];
const EXCLUDED_PATH =
	/(^|\/)(__tests__|__integration__|migrations)\/|\.test\.tsx?$|\.d\.ts$|\.gen\.ts$|\.(css|json|sql)$/;
const SOURCE_PATH = /\.(ts|tsx)$/;
const DAY_MS = 86_400_000;
const WEIGHT_PER_DAY = 1;
const NEVER_AUDITED_DAYS = 90;
const SEPARATOR_CELL = /^-+$/;
const MARKDOWN_CELL = /\s*\|\s*/;

const RISK_WEIGHTS: [string, number][] = [
	["packages/api/", 1.5],
	["packages/db/", 1.5],
	["packages/auth/", 1.5],
	["apps/server/", 1.5],
	["packages/mcp/", 1.2],
];

const RULES: [string, string[]][] = [
	[
		"packages/api/",
		[
			"api-security.md",
			"api-data-integrity.md",
			"datetime-and-numbers.md",
			"mcp-tools.md",
		],
	],
	["packages/db/", ["db-migrations.md", "api-data-integrity.md"]],
	["packages/mcp/", ["mcp-tools.md"]],
	["packages/auth/", ["api-security.md"]],
	["apps/server/", ["api-security.md"]],
	[
		"apps/web/",
		[
			"web-architecture.md",
			"web-hooks-separation.md",
			"web-forms.md",
			"web-ui.md",
			"web-data-fetching.md",
			"web-theme.md",
			"datetime-and-numbers.md",
		],
	],
];

export function parseLedger(markdown: string): LedgerRow[] {
	const rows: LedgerRow[] = [];
	for (const line of markdown.split("\n")) {
		if (!line.trim().startsWith("|")) {
			continue;
		}
		const cells = line.trim().slice(1, -1).split(MARKDOWN_CELL);
		const [path, sha, date, agent, filed] = cells.map((cell) =>
			cell.replaceAll("`", "").trim()
		);
		if (
			!(path && sha && date && agent) ||
			path === "path" ||
			SEPARATOR_CELL.test(path)
		) {
			continue;
		}
		rows.push({ path, sha, date, agent, filed: Number(filed) || 0 });
	}
	return rows;
}

export function renderLedger(rows: LedgerRow[]): string {
	const body = [...rows]
		.sort((a, b) => a.path.localeCompare(b.path, "en"))
		.map(
			(row) =>
				`| ${row.path} | ${row.sha} | ${row.date} | ${row.agent} | ${row.filed} |`
		);
	return [
		"| path | sha | date | agent | filed |",
		"|---|---|---|---|---|",
		...body,
	].join("\n");
}

export function rowCovers(rowPath: string, filePath: string): boolean {
	if (rowPath.endsWith("/*")) {
		const dir = rowPath.slice(0, -2);
		return (
			filePath.startsWith(`${dir}/`) &&
			!filePath.slice(dir.length + 1).includes("/")
		);
	}
	return filePath === rowPath || filePath.startsWith(`${rowPath}/`);
}

export function coveringRow(
	rows: LedgerRow[],
	filePath: string
): LedgerRow | null {
	let best: LedgerRow | null = null;
	for (const row of rows) {
		if (rowCovers(row.path, filePath) && (!best || row.date > best.date)) {
			best = row;
		}
	}
	return best;
}

export function applyRun(rows: LedgerRow[], run: LedgerRow): LedgerRow[] {
	const replaced = (rowPath: string) =>
		rowPath === run.path ||
		(!run.path.endsWith("/*") && rowCovers(run.path, rowPath));
	return [...rows.filter((row) => !replaced(row.path)), run];
}

export function splitUnits(
	files: AuditFile[],
	budget = UNIT_LOC_BUDGET
): AuditUnit[] {
	const units: AuditUnit[] = [];
	const visit = (dir: string, members: AuditFile[]) => {
		const loc = members.reduce((sum, file) => sum + file.loc, 0);
		if (loc <= budget) {
			units.push({ path: dir, loc, files: members });
			return;
		}
		const loose: AuditFile[] = [];
		const children = new Map<string, AuditFile[]>();
		for (const file of members) {
			const rest = file.path.slice(dir.length + 1);
			const slash = rest.indexOf("/");
			if (slash === -1) {
				loose.push(file);
				continue;
			}
			const child = `${dir}/${rest.slice(0, slash)}`;
			children.set(child, [...(children.get(child) ?? []), file]);
		}
		for (const file of loose) {
			if (file.loc > budget) {
				units.push({ path: file.path, loc: file.loc, files: [file] });
			}
		}
		const small = loose.filter((file) => file.loc <= budget);
		if (small.length > 0) {
			units.push({
				path: `${dir}/*`,
				loc: small.reduce((sum, file) => sum + file.loc, 0),
				files: small,
			});
		}
		for (const [child, childFiles] of children) {
			visit(child, childFiles);
		}
	};
	for (const root of ROOTS) {
		const members = files.filter((file) => file.path.startsWith(`${root}/`));
		if (members.length > 0) {
			visit(root, members);
		}
	}
	return units;
}

function weightFor(path: string): number {
	return RISK_WEIGHTS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? 1;
}

export function rulesFor(path: string): string[] {
	return RULES.find(([prefix]) => path.startsWith(prefix))?.[1] ?? [];
}

export function scoreUnit(unit: AuditUnit, now: Date) {
	let ageWeighted = 0;
	let churn = 0;
	let stale = false;
	for (const file of unit.files) {
		const days = file.auditedAt
			? Math.max(0, (now.getTime() - file.auditedAt.getTime()) / DAY_MS)
			: NEVER_AUDITED_DAYS;
		ageWeighted += days * file.loc;
		churn += file.churn;
		stale ||= days >= STALE_DAYS;
	}
	const ageDays = unit.loc === 0 ? 0 : ageWeighted / unit.loc;
	const score =
		(churn + ageDays * WEIGHT_PER_DAY * Math.sqrt(unit.loc)) *
		weightFor(unit.path);
	return { score, churn, ageDays, stale };
}

export function nextAgent(rows: LedgerRow[]): string {
	const latest = [...rows].sort((a, b) => b.date.localeCompare(a.date))[0];
	if (!latest) {
		return AGENTS[0];
	}
	const index = AGENTS.indexOf(latest.agent as (typeof AGENTS)[number]);
	return AGENTS[(index + 1) % AGENTS.length];
}

export function selectUnit(
	files: AuditFile[],
	rows: LedgerRow[],
	now: Date,
	budget = UNIT_LOC_BUDGET
): Selection | null {
	const scored = splitUnits(files, budget).map((unit) => ({
		unit,
		...scoreUnit(unit, now),
	}));
	if (scored.length === 0) {
		return null;
	}
	scored.sort((a, b) => {
		if (a.stale !== b.stale) {
			return a.stale ? -1 : 1;
		}
		return b.score - a.score || a.unit.path.localeCompare(b.unit.path, "en");
	});
	const [top] = scored;
	const shas = top.unit.files
		.map((file) => file.auditedSha)
		.filter((sha): sha is string => sha !== null);
	const diffMode =
		top.churn / Math.max(1, top.unit.loc) >= DIFF_MODE_CHURN_RATIO &&
		shas.length === top.unit.files.length &&
		new Set(shas).size === 1;
	return {
		path: top.unit.path,
		files: top.unit.files.map((file) => file.path),
		loc: top.unit.loc,
		score: Math.round(top.score),
		mode: diffMode ? "diff" : "sweep",
		sinceSha: diffMode ? shas[0] : null,
		rules: rulesFor(top.unit.path),
		agent: nextAgent(rows),
		reason: top.stale
			? `unaudited for ${STALE_DAYS}+ days or never (avg age ${Math.round(top.ageDays)}d)`
			: `${top.churn} lines changed since last audit, avg age ${Math.round(top.ageDays)}d`,
	};
}

function git(...args: string[]): string {
	return execFileSync("git", args, {
		encoding: "utf8",
		maxBuffer: 256 * 1024 * 1024,
	});
}

function churnSince(sha: string): Map<string, number> | null {
	try {
		const out = git("diff", "--numstat", "--no-renames", sha, "HEAD");
		const byFile = new Map<string, number>();
		for (const line of out.split("\n")) {
			const [added, removed, path] = line.split("\t");
			if (path) {
				byFile.set(path, (Number(added) || 0) + (Number(removed) || 0));
			}
		}
		return byFile;
	} catch {
		return null;
	}
}

export function collectFiles(rows: LedgerRow[]): AuditFile[] {
	const paths = git("ls-files", ...ROOTS)
		.split("\n")
		.filter(
			(path) => path && SOURCE_PATH.test(path) && !EXCLUDED_PATH.test(path)
		);
	const churnCache = new Map<string, Map<string, number> | null>();
	return paths.map((path) => {
		const row = coveringRow(rows, path);
		let churn = 0;
		let auditedAt: Date | null = null;
		let auditedSha: string | null = null;
		if (row) {
			if (!churnCache.has(row.sha)) {
				churnCache.set(row.sha, churnSince(row.sha));
			}
			const byFile = churnCache.get(row.sha);
			if (byFile) {
				auditedAt = new Date(row.date);
				auditedSha = row.sha;
				churn = byFile.get(path) ?? 0;
			}
		}
		const loc = readFileSync(path, "utf8").split("\n").length;
		return { path, loc, auditedAt, auditedSha, churn };
	});
}

function flag(args: string[], name: string): string | undefined {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? undefined : args[index + 1];
}

function main(argv: string[]) {
	const [command, ...args] = argv;
	const ledgerPath = flag(args, "ledger");
	const rows = ledgerPath ? parseLedger(readFileSync(ledgerPath, "utf8")) : [];
	if (command === "select") {
		const selection = selectUnit(collectFiles(rows), rows, new Date());
		process.stdout.write(`${JSON.stringify(selection, null, 2)}\n`);
		return;
	}
	if (command === "record") {
		const path = flag(args, "unit");
		const agent = flag(args, "agent");
		const filed = Number(flag(args, "filed") ?? 0);
		if (!(path && agent)) {
			throw new Error("record needs --unit and --agent");
		}
		const run: LedgerRow = {
			path,
			agent,
			filed,
			sha: git("rev-parse", "--short=12", "HEAD").trim(),
			date: new Date().toISOString().slice(0, 10),
		};
		process.stdout.write(`${renderLedger(applyRun(rows, run))}\n`);
		return;
	}
	throw new Error(
		"usage: audit-select.ts select|record --ledger <file> [--unit <path> --agent <name> --filed <n>]"
	);
}

if (import.meta.main) {
	main(process.argv.slice(2));
}
