import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface Job {
	if?: string;
	needs?: string[] | string;
	permissions?: Record<string, string>;
	steps: {
		"continue-on-error"?: boolean;
		env?: Record<string, string>;
		run?: string;
		uses?: string;
	}[];
}

const workflow = parse(
	readFileSync(
		new URL("../../.github/workflows/pre-merge-review.yml", import.meta.url),
		"utf8"
	)
) as { permissions: Record<string, string>; jobs: Record<string, Job> };

const resolver = Object.entries(workflow.jobs).find(([, job]) =>
	job.steps.some((step) => step.run?.includes("resolveReviewThread"))
);

describe("review workflow token permissions", () => {
	it("grants both required write permissions to thread resolution", () => {
		expect(resolver).toBeDefined();
		const permissions = resolver?.[1].permissions ?? workflow.permissions;
		expect(permissions.contents).toBe("write");
		expect(permissions["pull-requests"]).toBe("write");
	});

	it("keeps contents write out of the job executing PR code and the reviewer", () => {
		const review = workflow.jobs.review;
		expect((review.permissions ?? workflow.permissions).contents).toBe("read");
		expect(resolver?.[0]).not.toBe("review");
		expect(resolver?.[1].steps.every((step) => !step.uses)).toBe(true);
	});

	it("finishes thread resolution before checking unresolved threads for auto-merge", () => {
		expect(workflow.jobs.outcome.needs).toContain(resolver?.[0]);
	});

	it("resolves only a published successful review on a same-repository PR", () => {
		expect(resolver?.[1].needs).toBe("review");
		expect(resolver?.[1].if).toContain("needs.review.result == 'success'");
		expect(resolver?.[1].if).toContain(
			"needs.review.outputs.published == 'true'"
		);
		expect(resolver?.[1].if).toContain(
			"github.event.pull_request.head.repo.full_name == github.repository"
		);
		const step = resolver?.[1].steps.find((entry) =>
			entry.run?.includes("resolveReviewThread")
		);
		expect(step?.env?.TRAILER).toContain("needs.review.outputs.trailer");
	});

	it("preserves review outcome reporting if resolution fails or is skipped", () => {
		const step = resolver?.[1].steps.find((entry) =>
			entry.run?.includes("resolveReviewThread")
		);
		expect(step?.["continue-on-error"]).toBe(true);
		expect(workflow.jobs.outcome.if).toContain("!cancelled()");
		expect(workflow.jobs.outcome.if).not.toContain("success()");
	});
});
