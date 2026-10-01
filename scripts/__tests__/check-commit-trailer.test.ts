import { describe, expect, it } from "vitest";

import { missingTrailers } from "../check-commit-trailer";

const subject = "fix(web): 戻るボタンの遷移先を直す (SA2-1)";

function commit(...trailers: string[]): string {
	return [subject, "", "本文。", "", ...trailers, ""].join("\n");
}

function names(message: string, env: Record<string, string>): string[] {
	return missingTrailers(message, env).map((agent) => agent.name);
}

describe("missingTrailers", () => {
	it("does not check commits made outside an agent", () => {
		expect(names(commit(), {})).toEqual([]);
	});

	it.each([
		[
			"Claude Code",
			{ CLAUDECODE: "1" },
			"Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>",
		],
		[
			"Codex",
			{ CODEX_MANAGED_BY_NPM: "1" },
			"Co-Authored-By: Codex (gpt-5.5) <noreply@openai.com>",
		],
		[
			"Gemini CLI",
			{ GEMINI_CLI: "1" },
			"Co-Authored-By: Gemini CLI (gemini-3-pro) <noreply@google.com>",
		],
	])("requires the %s trailer only when that agent commits", (name, env, trailer) => {
		expect(names(commit(), env)).toEqual([name]);
		expect(names(commit(trailer), env)).toEqual([]);
	});

	it("does not let another agent's trailer stand in", () => {
		expect(
			names(commit("Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"), {
				CODEX_MANAGED_BY_NPM: "1",
			})
		).toEqual(["Codex"]);
	});

	it("rejects a Codex or Gemini trailer that does not name the model", () => {
		expect(
			names(commit("Co-Authored-By: Codex <noreply@openai.com>"), {
				CODEX_MANAGED_BY_NPM: "1",
			})
		).toEqual(["Codex"]);
	});

	it("accepts git's lower-case trailer key and CRLF line endings", () => {
		const message = commit(
			"Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>"
		).replaceAll("\n", "\r\n");
		expect(names(message, { CLAUDECODE: "1" })).toEqual([]);
	});
});
