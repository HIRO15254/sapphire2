import { describe, expect, it } from "vitest";
import { EXTRACTION_MAX_TOKENS } from "../models";

describe("AI model registry", () => {
	it("leaves room for thinking inside max_tokens", () => {
		expect(EXTRACTION_MAX_TOKENS).toBeGreaterThanOrEqual(4096);
	});
});
