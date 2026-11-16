import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaidApiRateLimiter } from "../context";

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

function makeCaller(paidApiRateLimiter: PaidApiRateLimiter | undefined) {
	return appRouter.createCaller({
		googleMapsApiKey: "maps-key",
		openaiApiKey: "openai-key",
		paidApiRateLimiter,
		session: { user: { id: "user-1" } },
	} as unknown as Parameters<typeof appRouter.createCaller>[0]);
}

beforeEach(() => {
	mocks.parse.mockReset();
	vi.unstubAllGlobals();
});

describe("paid API rate limit", () => {
	it("rejects an over-limit caller before the provider is billed", async () => {
		const limit = vi.fn().mockResolvedValue({ success: false });
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const caller = makeCaller({ limit });

		await expect(
			caller.aiExtract.suggestIconKeywords({ name: "Poker room" })
		).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
		await expect(
			caller.location.search({ query: "casino" })
		).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

		expect(limit).toHaveBeenCalledWith({ key: "user-1" });
		expect(mocks.parse).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("fails closed when no limiter is bound", async () => {
		await expect(
			makeCaller(undefined).aiExtract.suggestIconKeywords({
				name: "Poker room",
			})
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
		expect(mocks.parse).not.toHaveBeenCalled();
	});
});
