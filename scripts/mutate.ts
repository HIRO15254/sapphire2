import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Glob } from "bun";

import { normalizeRulePath } from "./check-rules-path";
import {
	affectedProjects,
	classifyChangedFiles,
	isProjectName,
	type Metrics,
	type MutationReport,
	metricsOf,
	PROJECT_NAMES,
	PROJECTS,
	type ProjectName,
	renderSummary,
	type SummaryRow,
	topSurvivors,
} from "./mutate-projects";

interface RunRecord {
	affected: boolean;
	base: string | null;
	baseline: Metrics | null;
	cores: number;
	elapsedMs: number;
	exitCode: number;
	hadIncremental: boolean;
	mode: "all" | "changed" | "files";
	mutate: string[];
	project: ProjectName;
	sha: string | null;
	startedAt: string;
	whole: boolean;
}

const ROOT = process.cwd();
const REPORT_ROOT = "reports/mutation";
const SUBCOMMANDS = new Set(["run", "plan", "summary"]);
const NODE_MAJOR = /^v(\d+)\./;
const RUNNER_SETUP_FILE = /^stryker-setup-\d+\.js$/;
const MIN_NODE_MAJOR = 22;

const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const subcommand =
	rawArgs[0] !== undefined && SUBCOMMANDS.has(rawArgs[0])
		? (rawArgs.shift() as string)
		: "run";

const { values } = parseArgs({
	args: rawArgs,
	allowPositionals: true,
	options: {
		all: { type: "boolean", default: false },
		base: { type: "string", default: "origin/dev" },
		changed: { type: "boolean", default: false },
		concurrency: { type: "string" },
		"dry-run": { type: "boolean", default: false },
		force: { type: "boolean", default: false },
		mutate: { type: "string", multiple: true, default: [] },
		"no-incremental": { type: "boolean", default: false },
		planned: { type: "string" },
		project: { type: "string", multiple: true, default: [] },
		"run-url": { type: "string" },
		top: { type: "string", default: "10" },
	},
});

function fail(message: string): never {
	console.error(`mutate: ${message}`);
	process.exit(2);
}

function git(args: string[]): string {
	const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
	if (result.status !== 0) {
		fail(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
	}
	return result.stdout;
}

function gitLines(args: string[]): string[] {
	return git(args)
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function currentSha(): string | null {
	const result = spawnSync("git", ["rev-parse", "HEAD"], {
		cwd: ROOT,
		encoding: "utf8",
	});
	return result.status === 0 ? result.stdout.trim() : null;
}

function collectChanged(base: string): string[] {
	const mergeBase = spawnSync("git", ["merge-base", base, "HEAD"], {
		cwd: ROOT,
		encoding: "utf8",
	});
	if (mergeBase.status !== 0) {
		fail(`base ${base} not found; run: git fetch origin dev`);
	}
	const changed = new Set<string>([
		...gitLines([
			"diff",
			"--name-only",
			"--diff-filter=ACMR",
			`${base}...HEAD`,
		]),
		...gitLines(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]),
		...gitLines(["ls-files", "--others", "--exclude-standard"]),
	]);
	return [...changed].map(normalizeRulePath);
}

function existsInRepo(path: string): boolean {
	return existsSync(join(ROOT, path));
}

function enumerateSubjects(project: ProjectName): string[] {
	const { root, isSubject } = PROJECTS[project];
	const files: string[] = [];
	for (const scanned of new Glob("src/**/*.ts").scanSync({
		cwd: join(ROOT, root),
	})) {
		const path = normalizeRulePath(`${root}/${scanned}`);
		if (isSubject(path)) {
			files.push(path);
		}
	}
	return files.sort();
}

function requestedProjects(): ProjectName[] {
	const names: ProjectName[] = [];
	for (const value of values.project) {
		if (!isProjectName(value)) {
			fail(
				`unknown project ${value}; expected one of ${PROJECT_NAMES.join(", ")}`
			);
		}
		names.push(value);
	}
	return names;
}

function ensureNode(): void {
	const result = spawnSync("node", ["--version"], { encoding: "utf8" });
	const major = Number(NODE_MAJOR.exec(result.stdout ?? "")?.[1]);
	if (result.status !== 0 || Number.isNaN(major)) {
		fail(
			"node is required to host Stryker (see docs/design/testing-and-tooling.md#mutation-testing-stryker)"
		);
	}
	if (major < MIN_NODE_MAJOR) {
		fail(
			`Stryker needs Node ${MIN_NODE_MAJOR}+ (found ${result.stdout.trim()}); see docs/design/testing-and-tooling.md#mutation-testing-stryker`
		);
	}
}

function resolveRunnerEntry(): string {
	try {
		return fileURLToPath(import.meta.resolve("@stryker-mutator/vitest-runner"));
	} catch {
		const fallback = join(
			ROOT,
			"node_modules/@stryker-mutator/vitest-runner/dist/src/index.js"
		);
		if (existsSync(fallback)) {
			return fallback;
		}
		return fail(
			"@stryker-mutator/vitest-runner is not installed; run bun install"
		);
	}
}

function resolveStrykerBin(): string {
	const bin = join(ROOT, "node_modules/@stryker-mutator/core/bin/stryker.js");
	if (!existsSync(bin)) {
		fail("@stryker-mutator/core is not installed; run bun install");
	}
	return bin;
}

function ensureNoStaleBackup(): void {
	const tempDir = join(ROOT, ".stryker-tmp");
	if (!existsSync(tempDir)) {
		return;
	}
	const leftovers = readdirSync(tempDir).filter((entry) =>
		entry.startsWith("backup-")
	);
	if (leftovers.length > 0) {
		fail(
			`previous in-place run did not restore (${tempDir}/${leftovers[0]}); inspect it, then git status and git checkout -- <files>`
		);
	}
}

function removeRunnerSetupFiles(): void {
	for (const entry of readdirSync(ROOT)) {
		if (RUNNER_SETUP_FILE.test(entry)) {
			rmSync(join(ROOT, entry), { force: true });
		}
	}
}

function readReport(path: string): MutationReport | null {
	if (!existsSync(path)) {
		return null;
	}
	try {
		return JSON.parse(readFileSync(path, "utf8")) as MutationReport;
	} catch {
		return null;
	}
}

function buildConfig(
	project: ProjectName,
	files: string[],
	runnerEntry: string,
	reportDir: string
): Record<string, unknown> {
	const { configFile, root, timeoutMS } = PROJECTS[project];
	const isTty = process.stdout.isTTY === true;
	const concurrency =
		values.concurrency === undefined
			? availableParallelism()
			: Number(values.concurrency);
	return {
		testRunner: "vitest",
		plugins: [runnerEntry],
		vitest: { configFile, dir: root, related: true },
		mutate: files,
		inPlace: true,
		tempDirName: ".stryker-tmp",
		cleanTempDir: true,
		coverageAnalysis: "perTest",
		ignoreStatic: true,
		disableTypeChecks: `${root}/src/**/*.{ts,tsx}`,
		checkers: [],
		incremental: !values["no-incremental"],
		incrementalFile: `${reportDir}/stryker-incremental.json`,
		force: values.force,
		allowEmpty: true,
		reporters: isTty
			? ["clear-text", "json", "html", "progress"]
			: ["clear-text", "json", "html"],
		jsonReporter: { fileName: `${reportDir}/report.json` },
		htmlReporter: { fileName: `${reportDir}/index.html` },
		clearTextReporter: {
			allowColor: isTty,
			logTests: false,
			reportTests: false,
			maxTestsToLog: 0,
			reportMutants: true,
			reportScoreTable: true,
			skipFull: true,
		},
		timeoutMS,
		timeoutFactor: 1.5,
		dryRunTimeoutMinutes: 10,
		concurrency,
		thresholds: { high: 80, low: 60, break: 0 },
		dryRunOnly: values["dry-run"],
		logLevel: "info",
		fileLogLevel: "off",
	};
}

function writeRun(reportDir: string, record: RunRecord): void {
	writeFileSync(
		join(ROOT, reportDir, "run.json"),
		`${JSON.stringify(record, null, "\t")}\n`
	);
}

interface RunRequest {
	base: string | null;
	files: string[];
	mode: RunRecord["mode"];
	project: ProjectName;
	whole: boolean;
}

function runProject(
	request: RunRequest,
	tooling: { bin: string; runner: string }
): number {
	const reportDir = `${REPORT_ROOT}/${request.project}`;
	mkdirSync(join(ROOT, reportDir), { recursive: true });
	const incrementalPath = join(ROOT, reportDir, "stryker-incremental.json");
	const previous = values["no-incremental"]
		? null
		: readReport(incrementalPath);
	const baseline = previous ? metricsOf(previous) : null;
	const startedAt = new Date();
	const record: RunRecord = {
		affected: request.files.length > 0,
		base: request.base,
		baseline,
		cores: availableParallelism(),
		elapsedMs: 0,
		exitCode: 0,
		hadIncremental: previous !== null,
		mode: request.mode,
		mutate: request.files,
		project: request.project,
		sha: currentSha(),
		startedAt: startedAt.toISOString(),
		whole: request.whole,
	};
	if (request.files.length === 0) {
		writeRun(reportDir, record);
		console.log(`mutate: ${request.project} not affected`);
		return 0;
	}
	const configPath = join(ROOT, reportDir, "stryker.config.json");
	writeFileSync(
		configPath,
		`${JSON.stringify(buildConfig(request.project, request.files, tooling.runner, reportDir), null, "\t")}\n`
	);
	console.log(
		`mutate: ${request.project} (${request.mode}) — ${request.files.length} file(s)`
	);
	const result = spawnSync("node", [tooling.bin, "run", configPath], {
		cwd: ROOT,
		stdio: "inherit",
	});
	record.exitCode = result.status ?? 1;
	record.elapsedMs = Date.now() - startedAt.getTime();
	writeRun(reportDir, record);
	removeRunnerSetupFiles();
	return record.exitCode;
}

function requestsForChanged(projects: ProjectName[]): RunRequest[] {
	const base = values.base;
	const plans = classifyChangedFiles(collectChanged(base), existsInRepo);
	const targets = projects.length > 0 ? projects : affectedProjects(plans);
	return targets.map((project) => {
		const plan = plans[project];
		const files = plan.whole
			? enumerateSubjects(project)
			: [...plan.files].sort();
		return { base, files, mode: "changed", project, whole: plan.whole };
	});
}

function requestsForFiles(): RunRequest[] {
	const byProject = new Map<ProjectName, string[]>();
	for (const raw of values.mutate) {
		const path = normalizeRulePath(raw);
		const owner = PROJECT_NAMES.find((name) => PROJECTS[name].isSubject(path));
		if (owner === undefined) {
			fail(`${path} is not a mutation subject of any project`);
		}
		byProject.set(owner, [...(byProject.get(owner) ?? []), path]);
	}
	return [...byProject.entries()].map(([project, files]) => ({
		base: null,
		files: files.sort(),
		mode: "files",
		project,
		whole: false,
	}));
}

function requestsForAll(projects: ProjectName[]): RunRequest[] {
	if (projects.length === 0) {
		fail("--all needs --project <api|db|web-node>");
	}
	return projects.map((project) => ({
		base: null,
		files: enumerateSubjects(project),
		mode: "all",
		project,
		whole: true,
	}));
}

function buildRequests(): RunRequest[] {
	const projects = requestedProjects();
	const modes = [values.all, values.changed, values.mutate.length > 0].filter(
		Boolean
	).length;
	if (modes > 1) {
		fail("use only one of --all, --changed, --mutate");
	}
	if (values.all) {
		return requestsForAll(projects);
	}
	if (values.mutate.length > 0) {
		return requestsForFiles();
	}
	return requestsForChanged(projects);
}

function run(): number {
	const requests = buildRequests();
	ensureNode();
	ensureNoStaleBackup();
	const tooling = { bin: resolveStrykerBin(), runner: resolveRunnerEntry() };
	let exitCode = 0;
	for (const request of requests) {
		const code = runProject(request, tooling);
		if (code !== 0) {
			exitCode = code;
		}
	}
	return exitCode;
}

function plan(): number {
	const plans = classifyChangedFiles(collectChanged(values.base), existsInRepo);
	console.log(JSON.stringify(affectedProjects(plans)));
	return 0;
}

function readRun(project: ProjectName): RunRecord | null {
	const path = join(ROOT, REPORT_ROOT, project, "run.json");
	if (!existsSync(path)) {
		return null;
	}
	return JSON.parse(readFileSync(path, "utf8")) as RunRecord;
}

function rowFor(
	project: ProjectName,
	record: RunRecord,
	top: number
): SummaryRow {
	const report = readReport(join(ROOT, REPORT_ROOT, project, "report.json"));
	const mutated = new Set(record.mutate);
	const includeChanged = (fileName: string) =>
		mutated.has(normalizeRulePath(fileName));
	const wholeProject = record.mode === "all" || record.hadIncremental;
	return {
		baseline: record.baseline,
		cores: record.cores,
		elapsedMs: record.elapsedMs,
		metrics: report
			? metricsOf(report, wholeProject ? undefined : includeChanged)
			: null,
		mode: wholeProject ? record.mode : `${record.mode} (changed files only)`,
		project,
		survivors: report ? topSurvivors(report, includeChanged, top) : [],
	};
}

function summary(): number {
	const top = Number(values.top);
	const rows: SummaryRow[] = [];
	for (const project of PROJECT_NAMES) {
		const record = readRun(project);
		if (record?.affected) {
			rows.push(rowFor(project, record, top));
		}
	}
	const planned = values.planned
		? (JSON.parse(values.planned) as string[])
		: [];
	const markdown = renderSummary(rows, {
		planned,
		runUrl: values["run-url"],
		sha: currentSha() ?? undefined,
	});
	mkdirSync(join(ROOT, REPORT_ROOT), { recursive: true });
	writeFileSync(join(ROOT, REPORT_ROOT, "summary.md"), markdown);
	console.log(markdown);
	return 0;
}

const handlers: Record<string, () => number> = { plan, run, summary };
const handler = handlers[subcommand];
if (handler === undefined) {
	fail(`unknown subcommand ${subcommand}`);
}
process.exit(handler());
