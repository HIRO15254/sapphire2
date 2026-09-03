import { normalizeRulePath } from "./check-rules-path";

export type ProjectName = "api" | "db" | "web-node";

export interface MutationProject {
	configFile: string;
	isSubject: (path: string) => boolean;
	isTestSide: (path: string) => boolean;
	root: string;
	timeoutMS: number;
}

export interface ChangedPlan {
	files: Set<string>;
	whole: boolean;
}

export interface ReportMutant {
	location: { start: { line: number } };
	mutatorName: string;
	status: string;
}

export interface MutationReport {
	files: Record<string, { mutants: ReportMutant[] }>;
}

export interface Metrics {
	coveredScore: number | null;
	ignored: number;
	invalid: number;
	killed: number;
	noCoverage: number;
	score: number | null;
	survived: number;
	timeout: number;
	valid: number;
}

export interface Survivor {
	file: string;
	line: number;
	mutator: string;
	status: string;
}

export interface SummaryRow {
	baseline: Metrics | null;
	cores: number | null;
	elapsedMs: number | null;
	metrics: Metrics | null;
	mode: string;
	project: ProjectName;
	survivors: Survivor[];
}

const TEST_PATH = /(^|\/)__tests__\/|\.test\.tsx?$/;
const DECLARATION = /\.d\.ts$/;
const API_SOURCE = /^packages\/api\/src\/.+\.ts$/;
const DB_SOURCE =
	/^packages\/db\/src\/(?:constants\.ts|constants\/.+\.ts|schemas\/.+\.ts)$/;
const WEB_NODE_SOURCE =
	/^apps\/web\/src\/(?:utils\/[^/]+\.ts|shared\/lib\/.+\.ts|features\/.+\/utils\/.+\.ts)$/;
const WEB_NODE_TEST =
	/^apps\/web\/src\/(?:utils\/__tests__\/|shared\/lib\/.*__tests__\/|features\/.+\/utils\/__tests__\/)/;
const API_EXCLUDED = new Set([
	"packages/api/src/context.ts",
	"packages/api/src/routers/index.ts",
]);
const DB_EXCLUDED = new Set(["packages/db/src/constants/player-tag-colors.ts"]);
const WEB_NODE_EXCLUDED = new Set([
	"apps/web/src/utils/trpc.ts",
	"apps/web/src/features/auth/utils/login-continuation.ts",
	"apps/web/src/features/sessions/utils/share-session.ts",
]);
const GLOBAL_TRIGGERS = /^(?:package\.json|bun\.lock|vitest\.config\.ts)$/;
const PROJECT_TRIGGER_SUFFIX =
	/\/(?:package\.json|vitest[^/]*\.config\.ts|tsconfig\.json)$/;
const TEST_IN_DIR = /\/__tests__\/([^/]+)\.test(\.tsx?)$/;
const TEST_SIBLING = /\.test(\.tsx?)$/;

export const PROJECTS: Record<ProjectName, MutationProject> = {
	api: {
		configFile: "packages/api/vitest.config.ts",
		root: "packages/api",
		timeoutMS: 30_000,
		isSubject: (path) =>
			API_SOURCE.test(path) &&
			!TEST_PATH.test(path) &&
			!DECLARATION.test(path) &&
			!API_EXCLUDED.has(normalizeRulePath(path)),
		isTestSide: (path) =>
			path.startsWith("packages/api/src/") && TEST_PATH.test(path),
	},
	db: {
		configFile: "packages/db/vitest.config.ts",
		root: "packages/db",
		timeoutMS: 20_000,
		isSubject: (path) =>
			DB_SOURCE.test(path) &&
			!TEST_PATH.test(path) &&
			!DB_EXCLUDED.has(normalizeRulePath(path)),
		isTestSide: (path) => path.startsWith("packages/db/src/__tests__/"),
	},
	"web-node": {
		configFile: "apps/web/vitest.node.stryker.config.ts",
		root: "apps/web",
		timeoutMS: 20_000,
		isSubject: (path) =>
			WEB_NODE_SOURCE.test(path) &&
			!TEST_PATH.test(path) &&
			!DECLARATION.test(path) &&
			!WEB_NODE_EXCLUDED.has(path),
		isTestSide: (path) => WEB_NODE_TEST.test(path),
	},
};

export const PROJECT_NAMES = Object.keys(PROJECTS) as ProjectName[];

export function isProjectName(value: string): value is ProjectName {
	return Object.hasOwn(PROJECTS, value);
}

export function subjectForTest(path: string): string | null {
	if (TEST_IN_DIR.test(path)) {
		return path.replace(TEST_IN_DIR, "/$1$2");
	}
	if (TEST_SIBLING.test(path)) {
		return path.replace(TEST_SIBLING, "$1");
	}
	return null;
}

function emptyPlans(): Record<ProjectName, ChangedPlan> {
	return {
		api: { files: new Set(), whole: false },
		db: { files: new Set(), whole: false },
		"web-node": { files: new Set(), whole: false },
	};
}

function planTestSide(
	project: MutationProject,
	plan: ChangedPlan,
	path: string,
	exists: (path: string) => boolean
): void {
	const subject = subjectForTest(path);
	if (subject === null || !exists(subject)) {
		plan.whole = true;
		return;
	}
	if (project.isSubject(subject)) {
		plan.files.add(subject);
	}
}

function planPath(
	plans: Record<ProjectName, ChangedPlan>,
	path: string,
	exists: (path: string) => boolean
): void {
	if (GLOBAL_TRIGGERS.test(path)) {
		for (const name of PROJECT_NAMES) {
			plans[name].whole = true;
		}
		return;
	}
	for (const name of PROJECT_NAMES) {
		const project = PROJECTS[name];
		const plan = plans[name];
		if (!path.startsWith(`${project.root}/`)) {
			continue;
		}
		if (PROJECT_TRIGGER_SUFFIX.test(path)) {
			plan.whole = true;
		} else if (project.isSubject(path)) {
			plan.files.add(path);
		} else if (project.isTestSide(path)) {
			planTestSide(project, plan, path, exists);
		}
	}
}

export function classifyChangedFiles(
	changed: string[],
	exists: (path: string) => boolean
): Record<ProjectName, ChangedPlan> {
	const plans = emptyPlans();
	for (const raw of changed) {
		const path = normalizeRulePath(raw.trim());
		if (path.length === 0) {
			continue;
		}
		planPath(plans, path, exists);
	}
	return plans;
}

export function affectedProjects(
	plans: Record<ProjectName, ChangedPlan>
): ProjectName[] {
	return PROJECT_NAMES.filter(
		(name) => plans[name].whole || plans[name].files.size > 0
	);
}

function ratio(numerator: number, denominator: number): number | null {
	if (denominator === 0) {
		return null;
	}
	return Math.round((numerator / denominator) * 10_000) / 100;
}

export function metricsOf(
	report: MutationReport,
	include: (fileName: string) => boolean = () => true
): Metrics {
	const counts = {
		ignored: 0,
		invalid: 0,
		killed: 0,
		noCoverage: 0,
		survived: 0,
		timeout: 0,
	};
	for (const [fileName, file] of Object.entries(report.files)) {
		if (!include(fileName)) {
			continue;
		}
		for (const mutant of file.mutants) {
			tally(counts, mutant.status);
		}
	}
	const detected = counts.killed + counts.timeout;
	const valid = detected + counts.survived + counts.noCoverage;
	return {
		...counts,
		valid,
		score: ratio(detected, valid),
		coveredScore: ratio(detected, detected + counts.survived),
	};
}

function tally(
	counts: {
		ignored: number;
		invalid: number;
		killed: number;
		noCoverage: number;
		survived: number;
		timeout: number;
	},
	status: string
): void {
	switch (status) {
		case "Killed":
			counts.killed += 1;
			break;
		case "Timeout":
			counts.timeout += 1;
			break;
		case "Survived":
			counts.survived += 1;
			break;
		case "NoCoverage":
			counts.noCoverage += 1;
			break;
		case "Ignored":
			counts.ignored += 1;
			break;
		default:
			counts.invalid += 1;
	}
}

export function topSurvivors(
	report: MutationReport,
	include: (fileName: string) => boolean,
	limit: number
): Survivor[] {
	const survivors: Survivor[] = [];
	for (const [fileName, file] of Object.entries(report.files)) {
		if (!include(fileName)) {
			continue;
		}
		for (const mutant of file.mutants) {
			if (mutant.status === "Survived" || mutant.status === "NoCoverage") {
				survivors.push({
					file: normalizeRulePath(fileName),
					line: mutant.location.start.line,
					mutator: mutant.mutatorName,
					status: mutant.status,
				});
			}
		}
	}
	survivors.sort((a, b) =>
		a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)
	);
	return survivors.slice(0, limit);
}

function formatScore(value: number | null): string {
	return value === null ? "n/a" : `${value.toFixed(2)}%`;
}

function formatDelta(row: SummaryRow): string {
	if (!(row.metrics && row.baseline)) {
		return "";
	}
	if (row.metrics.score === null || row.baseline.score === null) {
		return "";
	}
	const delta = row.metrics.score - row.baseline.score;
	const sign = delta >= 0 ? "+" : "";
	return ` (${sign}${delta.toFixed(2)} vs ${formatScore(row.baseline.score)})`;
}

function formatElapsed(elapsedMs: number | null): string {
	if (elapsedMs === null) {
		return "n/a";
	}
	const totalSeconds = Math.round(elapsedMs / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}m${String(seconds).padStart(2, "0")}s`;
}

function summaryLine(row: SummaryRow): string {
	const m = row.metrics;
	if (!m) {
		return `| ${row.project} | ${row.mode} | no report | | | | | | |`;
	}
	const cores = row.cores === null ? "" : String(row.cores);
	return `| ${row.project} | ${row.mode} | ${formatScore(m.score)}${formatDelta(row)} | ${formatScore(m.coveredScore)} | ${m.killed + m.timeout} | ${m.survived} | ${m.noCoverage} | ${formatElapsed(row.elapsedMs)} | ${cores} |`;
}

export function renderSummary(
	rows: SummaryRow[],
	options: { planned?: string[]; runUrl?: string; sha?: string } = {}
): string {
	const lines = [
		"## Mutation Report",
		"",
		"| Project | Mode | Score | Covered | Detected | Survived | No coverage | Elapsed | Cores |",
		"|---|---|---|---|---|---|---|---|---|",
	];
	const reported = new Set(rows.map((row) => row.project));
	for (const row of rows) {
		lines.push(summaryLine(row));
	}
	for (const project of options.planned ?? []) {
		if (!reported.has(project as ProjectName)) {
			lines.push(`| ${project} | planned | no report | | | | | | |`);
		}
	}
	const survivors = rows.flatMap((row) => row.survivors);
	if (survivors.length > 0) {
		lines.push("", "### Surviving mutants (changed files)", "");
		for (const survivor of survivors) {
			lines.push(
				`- \`${survivor.file}:${survivor.line}\` ${survivor.mutator} (${survivor.status})`
			);
		}
	}
	lines.push("");
	if (options.runUrl) {
		lines.push(`[Workflow run](${options.runUrl})`, "");
	}
	lines.push(
		"Report-only: this comment never fails the PR. Baseline: docs/design/testing-and-tooling.md#mutation-testing-stryker"
	);
	if (options.sha) {
		lines.push("", `_Last run: ${options.sha}_`);
	}
	return `${lines.join("\n")}\n`;
}
