import { describe, expect, it } from "vitest";
import type { MutationReport } from "../../../../../scripts/mutate-projects";
import {
	compareFileScores,
	countIts,
	isImportedBy,
	largeSpecs,
	siblingSpecCandidates,
	specStats,
	untestedSources,
} from "../../../../../scripts/test-metrics-lib";

function report(files: Record<string, string[]>): MutationReport {
	const out: MutationReport["files"] = {};
	for (const [file, statuses] of Object.entries(files)) {
		out[file] = {
			mutants: statuses.map((status, index) => ({
				location: { start: { line: index + 1 } },
				mutatorName: "ConditionalExpression",
				status,
			})),
		};
	}
	return { files: out };
}

describe("countIts", () => {
	it("counts it, test and it.each call sites but not member accesses", () => {
		const text = [
			'it("a", () => {});',
			'test("b", () => {});',
			'it.each([[1], [2]])("c %s", () => {});',
			"submit(); commit(); visit(x);",
		].join("\n");
		expect(countIts(text)).toBe(3);
	});
});

describe("specStats", () => {
	it("flags a react-query wholesale mock only in component and page specs", () => {
		const text = 'vi.mock("@tanstack/react-query", () => ({}));';
		expect(
			specStats("apps/web/src/features/x/components/y/y.test.tsx", text)
				.mocksReactQuery
		).toBe(true);
		expect(
			specStats("apps/web/src/features/x/hooks/__tests__/use-y.test.ts", text)
				.mocksReactQuery
		).toBe(false);
	});
});

describe("untestedSources", () => {
	it("treats a __tests__ sibling, a same-folder spec, or an import as tested", () => {
		const specs = [
			{ path: "apps/web/src/features/a/utils/__tests__/one.test.ts", text: "" },
			{ path: "apps/web/src/shared/components/two/two.test.tsx", text: "" },
			{
				path: "apps/web/src/features/c/pages/p/__tests__/p.test.tsx",
				text: 'import { useThree } from "../three/use-three";',
			},
		];
		expect(
			untestedSources(
				[
					"apps/web/src/features/a/utils/one.ts",
					"apps/web/src/shared/components/two/use-two.ts",
					"apps/web/src/features/c/pages/p/three/use-three.ts",
					"apps/web/src/features/d/hooks/use-four.ts",
				],
				specs
			)
		).toEqual([
			"apps/web/src/features/d/hooks/use-four.ts",
			"apps/web/src/shared/components/two/use-two.ts",
		]);
	});

	it("derives the four sibling spec candidates for a source file", () => {
		expect(siblingSpecCandidates("apps/web/src/a/use-b.tsx")).toEqual([
			"apps/web/src/a/__tests__/use-b.test.ts",
			"apps/web/src/a/__tests__/use-b.test.tsx",
			"apps/web/src/a/use-b.test.ts",
			"apps/web/src/a/use-b.test.tsx",
		]);
	});

	it("matches an import by the module basename regardless of alias or relative prefix", () => {
		expect(
			isImportedBy(
				'import x from "@/features/a/utils/one";',
				"apps/web/src/features/a/utils/one.ts"
			)
		).toBe(true);
		expect(
			isImportedBy(
				'import x from "./one-more";',
				"apps/web/src/features/a/utils/one.ts"
			)
		).toBe(false);
	});
});

describe("compareFileScores", () => {
	it("marks a drop as real only when survived or no-coverage mutants increased", () => {
		const before = report({
			"a.ts": ["Killed", "Killed", "Survived", "Timeout"],
			"b.ts": ["Killed", "Killed"],
		});
		const after = report({
			"a.ts": ["Killed", "Survived", "Survived", "Killed"],
			"b.ts": ["Timeout", "Killed"],
		});
		const [a, b] = compareFileScores(before, after);
		expect(a).toMatchObject({
			file: "a.ts",
			noCoverageDelta: 0,
			real: true,
			scoreDelta: -25,
			survivedDelta: 1,
		});
		expect(b).toMatchObject({ file: "b.ts", real: false, scoreDelta: 0 });
	});
});

describe("largeSpecs", () => {
	it("lists specs over the it() and line limits, largest first", () => {
		const stats = [
			{ asNever: 0, its: 31, lines: 100, mocksReactQuery: false, path: "x" },
			{ asNever: 0, its: 40, lines: 700, mocksReactQuery: false, path: "y" },
			{ asNever: 0, its: 5, lines: 50, mocksReactQuery: false, path: "z" },
		];
		const result = largeSpecs(stats);
		expect(result.byIts.map((s) => s.path)).toEqual(["y", "x"]);
		expect(result.byLines.map((s) => s.path)).toEqual(["y"]);
	});
});
