import { describe, expect, it } from "vitest";

import { type IssueComment, renderIssueContext } from "../review-issue-context";

function comment(createdAt: string, body: string): IssueComment {
	return { author: "user", body, createdAt };
}

const ISSUE = {
	identifier: "SA2-1",
	title: "Title",
	url: "https://linear.app/x/issue/SA2-1",
	description: "Requirement A",
	state: "In Progress",
	project: null,
};

describe("renderIssueContext", () => {
	it("lists comments oldest first so later decisions read as superseding", () => {
		const text = renderIssueContext({
			...ISSUE,
			comments: [
				comment("2026-10-03T00:00:00.000Z", "third"),
				comment("2026-10-01T00:00:00.000Z", "first"),
				comment("2026-10-02T00:00:00.000Z", "second"),
			],
		});
		expect(text.indexOf("first")).toBeLessThan(text.indexOf("second"));
		expect(text.indexOf("second")).toBeLessThan(text.indexOf("third"));
	});

	it("drops the oldest comments, never the latest decisions, when over the limit", () => {
		const text = renderIssueContext(
			{
				...ISSUE,
				comments: [
					comment("2026-10-01T00:00:00.000Z", `old ${"x".repeat(300)}`),
					comment("2026-10-02T00:00:00.000Z", "middle decision"),
					comment("2026-10-03T00:00:00.000Z", "latest decision"),
				],
			},
			400
		);
		expect(text).toContain("Requirement A");
		expect(text).toContain("middle decision");
		expect(text).toContain("latest decision");
		expect(text).not.toContain("old x");
		expect(text).toContain("1 older comments omitted");
	});
});
