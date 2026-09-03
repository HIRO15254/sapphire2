import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { Glob } from "bun";
import { normalizeRulePath } from "./check-rules-path";
import {
	type Metrics,
	type MutationReport,
	metricsOf,
	PROJECT_NAMES,
	type ProjectName,
} from "./mutate-projects";
import {
	compareFileScores,
	type FileScoreDelta,
	fileScores,
	largeSpecs,
	type SpecStats,
	specStats,
	untestedSources,
} from "./test-metrics-lib";

const ROOT = dirname(import.meta.dir);
const VITEST_PROJECTS = [
	"web-dom",
	"web-node",
	"server",
	"api",
	"db",
	"mcp",
	"env",
] as const;
const WORKSPACES = [
	"apps/web",
	"apps/server",
	"packages/api",
	"packages/db",
	"packages/mcp",
	"packages/env",
] as const;
const SPEC_GLOB = "**/*.test.{ts,tsx}";
const SOURCE_GLOBS = [
	"apps/web/src/**/use-*.ts",
	"apps/web/src/**/utils/**/*.ts",
	"apps/web/src/shared/lib/**/*.ts",
	"apps/server/src/**/*.ts",
	"packages/mcp/src/**/*.ts",
];
const SOURCE_EXCLUDED =
	/(?:^|\/)(?:__tests__\/|index\.ts$|types\.ts$|routeTree\.gen\.ts$)|\.d\.ts$|\.test\.tsx?$/;
const IGNORED_DIRS = /(?:^|\/)(?:node_modules|dist|\.wrangler|\.stryker-tmp)\//;

interface WorkspaceMetrics {
	asNever: number;
	its: number;
	reactQueryMockFiles: string[];
	specFiles: number;
	workspace: string;
}

interface ProjectMutation {
	metrics: Metrics;
	project: ProjectName;
	worst: { file: string; metrics: Metrics }[];
}

interface Snapshot {
	collected: Record<string, number | null>;
	durationsMs: Record<string, number>;
	large: { byIts: SpecStats[]; byLines: SpecStats[] };
	mutation: ProjectMutation[];
	sha: string;
	untested: string[];
	workspaces: WorkspaceMetrics[];
}

const { values } = parseArgs({
	allowPositionals: true,
	args: process.argv.slice(2),
	options: {
		compare: { type: "string" },
		durations: { type: "boolean", default: false },
		json: { type: "boolean", default: false },
		out: { type: "string", default: "reports" },
		"skip-list": { type: "boolean", default: false },
	},
});

function scan(pattern: string, cwd: string): string[] {
	return [...new Glob(pattern).scanSync({ cwd, dot: false })]
		.map((path) => normalizeRulePath(path))
		.filter((path) => !IGNORED_DIRS.test(path))
		.sort();
}

function readSpecs(): { path: string; text: string }[] {
	const specs: { path: string; text: string }[] = [];
	for (const workspace of WORKSPACES) {
		for (const relative of scan(SPEC_GLOB, join(ROOT, workspace))) {
			const path = `${workspace}/${relative}`;
			specs.push({ path, text: readFileSync(join(ROOT, path), "utf8") });
		}
	}
	return specs;
}

function workspaceMetrics(
	stats: SpecStats[],
	workspace: string
): WorkspaceMetrics {
	const own = stats.filter((s) => s.path.startsWith(`${workspace}/`));
	return {
		asNever: own.reduce((n, s) => n + s.asNever, 0),
		its: own.reduce((n, s) => n + s.its, 0),
		reactQueryMockFiles: own
			.filter((s) => s.mocksReactQuery)
			.map((s) => s.path),
		specFiles: own.length,
		workspace,
	};
}

function collectedCount(project: string): number | null {
	const result = spawnSync(
		"bunx",
		["vitest", "list", "--project", project, "--json"],
		{ cwd: ROOT, encoding: "utf8" }
	);
	if (result.status !== 0) {
		return null;
	}
	const text = result.stdout;
	const start = text.indexOf("[");
	if (start < 0) {
		return null;
	}
	try {
		return (JSON.parse(text.slice(start)) as unknown[]).length;
	} catch {
		return null;
	}
}

function runDuration(project: string): number {
	const started = performance.now();
	spawnSync("bunx", ["vitest", "run", "--project", project], {
		cwd: ROOT,
		encoding: "utf8",
	});
	return Math.round(performance.now() - started);
}

function readReport(dir: string, project: ProjectName): MutationReport | null {
	const path = join(dir, project, "report.json");
	if (!existsSync(path)) {
		return null;
	}
	return JSON.parse(readFileSync(path, "utf8")) as MutationReport;
}

function mutationRows(dir: string): ProjectMutation[] {
	const rows: ProjectMutation[] = [];
	for (const project of PROJECT_NAMES) {
		const report = readReport(dir, project);
		if (!report) {
			continue;
		}
		rows.push({
			metrics: metricsOf(report),
			project,
			worst: fileScores(report)
				.filter((f) => f.metrics.valid >= 10)
				.slice(0, 10),
		});
	}
	return rows;
}

function sources(): string[] {
	const found = new Set<string>();
	for (const pattern of SOURCE_GLOBS) {
		for (const path of scan(pattern, ROOT)) {
			if (!SOURCE_EXCLUDED.test(path)) {
				found.add(path);
			}
		}
	}
	return [...found].sort();
}

function gitSha(): string {
	const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
		cwd: ROOT,
		encoding: "utf8",
	});
	return result.stdout.trim();
}

function snapshot(): Snapshot {
	const specs = readSpecs();
	const stats = specs.map((spec) => specStats(spec.path, spec.text));
	const collected: Record<string, number | null> = {};
	const durationsMs: Record<string, number> = {};
	for (const project of VITEST_PROJECTS) {
		collected[project] = values["skip-list"] ? null : collectedCount(project);
		if (values.durations) {
			durationsMs[project] = runDuration(project);
		}
	}
	return {
		collected,
		durationsMs,
		large: largeSpecs(stats),
		mutation: mutationRows(join(ROOT, "reports", "mutation")),
		sha: gitSha(),
		untested: untestedSources(sources(), specs),
		workspaces: WORKSPACES.map((w) => workspaceMetrics(stats, w)),
	};
}

function pct(value: number | null): string {
	return value === null ? "n/a" : `${value.toFixed(2)} %`;
}

function num(value: number | null | undefined): string {
	return value === null || value === undefined
		? "n/a"
		: value.toLocaleString("en-US");
}

function renderSnapshot(snap: Snapshot): string {
	const lines: string[] = [
		"## Test metrics",
		"",
		`Commit: \`${snap.sha}\``,
		"",
	];
	lines.push(
		"| Workspace | Spec files | it() | as never | react-query wholesale mocks |"
	);
	lines.push("|---|---|---|---|---|");
	for (const w of snap.workspaces) {
		lines.push(
			`| ${w.workspace} | ${num(w.specFiles)} | ${num(w.its)} | ${num(w.asNever)} | ${num(w.reactQueryMockFiles.length)} |`
		);
	}
	lines.push(
		"",
		"| Vitest project | Collected tests | Duration |",
		"|---|---|---|"
	);
	for (const project of VITEST_PROJECTS) {
		const duration = snap.durationsMs[project];
		lines.push(
			`| ${project} | ${num(snap.collected[project])} | ${duration === undefined ? "n/a" : `${(duration / 1000).toFixed(1)} s`} |`
		);
	}
	if (snap.mutation.length > 0) {
		lines.push(
			"",
			"| Mutation project | Score | Covered | Killed | Survived | No coverage | Valid |",
			"|---|---|---|---|---|---|---|"
		);
		for (const row of snap.mutation) {
			const m = row.metrics;
			lines.push(
				`| ${row.project} | ${pct(m.score)} | ${pct(m.coveredScore)} | ${num(m.killed + m.timeout)} | ${num(m.survived)} | ${num(m.noCoverage)} | ${num(m.valid)} |`
			);
		}
		for (const row of snap.mutation) {
			lines.push("", `Lowest-scoring ${row.project} files (valid >= 10):`, "");
			for (const f of row.worst) {
				lines.push(
					`- \`${f.file}\` ${pct(f.metrics.score)} (${f.metrics.killed + f.metrics.timeout}/${f.metrics.valid}, no coverage ${f.metrics.noCoverage})`
				);
			}
		}
	}
	lines.push("", `Untested source files (${snap.untested.length}):`, "");
	for (const file of snap.untested) {
		lines.push(`- \`${file}\``);
	}
	lines.push("", `Specs over 30 it() (${snap.large.byIts.length}):`, "");
	for (const s of snap.large.byIts) {
		lines.push(`- \`${s.path}\` ${s.its} it(), ${s.lines} lines`);
	}
	lines.push("", `Specs over 600 lines (${snap.large.byLines.length}):`, "");
	for (const s of snap.large.byLines) {
		lines.push(`- \`${s.path}\` ${s.lines} lines, ${s.its} it()`);
	}
	const mocks = snap.workspaces.flatMap((w) => w.reactQueryMockFiles);
	lines.push(
		"",
		`Component specs mocking @tanstack/react-query wholesale (${mocks.length}):`,
		""
	);
	for (const file of mocks) {
		lines.push(`- \`${file}\``);
	}
	return `${lines.join("\n")}\n`;
}

function delta(
	before: number | null | undefined,
	after: number | null | undefined
): string {
	if (
		before === null ||
		before === undefined ||
		after === null ||
		after === undefined
	) {
		return `${num(before)} → ${num(after)}`;
	}
	const sign = after - before >= 0 ? "+" : "";
	return `${num(before)} → ${num(after)} (${sign}${num(after - before)})`;
}

function renderComparison(
	before: Snapshot,
	after: Snapshot,
	drops: FileScoreDelta[]
): string {
	const lines: string[] = [
		"## Test metrics — before / after",
		"",
		`Before: \`${before.sha}\`, after: \`${after.sha}\``,
		"",
		"| Workspace | it() | as never | react-query mocks |",
		"|---|---|---|---|",
	];
	for (const w of after.workspaces) {
		const b = before.workspaces.find((x) => x.workspace === w.workspace);
		lines.push(
			`| ${w.workspace} | ${delta(b?.its, w.its)} | ${delta(b?.asNever, w.asNever)} | ${delta(b?.reactQueryMockFiles.length, w.reactQueryMockFiles.length)} |`
		);
	}
	lines.push(
		"",
		"| Vitest project | Collected | Duration (s) |",
		"|---|---|---|"
	);
	for (const project of VITEST_PROJECTS) {
		const bd = before.durationsMs[project];
		const ad = after.durationsMs[project];
		lines.push(
			`| ${project} | ${delta(before.collected[project], after.collected[project])} | ${bd === undefined || ad === undefined ? "n/a" : `${(bd / 1000).toFixed(1)} → ${(ad / 1000).toFixed(1)}`} |`
		);
	}
	lines.push(
		"",
		"| Mutation project | Score | Covered | Survived | No coverage |",
		"|---|---|---|---|---|"
	);
	for (const row of after.mutation) {
		const b = before.mutation.find((x) => x.project === row.project)?.metrics;
		lines.push(
			`| ${row.project} | ${pct(b?.score ?? null)} → ${pct(row.metrics.score)} | ${pct(b?.coveredScore ?? null)} → ${pct(row.metrics.coveredScore)} | ${delta(b?.survived, row.metrics.survived)} | ${delta(b?.noCoverage, row.metrics.noCoverage)} |`
		);
	}
	lines.push(
		"",
		`Untested source files: ${delta(before.untested.length, after.untested.length)}`
	);
	const real = drops.filter((d) => d.real);
	lines.push(
		"",
		`Files whose score dropped with more survived / no-coverage mutants (${real.length}):`,
		""
	);
	for (const d of real) {
		lines.push(
			`- \`${d.file}\` ${pct(d.before.score)} → ${pct(d.after.score)} (survived ${d.survivedDelta >= 0 ? "+" : ""}${d.survivedDelta}, no coverage ${d.noCoverageDelta >= 0 ? "+" : ""}${d.noCoverageDelta})`
		);
	}
	return `${lines.join("\n")}\n`;
}

function compare(beforeDir: string, after: Snapshot): string {
	const before = JSON.parse(
		readFileSync(join(beforeDir, "test-metrics.json"), "utf8")
	) as Snapshot;
	const drops: FileScoreDelta[] = [];
	for (const project of PROJECT_NAMES) {
		const b = readReport(beforeDir, project);
		const a = readReport(join(ROOT, "reports", "mutation"), project);
		if (b && a) {
			drops.push(...compareFileScores(b, a));
		}
	}
	return renderComparison(before, after, drops);
}

const snap = snapshot();
const outDir = join(ROOT, values.out ?? "reports");
mkdirSync(outDir, { recursive: true });
writeFileSync(
	join(outDir, "test-metrics.json"),
	`${JSON.stringify(snap, null, "\t")}\n`
);
const markdown = values.compare
	? compare(values.compare, snap)
	: renderSnapshot(snap);
writeFileSync(join(outDir, "test-metrics.md"), markdown);
if (values.json) {
	process.stdout.write(`${JSON.stringify(snap)}\n`);
} else {
	process.stdout.write(markdown);
}
