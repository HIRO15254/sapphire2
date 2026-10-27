import { describe, expect, it } from "vitest";
import { classifyQueryFailure } from "@/shared/lib/query-failure";

describe("classifyQueryFailure", () => {
	it.each(["FORBIDDEN", "NOT_FOUND"])("treats %s as not found", (code) => {
		expect(classifyQueryFailure({ data: { code } })).toBe("not-found");
	});

	it.each([
		new Error("network failure"),
		{ data: { code: "INTERNAL_SERVER_ERROR" } },
	])("allows retrying other failures", (error) => {
		expect(classifyQueryFailure(error)).toBe("retryable");
	});
});
