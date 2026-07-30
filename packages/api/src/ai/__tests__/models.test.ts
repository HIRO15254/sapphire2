import { describe, expect, it } from "vitest";
import { AI_MODELS, EXTRACTION_MAX_TOKENS, LATEST_MODEL } from "../models";

describe("AI model registry", () => {
	it("pins every AI feature to the latest model", () => {
		const entries = Object.entries(AI_MODELS);
		expect(entries.length).toBeGreaterThan(0);
		for (const [feature, model] of entries) {
			expect(model, `${feature} must use LATEST_MODEL`).toBe(LATEST_MODEL);
		}
	});

	it("leaves room for thinking inside max_tokens", () => {
		// Opus 5 以降 thinking はデフォルト ON で、max_tokens は thinking と
		// 応答テキストの合計に対する上限。出力サイズぎりぎりだと thinking が
		// 食い潰して構造化出力が途中で切れる。
		expect(EXTRACTION_MAX_TOKENS).toBeGreaterThanOrEqual(4096);
	});
});
