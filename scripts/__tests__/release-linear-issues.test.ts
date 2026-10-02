import { describe, expect, it } from "vitest";

import {
	issuesToRelease,
	type LinkedIssue,
	pullRequestsInRelease,
} from "../release-linear-issues";

function issue(identifier: string, state: string, team = "SA2"): LinkedIssue {
	return {
		id: `id-${identifier}`,
		identifier,
		state: { name: state },
		team: { key: team },
	};
}

describe("pullRequestsInRelease", () => {
	it("keeps only PRs whose merge commit shipped in the release", () => {
		const releaseCommits = new Set(["aaa", "bbb", "ccc"]);
		const urls = pullRequestsInRelease(
			[
				{ url: "https://github.com/o/r/pull/1", mergeCommit: { oid: "aaa" } },
				{ url: "https://github.com/o/r/pull/2", mergeCommit: { oid: "zzz" } },
				{ url: "https://github.com/o/r/pull/3", mergeCommit: null },
				{ url: "https://github.com/o/r/pull/4", mergeCommit: { oid: "ccc" } },
			],
			releaseCommits
		);
		expect(urls).toEqual([
			"https://github.com/o/r/pull/1",
			"https://github.com/o/r/pull/4",
		]);
	});
});

describe("issuesToRelease", () => {
	it("moves only the team's Done issues, once each", () => {
		const targets = issuesToRelease([
			issue("SA2-10", "Done"),
			issue("SA2-2", "Done"),
			issue("SA2-10", "Done"),
			issue("SA2-3", "Released"),
			issue("SA2-4", "Canceled"),
			issue("SA2-5", "In Progress"),
			issue("OPS-1", "Done", "OPS"),
		]);
		expect(targets.map((target) => target.identifier)).toEqual([
			"SA2-2",
			"SA2-10",
		]);
	});
});
