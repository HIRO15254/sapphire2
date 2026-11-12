import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	parse: vi.fn(),
}));

vi.mock("openai", () => ({
	default: class {
		responses = { parse: mocks.parse };
	},
}));

vi.mock("openai/helpers/zod", () => ({
	zodTextFormat: () => ({ type: "json_schema" }),
}));

const { appRouter } = await import("../routers");

function makeCaller() {
	return appRouter.createCaller({
		openaiApiKey: "test-key",
		session: { user: { id: "user-1" } },
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).aiExtract;
}

beforeEach(() => {
	mocks.parse.mockReset();
});

describe("aiExtract.suggestIconKeywords", () => {
	it("returns only plain lowercase search words, at most five", async () => {
		mocks.parse.mockResolvedValue({
			incomplete_details: null,
			output_parsed: {
				keywords: [
					"Money",
					"cash back",
					"money",
					"<script>",
					"percentage",
					"coin",
					"gift",
				],
			},
			status: "completed",
		});

		const result = await makeCaller().suggestIconKeywords({
			name: "レーキバック",
		});

		expect(result.keywords).toEqual([
			"money",
			"cash",
			"back",
			"percentage",
			"coin",
		]);
		const [request] = mocks.parse.mock.calls[0] ?? [];
		expect(JSON.stringify(request.input)).toContain("レーキバック");
		expect(request.instructions).not.toContain("レーキバック");
	});
});
