import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod";

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

const IMAGE_SOURCE = {
	kind: "image" as const,
	data: "base64data",
	mediaType: "image/png" as const,
};

function makeCaller() {
	return appRouter.createCaller({
		session: { user: { id: "user-1" } },
		openaiApiKey: "test-key",
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).aiExtract;
}

async function expectMessage(
	promise: Promise<unknown>,
	message: string
): Promise<void> {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(TRPCError);
		expect((error as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
		expect((error as TRPCError).message).toBe(message);
		return;
	}
	throw new Error(`expected the call to throw "${message}" but it resolved`);
}

const TRUNCATED_MESSAGE =
	"AI response was truncated (max_output_tokens reached)";

beforeEach(() => {
	mocks.parse.mockReset();
});

describe("extractTablePlayers truncation reporting", () => {
	it("reports truncation when the response hit max_output_tokens", async () => {
		mocks.parse.mockResolvedValue({
			output_parsed: null,
			status: "incomplete",
			incomplete_details: { reason: "max_output_tokens" },
		});

		await expectMessage(
			makeCaller().extractTablePlayers({
				sourceApp: "dmm_waitinglist",
				sources: [IMAGE_SOURCE],
			}),
			TRUNCATED_MESSAGE
		);
	});

	it("reports a missing structured output when the turn ended normally", async () => {
		mocks.parse.mockResolvedValue({
			output_parsed: null,
			status: "completed",
			incomplete_details: null,
		});

		await expectMessage(
			makeCaller().extractTablePlayers({
				sourceApp: "dmm_waitinglist",
				sources: [IMAGE_SOURCE],
			}),
			"AI did not return structured data"
		);
	});

	it("reports truncation ahead of the missing structured output it causes", async () => {
		mocks.parse.mockResolvedValue({
			output_parsed: null,
			status: "incomplete",
			incomplete_details: { reason: "max_output_tokens" },
		});

		await expectMessage(
			makeCaller().extractTablePlayers({
				sourceApp: "dmm_waitinglist",
				sources: [IMAGE_SOURCE],
			}),
			TRUNCATED_MESSAGE
		);
	});

	it("reports an incomplete response that stopped for another reason", async () => {
		mocks.parse.mockResolvedValue({
			output_parsed: null,
			status: "incomplete",
			incomplete_details: { reason: "content_filter" },
		});

		await expectMessage(
			makeCaller().extractTablePlayers({
				sourceApp: "dmm_waitinglist",
				sources: [IMAGE_SOURCE],
			}),
			"AI response was incomplete"
		);
	});

	it("returns deduped seats on success", async () => {
		mocks.parse.mockResolvedValue({
			output_parsed: {
				seats: [
					{ seatNumber: 1, name: "Alice", isHero: true },
					{ seatNumber: 1, name: "Duplicate", isHero: false },
					{ seatNumber: 2, name: "Bob", isHero: false },
				],
			},
			status: "completed",
			incomplete_details: null,
		});

		const result = await makeCaller().extractTablePlayers({
			sourceApp: "dmm_waitinglist",
			sources: [IMAGE_SOURCE],
		});

		expect(result).toEqual({
			seats: [
				{ seatNumber: 1, name: "Alice", isHero: true },
				{ seatNumber: 2, name: "Bob", isHero: false },
			],
		});
	});

	it("sends every screenshot as a base64 data URL image input", async () => {
		mocks.parse.mockResolvedValue({
			output_parsed: { seats: [] },
			status: "completed",
			incomplete_details: null,
		});

		await makeCaller().extractTablePlayers({
			sourceApp: "dmm_waitinglist",
			sources: [IMAGE_SOURCE, { ...IMAGE_SOURCE, mediaType: "image/webp" }],
		});

		const { input } = mocks.parse.mock.calls[0][0];
		expect(input[0].content.slice(0, 2)).toEqual([
			{
				type: "input_image",
				detail: "auto",
				image_url: "data:image/png;base64,base64data",
			},
			{
				type: "input_image",
				detail: "auto",
				image_url: "data:image/webp;base64,base64data",
			},
		]);
		expect(input[0].content.at(-1)).toMatchObject({ type: "input_text" });
	});
});

describe("extractTournamentData truncation reporting", () => {
	it("reports truncation when nothing came back at max_output_tokens", async () => {
		mocks.parse.mockResolvedValue({
			output_parsed: null,
			status: "incomplete",
			incomplete_details: { reason: "max_output_tokens" },
		});

		await expectMessage(
			makeCaller().extractTournamentData({ sources: [IMAGE_SOURCE] }),
			TRUNCATED_MESSAGE
		);
	});

	it("reports missing structured data when the turn ended without parsed output", async () => {
		mocks.parse.mockResolvedValue({
			output_parsed: null,
			status: "completed",
			incomplete_details: null,
		});

		await expectMessage(
			makeCaller().extractTournamentData({ sources: [IMAGE_SOURCE] }),
			"AI did not return structured data"
		);
	});

	it("reports a parse failure when the wire and app schemas disagree", async () => {
		mocks.parse.mockResolvedValue({
			output_parsed: { buyIn: -1 },
			status: "completed",
			incomplete_details: null,
		});

		await expectMessage(
			makeCaller().extractTournamentData({ sources: [IMAGE_SOURCE] }),
			"Failed to parse AI response"
		);
	});

	it("converts the ZodError the SDK throws for an off-schema response", async () => {
		mocks.parse.mockRejectedValue(
			new z.ZodError([
				{ code: "custom", message: "off schema", path: ["buyIn"] },
			])
		);

		await expectMessage(
			makeCaller().extractTournamentData({ sources: [IMAGE_SOURCE] }),
			"Failed to parse AI response"
		);
	});

	it("lets a transport error from the SDK surface unchanged", async () => {
		mocks.parse.mockRejectedValue(new Error("connection reset"));

		await expect(
			makeCaller().extractTournamentData({ sources: [IMAGE_SOURCE] })
		).rejects.toThrow("connection reset");
	});

	it("drops the nulls strict Structured Outputs forces the model to emit", async () => {
		mocks.parse.mockResolvedValue({
			output_parsed: {
				name: "Daily",
				buyIn: 10_000,
				entryFee: null,
				startingStack: null,
				tableSize: null,
				chipPurchases: null,
				blindLevels: [
					{
						isBreak: false,
						blind1: 100,
						blind2: 200,
						blind3: null,
						ante: null,
						minutes: 20,
					},
				],
			},
			status: "completed",
			incomplete_details: null,
		});

		const result = await makeCaller().extractTournamentData({
			sources: [IMAGE_SOURCE],
		});

		expect(result).toEqual({
			name: "Daily",
			buyIn: 10_000,
			blindLevels: [{ isBreak: false, blind1: 100, blind2: 200, minutes: 20 }],
		});
		expect("entryFee" in result).toBe(false);
		expect("chipPurchases" in result).toBe(false);
	});
});

describe("missing API key", () => {
	it("reports the OpenAI key as the missing configuration", async () => {
		const caller = appRouter.createCaller({
			session: { user: { id: "user-1" } },
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).aiExtract;

		await expectMessage(
			caller.extractTournamentData({ sources: [IMAGE_SOURCE] }),
			"AI extraction is not configured (missing OPENAI_API_KEY)"
		);
	});
});
