import { describe, expect, it } from "vitest";

import {
	buildIssue,
	fingerprint,
	MAX_FILED_PER_REVIEW,
	type PreExistingFinding,
	parsePreExisting,
} from "../file-preexisting-issues";
import { extractReviewTrailer } from "../review-gate";

function finding(
	overrides: Partial<PreExistingFinding> = {}
): PreExistingFinding {
	return {
		file: "packages/api/src/routers/player.ts",
		line: 42,
		title: "Player list ignores the owner filter",
		evidence:
			"bunx vitest run --project api player → another user's rows returned",
		type: "bug",
		...overrides,
	};
}

describe("parsePreExisting", () => {
	it("returns well-formed findings and drops malformed ones", () => {
		const trailer = JSON.stringify({
			verdict: "approve",
			preExisting: [
				finding(),
				{ file: "a.ts" },
				finding({ type: "chore" as never }),
			],
		});
		expect(parsePreExisting(trailer)).toEqual([finding()]);
	});

	it("files nothing when the trailer has no preExisting list or is not JSON", () => {
		expect(parsePreExisting('{"verdict":"approve"}')).toEqual([]);
		expect(parsePreExisting("not json")).toEqual([]);
	});

	it("caps one review's filings", () => {
		const many = Array.from({ length: 6 }, (_, i) =>
			finding({ title: `t${i}` })
		);
		expect(
			parsePreExisting(JSON.stringify({ preExisting: many }))
		).toHaveLength(MAX_FILED_PER_REVIEW);
	});
});

describe("fingerprint", () => {
	it("is stable across rounds when the line moves or the title is re-spaced", () => {
		expect(
			fingerprint(
				finding({ line: 99, title: "  player list ignores   the owner filter" })
			)
		).toBe(fingerprint(finding()));
	});

	it("differs for another file or another problem", () => {
		expect(fingerprint(finding({ file: "other.ts" }))).not.toBe(
			fingerprint(finding())
		);
		expect(fingerprint(finding({ title: "different" }))).not.toBe(
			fingerprint(finding())
		);
	});
});

describe("buildIssue", () => {
	it("carries the evidence, the originating PR, and the fingerprint used for deduplication", () => {
		const issue = buildIssue(finding(), {
			number: 700,
			url: "https://github.com/o/r/pull/700",
		});
		expect(issue.description).toContain(
			"packages/api/src/routers/player.ts:42"
		);
		expect(issue.description).toContain("pull/700");
		expect(issue.description).toContain(issue.fingerprint);
	});
});

describe("review trailer carrying findings", () => {
	it("is still extracted when a finding's text contains braces", () => {
		const trailer = JSON.stringify({
			verdict: "approve",
			resolved: [],
			preExisting: [finding({ evidence: "if (x) { return }" })],
		});
		expect(
			extractReviewTrailer(`### レビュー結果\n<!-- pr-review: ${trailer} -->`)
		).toBe(trailer);
	});
});
