import { describe, expect, it } from "vitest";

import { contractCitations, contractProblems } from "../contract-ids";

describe("contract IDs", () => {
	it("counts an ID only in the title of a running test, test table or describe", () => {
		const text = [
			'describe("C-A-GROUP rules", () => {',
			'\tit.each([[1, wrap(2)], [3, "(4"]])("C-A-TABLE %s", () => {});',
			'\ttest("plain", () => expect("C-A-BODY").toBe("C-A-BODY"));',
			'\ttest.skip("C-A-SKIPPED", () => {});',
			'\tit("matches", () => /C-A-REGEX/u.test("C-A-REGEX"));',
			"});",
		].join("\n");

		expect(
			contractCitations([{ path: "a.test.ts", text }]).map(({ id }) => id)
		).toEqual(["C-A-GROUP", "C-A-TABLE"]);
	});

	it("rejects an uncited contract, a stale or unknown list entry, an unknown citation and a duplicate", () => {
		const problems = contractProblems(
			[
				{ id: "C-A-TESTED", where: "a.md:1" },
				{ id: "C-A-NEW", where: "a.md:2" },
				{ id: "C-A-LISTED", where: "a.md:3" },
				{ id: "C-A-FIXED", where: "a.md:4" },
				{ id: "C-A-TWICE", where: "a.md:5" },
				{ id: "C-A-TWICE", where: "b.md:1" },
			],
			[
				{ id: "C-A-TESTED", where: "a.test.ts:1" },
				{ id: "C-A-FIXED", where: "a.test.ts:2" },
				{ id: "C-A-TWICE", where: "a.test.ts:3" },
				{ id: "C-A-TYPO", where: "a.test.ts:4" },
			],
			{ "C-A-FIXED": "SA2-1", "C-A-GONE": "SA2-1", "C-A-LISTED": "SA2-1" }
		);

		expect(problems.map(({ id, kind }) => `${id} ${kind}`).sort()).toEqual([
			"C-A-FIXED listed-but-cited",
			"C-A-GONE listed-but-undeclared",
			"C-A-NEW uncited",
			"C-A-TWICE duplicate",
			"C-A-TYPO unknown-citation",
		]);
	});
});
