import { describe, expect, it } from "vitest";

import {
	type AuditFile,
	applyRun,
	type LedgerRow,
	nextAgent,
	parseLedger,
	pruneRows,
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
	const files = [
		file("packages/api/src/index.ts", 100),
		file("packages/api/src/routers/a.ts", 900),
		file("packages/api/src/routers/b.ts", 900),
		file("packages/api/src/routers/c.ts", 900),
		file("apps/web/src/features/a/x.ts", 600),
		file("apps/web/src/features/a/y.ts", 600),
		file("apps/web/src/features/b/z.ts", 600),
		file("apps/web/src/features/c/z.ts", 3000),
	];

	it("covers every file exactly once and keeps each unit within the budget", () => {
		const units = splitUnits(files, 2000);
		expect(units.flatMap((u) => u.files.map((f) => f.path)).sort()).toEqual(
			files.map((f) => f.path).sort()
		);
		for (const unit of units) {
			expect(unit.files.length === 1 || unit.loc <= 2000).toBe(true);
		}
	});

	it("keeps a directory whole while it fits and merges small neighbours instead of leaving tiny units", () => {
		const units = splitUnits(files, 2000);
		expect(units.map((u) => u.path)).toContain(
			"apps/web/src/features/a+apps/web/src/features/b"
		);
	});

	it("gives an oversized file its own unit", () => {
		const units = splitUnits(files, 2000);
		expect(units.find((u) => u.loc === 3000)?.files).toHaveLength(1);
	});

	it("names the unit a ledger row can later match back to exactly its files", () => {
		for (const unit of splitUnits(files, 2000)) {
			for (const f of files) {
				expect(rowCovers(unit.path, f.path)).toBe(
					unit.files.some((m) => m.path === f.path)
				);
			}
		}
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

	it("audits a package it has never heard of, with no rule files", () => {
		const selection = selectUnit([file("packages/new/src/a.ts", 100)], [], NOW);
		expect(selection?.path).toBe("packages/new/src");
		expect(selection?.rules).toEqual([]);
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

	it("reads rows back after Linear escapes the asterisks of a /* path", () => {
		const escaped = [
			"| path | sha | date | agent | filed |",
			"| -- | -- | -- | -- | -- |",
			String.raw`| packages/api/src/routers/\*:a.ts..b.ts | a1 | 2026-10-02 | claude | 0 |`,
			String.raw`| packages/api/src/\* | b2 | 2026-10-02 | codex | 1 |`,
		].join("\n");
		expect(parseLedger(escaped).map((row) => row.path)).toEqual([
			"packages/api/src/routers/*:a.ts..b.ts",
			"packages/api/src/*",
		]);
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

	it("alternates when both agents run on the same UTC day, as in Codex 06:00 then Claude 18:00", () => {
		const row = (agent: string, date: string, path: string) => ({
			path,
			sha: "x",
			date,
			agent,
			filed: 0,
		});
		expect(
			nextAgent([
				row("codex", "2026-10-03T06:00:00Z", "a"),
				row("claude", "2026-10-03T18:00:00Z", "b"),
			])
		).toBe("codex");
		expect(
			nextAgent([
				row("claude", "2026-10-03T18:00:00Z", "b"),
				row("codex", "2026-10-03T06:00:00Z", "a"),
			])
		).toBe("codex");
	});

	it("takes the later-appended row when two rows carry the same date", () => {
		const row = (agent: string, path: string) => ({
			path,
			sha: "x",
			date: "2026-10-03",
			agent,
			filed: 0,
		});
		expect(nextAgent([row("codex", "a"), row("claude", "b")])).toBe("codex");
	});

	it("drops rows that no longer cover any existing file", () => {
		expect(
			pruneRows(rows, ["apps/web/src/features/rooms/a.ts"]).map(
				(row) => row.path
			)
		).toEqual(["apps/web/src/features/rooms"]);
	});
});
