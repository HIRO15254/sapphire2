import { describe, expect, it } from "vitest";

import {
	decideOutcome,
	excludedPaths,
	issueIdentifier,
	type LinearIssue,
	type OutcomeInput,
	parseTrailer,
} from "../review-outcome";

const HEAD = "a".repeat(40);

function issue(level: string | null, state = "AI Review"): LinearIssue {
	return {
		id: "id-1",
		identifier: "SA2-1",
		state,
		team: "SA2",
		labels: [
			{ name: "Chore", parent: "type" },
			...(level ? [{ name: level, parent: "level" }] : []),
		],
	};
}

function input(overrides: Partial<OutcomeInput> = {}): OutcomeInput {
	return {
		baseRef: "dev",
		changedFiles: ["apps/web/src/a.ts"],
		ciState: "success",
		draft: false,
		event: "opened",
		forkPr: false,
		headSha: HEAD,
		issue: issue("auto-merge"),
		maxAutoRounds: 2,
		prHeadSha: HEAD,
		round: 1,
		trailer: { verdict: "approve", important: 0, unverified: 0 },
		unresolvedThreads: 0,
		...overrides,
	};
}

describe("issueIdentifier", () => {
	it("reads the issue from the branch and rejects a title naming another issue", () => {
		expect(issueIdentifier("feature/sa2-257", "fix (SA2-257)")).toBe("SA2-257");
		expect(issueIdentifier("feature/sa2-257", "fix")).toBe("SA2-257");
		expect(issueIdentifier("feature/sa2-257", "fix (SA2-3)")).toBeNull();
		expect(issueIdentifier("HIRO15254/slug", "fix (SA2-257)")).toBeNull();
	});
});

describe("excludedPaths", () => {
	it("flags db, auth, deploy, CI and agent-instruction paths only", () => {
		expect(
			excludedPaths([
				"packages/db/src/migrations/0001_a.sql",
				"packages/db/src/schema/a.ts",
				"packages/auth/src/index.ts",
				"apps/server/wrangler.toml",
				".github/workflows/ci.yml",
				".claude/rules/testing.md",
				"AGENTS.md",
				"scripts/review-outcome.ts",
				"apps/web/src/a.ts",
			])
		).toEqual([
			"packages/db/src/migrations/0001_a.sql",
			"packages/auth/src/index.ts",
			"apps/server/wrangler.toml",
			".github/workflows/ci.yml",
			".claude/rules/testing.md",
			"AGENTS.md",
			"scripts/review-outcome.ts",
		]);
	});
});

describe("parseTrailer", () => {
	it("rejects payloads without a verdict and counts", () => {
		expect(
			parseTrailer('{"verdict":"approve","important":0,"unverified":0}')
		).toEqual({
			verdict: "approve",
			important: 0,
			unverified: 0,
		});
		expect(parseTrailer('{"verdict":"approve"}')).toBeNull();
		expect(parseTrailer("nope")).toBeNull();
	});
});

describe("decideOutcome", () => {
	it("merges an approved auto-merge PR and marks the others Ready to Merge", () => {
		expect(decideOutcome(input())).toEqual({
			status: "Ready to Merge",
			merge: true,
			blockers: [],
		});
		const autoFix = decideOutcome(input({ issue: issue("auto-fix") }));
		expect(autoFix.status).toBe("Ready to Merge");
		expect(autoFix.merge).toBe(false);
	});

	it("never merges when a safeguard fails", () => {
		const blocked: Partial<OutcomeInput>[] = [
			{ issue: null },
			{ issue: issue(null) },
			{ issue: issue("supervised") },
			{ issue: issue("auto-merge", "Done") },
			{ changedFiles: ["packages/auth/src/a.ts"] },
			{ prHeadSha: "b".repeat(40) },
			{ unresolvedThreads: 1 },
			{ round: 3 },
			{ event: "labeled" },
			{ forkPr: true },
			{ draft: true },
			{ baseRef: "main" },
			{ trailer: { verdict: "approve", important: 0, unverified: 1 } },
		];
		for (const overrides of blocked) {
			expect(decideOutcome(input(overrides)).merge).toBe(false);
		}
	});

	it("does not trust a PR label-like level from an unrelated label group", () => {
		const forged: LinearIssue = {
			...issue(null),
			labels: [{ name: "auto-merge", parent: "type" }],
		};
		expect(decideOutcome(input({ issue: forged })).merge).toBe(false);
	});

	it("routes a non-approving review to In Progress, then Needs Input after the last round", () => {
		const changes = {
			verdict: "changes-requested",
			important: 2,
			unverified: 0,
		};
		expect(decideOutcome(input({ trailer: changes, round: 1 })).status).toBe(
			"In Progress"
		);
		expect(decideOutcome(input({ trailer: changes, round: 2 })).status).toBe(
			"Needs Input"
		);
		const approveWithImportant = {
			verdict: "approve",
			important: 1,
			unverified: 0,
		};
		expect(decideOutcome(input({ trailer: approveWithImportant })).merge).toBe(
			false
		);
	});

	it("sets In Progress on a red ci and does nothing without a finished review", () => {
		expect(
			decideOutcome(input({ ciState: "failure", trailer: null })).status
		).toBe("In Progress");
		expect(
			decideOutcome(input({ ciState: "timeout", trailer: null })).status
		).toBeNull();
		expect(decideOutcome(input({ trailer: null })).status).toBeNull();
	});
});
