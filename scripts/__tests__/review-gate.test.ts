import { describe, expect, it } from "vitest";

import {
	decideReview,
	extractReviewTrailer,
	formatGithubOutputs,
	formatSummaryOutputs,
	type GateInput,
	hasPublishedSummary,
	parseReviewResult,
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
});

describe("parseReviewState", () => {
	it("returns null when no comment carries the marker", () => {
		expect(
			parseReviewState(["hello", "<!-- pre-merge-review:truncated -->"])
		).toBeNull();
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
});

const TRAILER =
	'<!-- pr-review: {"verdict":"approve","important":0,"nit":1,"unverified":0,"resolved":["apps/web/src/a.ts:12"]} -->';

function resultLog(result: string, subtype = "success"): string {
	return JSON.stringify([
		{ type: "system", subtype: "init" },
		{ type: "assistant", message: { content: "working" } },
		{ type: "result", subtype, result },
	]);
}

describe("extractReviewTrailer", () => {
	it("returns the trailer payload of a completed summary", () => {
		expect(extractReviewTrailer(`## 結果\n\n${TRAILER}`)).toBe(
			'{"verdict":"approve","important":0,"nit":1,"unverified":0,"resolved":["apps/web/src/a.ts:12"]}'
		);
	});

	it("returns null for a final message that never reported (SA2-231)", () => {
		expect(
			extractReviewTrailer("差分を確認しています…\n- [ ] 検証・結果報告")
		).toBeNull();
	});

	it("ignores a trailer whose payload is not valid JSON", () => {
		expect(
			extractReviewTrailer("<!-- pr-review: {verdict: approve} -->")
		).toBeNull();
	});

	it("takes the last trailer when the message quotes an earlier one", () => {
		const quoted = '<!-- pr-review: {"verdict":"changes-requested"} -->';
		expect(extractReviewTrailer(`${quoted}\n${TRAILER}`)).toContain(
			'"verdict":"approve"'
		);
	});
});

describe("parseReviewResult", () => {
	it("reads the trailer and the subtype of the last result event", () => {
		expect(parseReviewResult(resultLog(`要約\n${TRAILER}`))).toEqual({
			subtype: "success",
			trailer:
				'{"verdict":"approve","important":0,"nit":1,"unverified":0,"resolved":["apps/web/src/a.ts:12"]}',
		});
	});

	it("reports no trailer for a run that exited success without a summary", () => {
		expect(parseReviewResult(resultLog("- [ ] 検証・結果報告"))).toEqual({
			subtype: "success",
			trailer: null,
		});
	});

	it("keeps the subtype of a turn-limit cutoff so the report can name it", () => {
		expect(parseReviewResult(resultLog("", "error_max_turns")).subtype).toBe(
			"error_max_turns"
		);
	});

	it("reads a JSONL execution log as well as a JSON array", () => {
		const jsonl = [
			JSON.stringify({ type: "system", subtype: "init" }),
			JSON.stringify({ type: "result", subtype: "success", result: TRAILER }),
			"",
		].join("\n");
		expect(parseReviewResult(jsonl).trailer).toContain('"verdict":"approve"');
	});

	it("finds a result event nested inside a wrapper object", () => {
		const nested = JSON.stringify({
			events: [{ type: "result", subtype: "success", result: TRAILER }],
		});
		expect(parseReviewResult(nested).trailer).toContain('"verdict":"approve"');
	});

	it("reports no trailer for a log with no result event", () => {
		expect(parseReviewResult('[{"type":"system"}]')).toEqual({
			subtype: "",
			trailer: null,
		});
	});

	it("reports no trailer for an unparseable log", () => {
		expect(parseReviewResult("not json at all")).toEqual({
			subtype: "",
			trailer: null,
		});
	});
});

const TRACKING_HEADER =
	"**Claude finished @HIRO15254's task in 1m 27s** —— [View job](https://github.com/HIRO15254/sapphire2/actions/runs/34012323755)";

describe("hasPublishedSummary", () => {
	it("rejects the placeholder the action leaves when the reviewer never wrote the summary (#620 round 2)", () => {
		expect(
			hasPublishedSummary(
				`${TRACKING_HEADER}\n\n---\nI'll analyze this and get back to you.`
			)
		).toBe(false);
	});

	it("accepts a tracking comment carrying the mandated summary heading", () => {
		expect(
			hasPublishedSummary(
				`${TRACKING_HEADER}\n\n---\n### レビュー結果（round 1/2）\n\n**Verdict: approve** — important 0 件。`
			)
		).toBe(true);
	});

	it("accepts a summary whose heading was dropped but whose trailer survived", () => {
		expect(hasPublishedSummary(`要約\n\n${TRAILER}`)).toBe(true);
	});

	it("rejects an empty body, which is what a missing tracking comment reads as", () => {
		expect(hasPublishedSummary("")).toBe(false);
	});

	it("does not mistake the incomplete-review notice for a summary", () => {
		expect(
			hasPublishedSummary(
				"<!-- pre-merge-review:truncated -->\n### ⚠️ 自動レビューは完了しませんでした"
			)
		).toBe(false);
	});
});

describe("formatSummaryOutputs", () => {
	it("marks a completed review so the round is recorded", () => {
		expect(
			formatSummaryOutputs(true, { subtype: "success", trailer: "{}" })
		).toBe("has_log=true\nhas_summary=true\nsubtype=success\n");
	});

	it("marks a summary-less run so the round is not recorded", () => {
		expect(
			formatSummaryOutputs(true, { subtype: "success", trailer: null })
		).toBe("has_log=true\nhas_summary=false\nsubtype=success\n");
	});

	it("marks a run the action never started", () => {
		expect(formatSummaryOutputs(false, { subtype: "", trailer: null })).toBe(
			"has_log=false\nhas_summary=false\nsubtype=\n"
		);
	});
});
