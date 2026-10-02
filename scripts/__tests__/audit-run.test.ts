import { describe, expect, it } from "vitest";

import { buildAuditCommand, isAuditAgent } from "../audit-run";

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

describe("isAuditAgent", () => {
	it("accepts only the two audit agents", () => {
		expect(isAuditAgent("claude")).toBe(true);
		expect(isAuditAgent("gemini")).toBe(false);
		expect(isAuditAgent(undefined)).toBe(false);
	});
});
