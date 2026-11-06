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
		changedSinceLast: null,
		devTree: "tree-dev",
		draft: false,
		event: "synchronize",
		headRef: "claude/feature-x",
		headSha: HEAD,
		headTree: "tree-head",
		label: null,
		maxAutoRounds: 2,
		reReviewLabel: "re-review",
		state: null,
		...overrides,
	};
}

describe("decideReview — first review", () => {
	it("runs a full round 1 on a ready PR with no prior state", () => {
		expect(decideReview(input({ event: "opened" }))).toEqual({
			mode: "full",
			reason: "first review",
			round: 1,
			run: true,
			sinceSha: null,
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
			expect(decideReview(input({ draft: true, event }))).toEqual({
				reason: "draft",
				run: false,
			});
		}
	});

	it("still honours the re-review label on a draft", () => {
		const decision = decideReview(
			input({ draft: true, event: "labeled", label: "re-review" })
		);
		expect(decision).toEqual({
			mode: "full",
			reason: "label re-review",
			round: 1,
			run: true,
			sinceSha: null,
		});
	});
});

describe("decideReview — labeled event", () => {
	it("ignores labels other than the re-review label", () => {
		expect(decideReview(input({ event: "labeled", label: "bug" }))).toEqual({
			reason: "label bug is not re-review",
			run: false,
		});
	});

	it("bypasses the round cap and reviews incrementally when state exists", () => {
		const decision = decideReview(
			input({
				event: "labeled",
				label: "re-review",
				state: { lastSha: PREV, rounds: 2 },
			})
		);
		expect(decision).toEqual({
			mode: "incremental",
			reason: "label re-review",
			round: 3,
			run: true,
			sinceSha: PREV,
		});
	});

	it("bypasses the already-reviewed-sha skip when requested by label", () => {
		const decision = decideReview(
			input({
				event: "labeled",
				label: "re-review",
				state: { lastSha: HEAD, rounds: 1 },
			})
		);
		expect(decision).toMatchObject({
			mode: "incremental",
			round: 2,
			run: true,
		});
	});
});

describe("decideReview — release branches", () => {
	it("skips a release branch whose tree equals dev (already reviewed on dev)", () => {
		expect(
			decideReview(
				input({
					devTree: "same",
					event: "opened",
					headRef: "release/v3.5.0",
					headTree: "same",
				})
			)
		).toEqual({ reason: "release branch tree identical to dev", run: false });
	});

	it("reviews a release branch that carries commits beyond dev", () => {
		expect(
			decideReview(
				input({
					devTree: "dev",
					event: "opened",
					headRef: "release/v3.5.0",
					headTree: "hotfix",
				})
			)
		).toMatchObject({ mode: "full", round: 1, run: true });
	});

	it("reviews a release branch when the dev tree is unknown", () => {
		expect(
			decideReview(
				input({ devTree: null, event: "opened", headRef: "release/v3.5.0" })
			)
		).toMatchObject({ run: true });
	});
});

describe("decideReview — subsequent pushes", () => {
	it("skips when the head sha was already reviewed", () => {
		expect(
			decideReview(
				input({ event: "reopened", state: { lastSha: HEAD, rounds: 1 } })
			)
		).toEqual({ reason: "head already reviewed", run: false });
	});

	it("runs an incremental round 2 after the first review", () => {
		expect(
			decideReview(
				input({
					changedSinceLast: ["apps/web/src/a.ts", "docs/design/x.md"],
					state: { lastSha: PREV, rounds: 1 },
				})
			)
		).toEqual({
			mode: "incremental",
			reason: "automatic round 2 of 2",
			round: 2,
			run: true,
			sinceSha: PREV,
		});
	});

	it("stops after the configured number of automatic rounds", () => {
		expect(
			decideReview(
				input({
					changedSinceLast: ["apps/web/src/a.ts"],
					state: { lastSha: PREV, rounds: 2 },
				})
			)
		).toEqual({
			reason: "automatic round cap (2) reached; add the re-review label",
			run: false,
		});
	});

	it("skips a docs-only push", () => {
		expect(
			decideReview(
				input({
					changedSinceLast: [
						"docs/design/x.md",
						"AGENTS.md",
						".claude/rules/y.md",
					],
					state: { lastSha: PREV, rounds: 1 },
				})
			)
		).toEqual({ reason: "docs-only push", run: false });
	});

	it("does not treat an empty change list as docs-only", () => {
		expect(
			decideReview(
				input({ changedSinceLast: [], state: { lastSha: PREV, rounds: 1 } })
			)
		).toMatchObject({ mode: "incremental", round: 2, run: true });
	});

	it("reviews when the change list is unknown (last sha rewritten)", () => {
		expect(
			decideReview(
				input({ changedSinceLast: null, state: { lastSha: PREV, rounds: 1 } })
			)
		).toMatchObject({
			mode: "incremental",
			round: 2,
			run: true,
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
		expect(parseReviewState([body])).toEqual({ lastSha: PREV, rounds: 1 });
	});

	it("takes the last marker comment when several exist", () => {
		const older = `${STATE_MARKER} {"rounds":1,"lastSha":"${PREV}"} -->`;
		const newer = `${STATE_MARKER} {"rounds":2,"lastSha":"${HEAD}"} -->`;
		expect(parseReviewState([older, newer])).toEqual({
			lastSha: HEAD,
			rounds: 2,
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
			{ lastSha: HEAD, rounds: 2 },
			2,
			"re-review"
		);
		expect(parseReviewState([body])).toEqual({ lastSha: HEAD, rounds: 2 });
	});
});

describe("formatGithubOutputs", () => {
	it("emits every key for a run decision", () => {
		expect(
			formatGithubOutputs({
				mode: "incremental",
				reason: "automatic round 2 of 2",
				round: 2,
				run: true,
				sinceSha: PREV,
			})
		).toBe(
			`run=true\nmode=incremental\nround=2\nsince_sha=${PREV}\nreason=automatic round 2 of 2\n`
		);
	});

	it("emits empty values for a skip decision so later steps can still read the keys", () => {
		expect(formatGithubOutputs({ reason: "draft", run: false })).toBe(
			"run=false\nmode=\nround=0\nsince_sha=\nreason=draft\n"
		);
	});
});

const TRAILER =
	'<!-- pr-review: {"verdict":"approve","important":0,"nit":1,"unverified":0,"resolved":["apps/web/src/a.ts:12"]} -->';

function resultLog(result: string, subtype = "success"): string {
	return JSON.stringify([
		{ subtype: "init", type: "system" },
		{ message: { content: "working" }, type: "assistant" },
		{ result, subtype, type: "result" },
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
			JSON.stringify({ subtype: "init", type: "system" }),
			JSON.stringify({ result: TRAILER, subtype: "success", type: "result" }),
			"",
		].join("\n");
		expect(parseReviewResult(jsonl).trailer).toContain('"verdict":"approve"');
	});

	it("finds a result event nested inside a wrapper object", () => {
		const nested = JSON.stringify({
			events: [{ result: TRAILER, subtype: "success", type: "result" }],
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
