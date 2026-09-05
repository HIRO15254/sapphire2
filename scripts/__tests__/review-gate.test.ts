import { describe, expect, it } from "vitest";

import {
	decideReview,
	formatGithubOutputs,
	type GateInput,
	parseReviewState,
	renderStateComment,
	STATE_MARKER,
} from "../review-gate";

const HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PREV = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function input(overrides: Partial<GateInput> = {}): GateInput {
	return {
		event: "synchronize",
		label: null,
		draft: false,
		headRef: "claude/feature-x",
		headSha: HEAD,
		headTree: "tree-head",
		devTree: "tree-dev",
		state: null,
		changedSinceLast: null,
		maxAutoRounds: 2,
		reReviewLabel: "re-review",
		...overrides,
	};
}

describe("decideReview — first review", () => {
	it("runs a full round 1 on a ready PR with no prior state", () => {
		expect(decideReview(input({ event: "opened" }))).toEqual({
			run: true,
			mode: "full",
			round: 1,
			sinceSha: null,
			reason: "first review",
		});
	});

	it("runs round 1 on ready_for_review when nothing was reviewed while draft", () => {
		const decision = decideReview(input({ event: "ready_for_review" }));
		expect(decision.run).toBe(true);
		expect(decision).toMatchObject({ mode: "full", round: 1 });
	});

	it("runs round 1 on reopened when there is no state", () => {
		expect(decideReview(input({ event: "reopened" }))).toMatchObject({
			run: true,
			mode: "full",
			round: 1,
		});
	});
});

describe("decideReview — draft handling", () => {
	it("skips every automatic event while the PR is a draft", () => {
		for (const event of [
			"opened",
			"synchronize",
			"reopened",
			"ready_for_review",
		] as const) {
			expect(decideReview(input({ event, draft: true }))).toEqual({
				run: false,
				reason: "draft",
			});
		}
	});

	it("still honours the re-review label on a draft", () => {
		const decision = decideReview(
			input({ event: "labeled", label: "re-review", draft: true })
		);
		expect(decision).toEqual({
			run: true,
			mode: "full",
			round: 1,
			sinceSha: null,
			reason: "label re-review",
		});
	});
});

describe("decideReview — labeled event", () => {
	it("ignores labels other than the re-review label", () => {
		expect(decideReview(input({ event: "labeled", label: "bug" }))).toEqual({
			run: false,
			reason: "label bug is not re-review",
		});
	});

	it("ignores a labeled event with no label payload", () => {
		expect(decideReview(input({ event: "labeled", label: null }))).toEqual({
			run: false,
			reason: "label  is not re-review",
		});
	});

	it("bypasses the round cap and reviews incrementally when state exists", () => {
		const decision = decideReview(
			input({
				event: "labeled",
				label: "re-review",
				state: { rounds: 2, lastSha: PREV },
			})
		);
		expect(decision).toEqual({
			run: true,
			mode: "incremental",
			round: 3,
			sinceSha: PREV,
			reason: "label re-review",
		});
	});

	it("bypasses the already-reviewed-sha skip when requested by label", () => {
		const decision = decideReview(
			input({
				event: "labeled",
				label: "re-review",
				state: { rounds: 1, lastSha: HEAD },
			})
		);
		expect(decision).toMatchObject({
			run: true,
			mode: "incremental",
			round: 2,
		});
	});

	it("matches the configured label name, not a hard-coded one", () => {
		const decision = decideReview(
			input({
				event: "labeled",
				label: "review-again",
				reReviewLabel: "review-again",
			})
		);
		expect(decision.run).toBe(true);
		expect(
			decideReview(
				input({
					event: "labeled",
					label: "re-review",
					reReviewLabel: "review-again",
				})
			)
		).toEqual({
			run: false,
			reason: "label re-review is not review-again",
		});
	});
});

describe("decideReview — release branches", () => {
	it("skips a release branch whose tree equals dev (already reviewed on dev)", () => {
		expect(
			decideReview(
				input({
					event: "opened",
					headRef: "release/v3.5.0",
					headTree: "same",
					devTree: "same",
				})
			)
		).toEqual({ run: false, reason: "release branch tree identical to dev" });
	});

	it("reviews a release branch that carries commits beyond dev", () => {
		expect(
			decideReview(
				input({
					event: "opened",
					headRef: "release/v3.5.0",
					headTree: "hotfix",
					devTree: "dev",
				})
			)
		).toMatchObject({ run: true, mode: "full", round: 1 });
	});

	it("reviews a release branch when the dev tree is unknown", () => {
		expect(
			decideReview(
				input({ event: "opened", headRef: "release/v3.5.0", devTree: null })
			)
		).toMatchObject({ run: true });
	});

	it("does not apply the tree comparison to non-release branches", () => {
		expect(
			decideReview(
				input({ event: "opened", headTree: "same", devTree: "same" })
			)
		).toMatchObject({ run: true });
	});
});

describe("decideReview — subsequent pushes", () => {
	it("skips when the head sha was already reviewed", () => {
		expect(
			decideReview(
				input({ event: "reopened", state: { rounds: 1, lastSha: HEAD } })
			)
		).toEqual({ run: false, reason: "head already reviewed" });
	});

	it("runs an incremental round 2 after the first review", () => {
		expect(
			decideReview(
				input({
					state: { rounds: 1, lastSha: PREV },
					changedSinceLast: ["apps/web/src/a.ts", "docs/design/x.md"],
				})
			)
		).toEqual({
			run: true,
			mode: "incremental",
			round: 2,
			sinceSha: PREV,
			reason: "automatic round 2 of 2",
		});
	});

	it("stops after the configured number of automatic rounds", () => {
		expect(
			decideReview(
				input({
					state: { rounds: 2, lastSha: PREV },
					changedSinceLast: ["apps/web/src/a.ts"],
				})
			)
		).toEqual({
			run: false,
			reason: "automatic round cap (2) reached; add the re-review label",
		});
	});

	it("treats a cap of 1 as first-review-only", () => {
		expect(
			decideReview(
				input({
					maxAutoRounds: 1,
					state: { rounds: 1, lastSha: PREV },
					changedSinceLast: ["x.ts"],
				})
			)
		).toMatchObject({ run: false });
	});

	it("treats a cap of 0 as never reviewing automatically", () => {
		expect(decideReview(input({ event: "opened", maxAutoRounds: 0 }))).toEqual({
			run: false,
			reason: "automatic round cap (0) reached; add the re-review label",
		});
	});

	it("skips a docs-only push", () => {
		expect(
			decideReview(
				input({
					state: { rounds: 1, lastSha: PREV },
					changedSinceLast: [
						"docs/design/x.md",
						"AGENTS.md",
						".claude/rules/y.md",
					],
				})
			)
		).toEqual({ run: false, reason: "docs-only push" });
	});

	it("does not treat an empty change list as docs-only", () => {
		expect(
			decideReview(
				input({ state: { rounds: 1, lastSha: PREV }, changedSinceLast: [] })
			)
		).toMatchObject({ run: true, mode: "incremental", round: 2 });
	});

	it("reviews when the change list is unknown (last sha rewritten)", () => {
		expect(
			decideReview(
				input({ state: { rounds: 1, lastSha: PREV }, changedSinceLast: null })
			)
		).toMatchObject({
			run: true,
			mode: "incremental",
			round: 2,
			sinceSha: PREV,
		});
	});

	it("is case-sensitive about the .md suffix so README.MD-like files still count as code", () => {
		expect(
			decideReview(
				input({
					state: { rounds: 1, lastSha: PREV },
					changedSinceLast: ["NOTES.MD"],
				})
			)
		).toMatchObject({ run: true });
	});
});

describe("parseReviewState", () => {
	it("returns null when no comment carries the marker", () => {
		expect(
			parseReviewState(["hello", "<!-- pre-merge-review:truncated -->"])
		).toBeNull();
	});

	it("returns null for an empty list", () => {
		expect(parseReviewState([])).toBeNull();
	});

	it("parses the marker payload", () => {
		const body = `${STATE_MARKER} {"rounds":1,"lastSha":"${PREV}"} -->\nvisible text`;
		expect(parseReviewState([body])).toEqual({ rounds: 1, lastSha: PREV });
	});

	it("takes the last marker comment when several exist", () => {
		const older = `${STATE_MARKER} {"rounds":1,"lastSha":"${PREV}"} -->`;
		const newer = `${STATE_MARKER} {"rounds":2,"lastSha":"${HEAD}"} -->`;
		expect(parseReviewState([older, newer])).toEqual({
			rounds: 2,
			lastSha: HEAD,
		});
	});

	it("ignores a marker with malformed JSON", () => {
		expect(parseReviewState([`${STATE_MARKER} {rounds:1} -->`])).toBeNull();
	});

	it("ignores a payload with a non-integer or negative round count", () => {
		expect(
			parseReviewState([
				`${STATE_MARKER} {"rounds":1.5,"lastSha":"${PREV}"} -->`,
			])
		).toBeNull();
		expect(
			parseReviewState([
				`${STATE_MARKER} {"rounds":-1,"lastSha":"${PREV}"} -->`,
			])
		).toBeNull();
	});

	it("ignores a payload whose sha is not 40 hex chars", () => {
		expect(
			parseReviewState([`${STATE_MARKER} {"rounds":1,"lastSha":"abc"} -->`])
		).toBeNull();
		expect(
			parseReviewState([`${STATE_MARKER} {"rounds":1,"lastSha":""} -->`])
		).toBeNull();
	});

	it("round-trips a rendered comment", () => {
		const body = renderStateComment(
			{ rounds: 2, lastSha: HEAD },
			2,
			"re-review"
		);
		expect(parseReviewState([body])).toEqual({ rounds: 2, lastSha: HEAD });
	});
});

describe("renderStateComment", () => {
	it("tells the author the cap is reached and how to request another round", () => {
		const body = renderStateComment(
			{ rounds: 2, lastSha: HEAD },
			2,
			"re-review"
		);
		expect(body.startsWith(STATE_MARKER)).toBe(true);
		expect(body).toContain("2 / 2");
		expect(body).toContain("`re-review`");
		expect(body).toContain(HEAD.slice(0, 8));
	});

	it("says a round remains while under the cap", () => {
		const body = renderStateComment(
			{ rounds: 1, lastSha: HEAD },
			2,
			"re-review"
		);
		expect(body).toContain("1 / 2");
		expect(body).not.toContain("上限に達しました");
	});

	it("reports label-requested rounds beyond the cap without lying about the cap", () => {
		const body = renderStateComment(
			{ rounds: 3, lastSha: HEAD },
			2,
			"re-review"
		);
		expect(body).toContain("3 / 2");
	});
});

describe("formatGithubOutputs", () => {
	it("emits every key for a run decision", () => {
		expect(
			formatGithubOutputs({
				run: true,
				mode: "incremental",
				round: 2,
				sinceSha: PREV,
				reason: "automatic round 2 of 2",
			})
		).toBe(
			`run=true\nmode=incremental\nround=2\nsince_sha=${PREV}\nreason=automatic round 2 of 2\n`
		);
	});

	it("emits empty values for a skip decision so later steps can still read the keys", () => {
		expect(formatGithubOutputs({ run: false, reason: "draft" })).toBe(
			"run=false\nmode=\nround=0\nsince_sha=\nreason=draft\n"
		);
	});

	it("emits an empty since_sha for a full review", () => {
		expect(
			formatGithubOutputs({
				run: true,
				mode: "full",
				round: 1,
				sinceSha: null,
				reason: "first review",
			})
		).toContain("since_sha=\n");
	});

	it("strips newlines from the reason so the output file stays one key per line", () => {
		expect(formatGithubOutputs({ run: false, reason: "a\nb" })).toContain(
			"reason=a b\n"
		);
	});
});
