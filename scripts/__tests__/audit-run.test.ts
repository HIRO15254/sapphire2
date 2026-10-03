import { describe, expect, it } from "vitest";

import { buildAuditCommand, isAuditAgent, isAuditTask } from "../audit-run";

describe("buildAuditCommand", () => {
	it("pins Claude to opus at xhigh effort, whatever the interactive settings are", () => {
		const { args } = buildAuditCommand("claude");
		expect(
			args.slice(args.indexOf("--model"), args.indexOf("--model") + 2)
		).toEqual(["--model", "opus"]);
		expect(
			args.slice(args.indexOf("--effort"), args.indexOf("--effort") + 2)
		).toEqual(["--effort", "xhigh"]);
	});

	it("pins Codex to gpt-5.6-sol at xhigh reasoning effort", () => {
		const { args } = buildAuditCommand("codex");
		expect(args).toContain("gpt-5.6-sol");
		expect(args).toContain("model_reasoning_effort=xhigh");
	});

	it("tells each agent its own name, which the audit skill uses to decide whose turn it is", () => {
		expect(buildAuditCommand("claude").input).toContain(
			"Your agent name is claude."
		);
		expect(buildAuditCommand("codex").input).toContain(
			"Your agent name is codex."
		);
	});
});

describe("task selection", () => {
	it("points the session at the audit skill by default and at the UI patrol skill on request", () => {
		expect(buildAuditCommand("claude").input).toContain(
			"skills/audit/SKILL.md"
		);
		expect(buildAuditCommand("claude", "ui-patrol").input).toContain(
			"skills/ui-patrol/SKILL.md"
		);
	});

	it("accepts only known tasks, so a typo cannot start a session on a missing skill", () => {
		expect(isAuditTask("ui-patrol")).toBe(true);
		expect(isAuditTask("patrol")).toBe(false);
	});
});

describe("isAuditAgent", () => {
	it("accepts only the two audit agents", () => {
		expect(isAuditAgent("claude")).toBe(true);
		expect(isAuditAgent("gemini")).toBe(false);
		expect(isAuditAgent(undefined)).toBe(false);
	});
});
