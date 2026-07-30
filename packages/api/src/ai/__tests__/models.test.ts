import { describe, expect, it } from "vitest";
import { EXTRACTION_MAX_TOKENS } from "../models";

// AI_MODELS の各エントリが LATEST_MODEL であることは models.ts の
// `satisfies Record<string, typeof LATEST_MODEL>` が型で、呼び出し側に
// リテラルを直書きしないことは scripts/check-rules.ts が担保している。
describe("AI model registry", () => {
	it("leaves room for thinking inside max_tokens", () => {
		// Opus 5 以降 thinking はデフォルト ON で、max_tokens は thinking と
		// 応答テキストの合計に対する上限。出力サイズぎりぎりだと thinking が
		// 食い潰して構造化出力が途中で切れる。
		expect(EXTRACTION_MAX_TOKENS).toBeGreaterThanOrEqual(4096);
	});
});
