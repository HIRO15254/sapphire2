import { describe, expect, it } from "vitest";

import {
	type AuditFile,
	applyRun,
	type LedgerRow,
	nextAgent,
	parseLedger,
	renderLedger,
	rowCovers,
	selectUnit,
	splitUnits,
} from "../audit-select";

const NOW = new Date("2026-10-10T00:00:00Z");

function file(path: string, loc: number, overrides: Partial<AuditFile> = {}) {
	return {
		path,
		loc,
		auditedAt: null,
		auditedSha: null,
		churn: 0,
		...overrides,
	};
}

function audited(path: string, loc: number, date: string, churn = 0) {
	return file(path, loc, {
		auditedAt: new Date(date),
		auditedSha: "abc",
		churn,
	});
}

describe("splitUnits", () => {
	it("keeps a directory whole while it fits the budget and splits it when it does not", () => {
		const files = [
			file("apps/web/src/features/a/x.ts", 600),
			file("apps/web/src/features/a/y.ts", 600),
			file("apps/web/src/features/b/z.ts", 600),
		];
		expect(splitUnits(files, 5000).map((u) => u.path)).toEqual([
			"apps/web/src",
		]);
		expect(splitUnits(files, 1500).map((u) => u.path)).toEqual([
			"apps/web/src/features/a",
			"apps/web/src/features/b",
		]);
	});

	it("covers every file exactly once, including loose files beside subdirectories", () => {
		const files = [
			file("packages/api/src/index.ts", 100),
			file("packages/api/src/routers/a.ts", 900),
			file("packages/api/src/routers/b.ts", 900),
		];
		const units = splitUnits(files, 1000);
		expect(units.map((u) => u.path).sort()).toEqual(
			["packages/api/src/*", "packages/api/src/routers/*"].sort()
		);
		expect(units.flatMap((u) => u.files).length).toBe(files.length);
	});
});

describe("selectUnit", () => {
	it("prefers a unit with heavy recent churn over an equally old quiet one", () => {
		const files = [
			audited("apps/web/src/features/hot/a.ts", 3000, "2026-10-01", 2000),
			audited("apps/web/src/features/quiet/a.ts", 3000, "2026-10-01", 0),
		];
		expect(selectUnit(files, [], NOW, 3500)?.path).toBe(
			"apps/web/src/features/hot"
		);
	});

	it("picks a unit unaudited for 30+ days even when another has more churn", () => {
		const files = [
			audited("apps/web/src/features/hot/a.ts", 3000, "2026-10-08", 5000),
			audited("apps/web/src/features/old/a.ts", 3000, "2026-08-01", 0),
		];
		expect(selectUnit(files, [], NOW, 3500)?.path).toBe(
			"apps/web/src/features/old"
		);
	});

	it("weights api paths above web paths for the same churn and age", () => {
		const files = [
			audited("apps/web/src/features/a/a.ts", 3000, "2026-10-01", 100),
			audited("packages/api/src/routers/a.ts", 3000, "2026-10-01", 100),
		];
		expect(selectUnit(files, [], NOW, 3500)?.path).toBe("packages/api/src");
	});

	it("reviews the diff since the last audit when most of the unit changed, and sweeps otherwise", () => {
		const changed = [
			audited("packages/db/src/schema/a.ts", 1000, "2026-10-05", 600),
		];
		const quiet = [
			audited("packages/db/src/schema/a.ts", 1000, "2026-10-05", 10),
		];
		expect(selectUnit(changed, [], NOW)).toMatchObject({
			mode: "diff",
			sinceSha: "abc",
		});
		expect(selectUnit(quiet, [], NOW)).toMatchObject({
			mode: "sweep",
			sinceSha: null,
		});
	});

	it("selects never-audited code and names the rule files for its path", () => {
		const selection = selectUnit(
			[file("packages/mcp/src/tools.ts", 500)],
			[],
			NOW
		);
		expect(selection?.rules).toEqual(["mcp-tools.md"]);
		expect(selection?.mode).toBe("sweep");
	});
});

describe("ledger", () => {
	const rows: LedgerRow[] = [
		{
			path: "apps/web/src/features/rooms",
			sha: "a1",
			date: "2026-09-01",
			agent: "claude",
			filed: 2,
		},
		{
			path: "packages/api/src/routers/*",
			sha: "b2",
			date: "2026-09-20",
			agent: "codex",
			filed: 0,
		},
	];

	it("round-trips through the Markdown table", () => {
		expect(parseLedger(renderLedger(rows))).toEqual(rows);
	});

	it("matches a row to files by directory prefix, and a /* row to direct children only", () => {
		expect(
			rowCovers(
				"apps/web/src/features/rooms",
				"apps/web/src/features/rooms/a/b.ts"
			)
		).toBe(true);
		expect(
			rowCovers(
				"apps/web/src/features/rooms",
				"apps/web/src/features/rooms-x/b.ts"
			)
		).toBe(false);
		expect(
			rowCovers("packages/api/src/routers/*", "packages/api/src/routers/a.ts")
		).toBe(true);
		expect(
			rowCovers("packages/api/src/routers/*", "packages/api/src/routers/a/b.ts")
		).toBe(false);
	});

	it("replaces only the rows a new run covers", () => {
		const next = applyRun(rows, {
			path: "apps/web/src/features",
			sha: "c3",
			date: "2026-10-02",
			agent: "codex",
			filed: 1,
		});
		expect(next.map((row) => row.path).sort()).toEqual([
			"apps/web/src/features",
			"packages/api/src/routers/*",
		]);
	});

	it("alternates the agent from the most recent run", () => {
		expect(nextAgent([])).toBe("claude");
		expect(nextAgent(rows)).toBe("claude");
		expect(nextAgent([rows[0]])).toBe("codex");
	});
});
