import {
	affectedProjects,
	classifyChangedFiles,
	metricsOf,
	renderSummary,
	subjectForTest,
	topSurvivors,
} from "../../../../../scripts/mutate-projects";

const existing = new Set([
	"apps/web/src/features/rooms/utils/game-format.ts",
	"apps/web/src/features/auth/utils/login-continuation.ts",
	"packages/db/src/constants/session-event-types.ts",
]);
const exists = (path: string) => existing.has(path);

describe("subjectForTest", () => {
	it("maps a __tests__ spec to the sibling implementation", () => {
		expect(
			subjectForTest(
				"apps/web/src/features/rooms/utils/__tests__/game-format.test.ts"
			)
		).toBe("apps/web/src/features/rooms/utils/game-format.ts");
	});

	it("maps a colocated .test.tsx to its component", () => {
		expect(subjectForTest("apps/web/src/features/x/panel.test.tsx")).toBe(
			"apps/web/src/features/x/panel.tsx"
		);
	});

	it("returns null for a shared helper that is not a spec", () => {
		expect(
			subjectForTest("packages/api/src/__tests__/test-utils.ts")
		).toBeNull();
	});
});

describe("classifyChangedFiles", () => {
	it("maps a changed web util test to its sibling subject", () => {
		const plans = classifyChangedFiles(
			["apps/web/src/features/rooms/utils/__tests__/game-format.test.ts"],
			exists
		);
		expect(plans["web-node"]).toEqual({
			files: new Set(["apps/web/src/features/rooms/utils/game-format.ts"]),
			whole: false,
		});
		expect(affectedProjects(plans)).toEqual(["web-node"]);
	});

	it("widens to the whole project when a spec has no sibling subject", () => {
		const plans = classifyChangedFiles(
			[
				"packages/api/src/__tests__/test-utils.ts",
				"packages/db/src/__tests__/session-event-types.test.ts",
			],
			exists
		);
		expect(plans.api.whole).toBe(true);
		expect(plans.db.whole).toBe(true);
		expect(plans["web-node"].whole).toBe(false);
	});

	it("ignores a spec whose sibling exists but is excluded from mutation", () => {
		const plans = classifyChangedFiles(
			["apps/web/src/features/auth/utils/__tests__/login-continuation.test.ts"],
			exists
		);
		expect(affectedProjects(plans)).toEqual([]);
	});

	it("ignores the db data table excluded from mutation subjects", () => {
		const plans = classifyChangedFiles(
			["packages/db/src/constants/player-tag-colors.ts"],
			exists
		);
		expect(affectedProjects(plans)).toEqual([]);
	});

	it("ignores the api wiring files excluded from mutation subjects", () => {
		const plans = classifyChangedFiles(
			["packages/api/src/context.ts", "packages/api/src/routers/index.ts"],
			exists
		);
		expect(affectedProjects(plans)).toEqual([]);
	});

	it("ignores paths outside every mutation project", () => {
		const plans = classifyChangedFiles(
			[
				"apps/web/src/features/rooms/pages/rooms-page/rooms-page.tsx",
				"packages/db/src/schema/session.ts",
				"docs/design/testing-and-tooling.md",
				"",
			],
			exists
		);
		expect(affectedProjects(plans)).toEqual([]);
	});

	it("widens every project on a root lockfile or vitest config change", () => {
		const plans = classifyChangedFiles(["bun.lock"], exists);
		expect(affectedProjects(plans)).toEqual(["api", "db", "web-node"]);
		expect(plans.api.whole && plans.db.whole && plans["web-node"].whole).toBe(
			true
		);
	});

	it("widens only the owning project on its own package.json", () => {
		const plans = classifyChangedFiles(["packages/api/package.json"], exists);
		expect(affectedProjects(plans)).toEqual(["api"]);
	});

	it("collects changed implementation files per project", () => {
		const plans = classifyChangedFiles(
			[
				"packages/db/src/constants/session-event-types.ts",
				"packages/api/src/routers/session.ts",
				"packages/api/src/routers/session.ts",
			],
			exists
		);
		expect([...plans.api.files]).toEqual([
			"packages/api/src/routers/session.ts",
		]);
		expect([...plans.db.files]).toEqual([
			"packages/db/src/constants/session-event-types.ts",
		]);
	});
});

const report = {
	files: {
		"packages/db/src/constants/a.ts": {
			mutants: [
				{
					status: "Killed",
					mutatorName: "A",
					location: { start: { line: 3 } },
				},
				{
					status: "Killed",
					mutatorName: "A",
					location: { start: { line: 4 } },
				},
				{
					status: "Killed",
					mutatorName: "A",
					location: { start: { line: 5 } },
				},
				{
					status: "Timeout",
					mutatorName: "B",
					location: { start: { line: 6 } },
				},
				{
					status: "Survived",
					mutatorName: "C",
					location: { start: { line: 9 } },
				},
				{
					status: "Survived",
					mutatorName: "C",
					location: { start: { line: 7 } },
				},
				{
					status: "NoCoverage",
					mutatorName: "D",
					location: { start: { line: 12 } },
				},
				{
					status: "NoCoverage",
					mutatorName: "D",
					location: { start: { line: 11 } },
				},
				{
					status: "Ignored",
					mutatorName: "E",
					location: { start: { line: 1 } },
				},
				{
					status: "Ignored",
					mutatorName: "E",
					location: { start: { line: 1 } },
				},
				{
					status: "Ignored",
					mutatorName: "E",
					location: { start: { line: 1 } },
				},
				{
					status: "Ignored",
					mutatorName: "E",
					location: { start: { line: 1 } },
				},
				{
					status: "CompileError",
					mutatorName: "F",
					location: { start: { line: 2 } },
				},
			],
		},
	},
};

describe("metricsOf", () => {
	it("treats NoCoverage as undetected and keeps Ignored and invalid mutants out of the denominator", () => {
		expect(metricsOf(report)).toEqual({
			coveredScore: 66.67,
			ignored: 4,
			invalid: 1,
			killed: 3,
			noCoverage: 2,
			score: 50,
			survived: 2,
			timeout: 1,
			valid: 8,
		});
	});

	it("reports a null score when no valid mutant is included", () => {
		expect(metricsOf(report, () => false).score).toBeNull();
	});
});

describe("topSurvivors", () => {
	it("lists Survived and NoCoverage mutants in file and line order, capped by the limit", () => {
		expect(topSurvivors(report, () => true, 3)).toEqual([
			{
				file: "packages/db/src/constants/a.ts",
				line: 7,
				mutator: "C",
				status: "Survived",
			},
			{
				file: "packages/db/src/constants/a.ts",
				line: 9,
				mutator: "C",
				status: "Survived",
			},
			{
				file: "packages/db/src/constants/a.ts",
				line: 11,
				mutator: "D",
				status: "NoCoverage",
			},
		]);
	});
});

describe("renderSummary", () => {
	it("renders the sticky-comment heading, one row per project, planned gaps, survivors and the run link", () => {
		const markdown = renderSummary(
			[
				{
					baseline: { ...metricsOf(report), score: 40 },
					cores: 4,
					elapsedMs: 83_000,
					metrics: metricsOf(report),
					mode: "changed",
					project: "db",
					survivors: topSurvivors(report, () => true, 1),
				},
			],
			{
				planned: ["db", "api"],
				runUrl: "https://example.test/run/1",
				sha: "abc123",
			}
		);
		expect(markdown).toContain("## Mutation Report\n");
		expect(markdown).toContain(
			"| db | changed | 50.00% (+10.00 vs 40.00%) | 66.67% | 4 | 2 | 2 | 1m23s | 4 |"
		);
		expect(markdown).toContain("| api | planned | no report |");
		expect(markdown).toContain(
			"- `packages/db/src/constants/a.ts:7` C (Survived)"
		);
		expect(markdown).toContain("[Workflow run](https://example.test/run/1)");
		expect(markdown).toContain("_Last run: abc123_");
	});

	it("marks a project without a report", () => {
		const markdown = renderSummary([
			{
				baseline: null,
				cores: null,
				elapsedMs: null,
				metrics: null,
				mode: "all",
				project: "api",
				survivors: [],
			},
		]);
		expect(markdown).toContain("| api | all | no report |");
		expect(markdown).not.toContain("Surviving mutants");
	});
});
