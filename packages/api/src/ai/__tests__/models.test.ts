import { describe, expect, it } from "vitest";
import { EXTRACTION_MAX_OUTPUT_TOKENS } from "../models";

describe("AI model registry", () => {
	it("leaves room for reasoning inside max_output_tokens", () => {
		expect(EXTRACTION_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(4096);
	});
});
