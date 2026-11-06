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
	data: "ZGF0YQ==",
	kind: "image" as const,
	mediaType: "image/png" as const,
};

function makeCaller() {
	return appRouter.createCaller({
		openaiApiKey: "test-key",
		session: { user: { id: "user-1" } },
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
			incomplete_details: { reason: "max_output_tokens" },
			output_parsed: null,
			status: "incomplete",
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
			incomplete_details: null,
			output_parsed: null,
			status: "completed",
		});

		await expectMessage(
			makeCaller().extractTablePlayers({
				sourceApp: "dmm_waitinglist",
				sources: [IMAGE_SOURCE],
			}),
			"AI did not return structured data"
		);
	});

	it("reports an incomplete response that stopped for another reason", async () => {
		mocks.parse.mockResolvedValue({
			incomplete_details: { reason: "content_filter" },
			output_parsed: null,
			status: "incomplete",
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
			incomplete_details: null,
			output_parsed: {
				seats: [
					{ isHero: true, name: "Alice", seatNumber: 1 },
					{ isHero: false, name: "Duplicate", seatNumber: 1 },
					{ isHero: false, name: "Bob", seatNumber: 2 },
				],
			},
			status: "completed",
		});

		const result = await makeCaller().extractTablePlayers({
			sourceApp: "dmm_waitinglist",
			sources: [IMAGE_SOURCE],
		});

		expect(result).toEqual({
			seats: [
				{ isHero: true, name: "Alice", seatNumber: 1 },
				{ isHero: false, name: "Bob", seatNumber: 2 },
			],
		});
	});

	it("sends every screenshot as a base64 data URL image input", async () => {
		mocks.parse.mockResolvedValue({
			incomplete_details: null,
			output_parsed: { seats: [] },
			status: "completed",
		});

		await makeCaller().extractTablePlayers({
			sourceApp: "dmm_waitinglist",
			sources: [IMAGE_SOURCE, { ...IMAGE_SOURCE, mediaType: "image/webp" }],
		});

		const [call] = mocks.parse.mock.calls;
		if (!call) {
			throw new Error("Expected a screenshot extraction request");
		}
		const { input } = call[0];
		expect(input[0].content.slice(0, 2)).toEqual([
			{
				detail: "auto",
				image_url: "data:image/png;base64,ZGF0YQ==",
				type: "input_image",
			},
			{
				detail: "auto",
				image_url: "data:image/webp;base64,ZGF0YQ==",
				type: "input_image",
			},
		]);
		expect(input[0].content.at(-1)).toMatchObject({ type: "input_text" });
	});
});

describe("extractTournamentData truncation reporting", () => {
	it("reports truncation when nothing came back at max_output_tokens", async () => {
		mocks.parse.mockResolvedValue({
			incomplete_details: { reason: "max_output_tokens" },
			output_parsed: null,
			status: "incomplete",
		});

		await expectMessage(
			makeCaller().extractTournamentData({ sources: [IMAGE_SOURCE] }),
			TRUNCATED_MESSAGE
		);
	});

	it("reports missing structured data when the turn ended without parsed output", async () => {
		mocks.parse.mockResolvedValue({
			incomplete_details: null,
			output_parsed: null,
			status: "completed",
		});

		await expectMessage(
			makeCaller().extractTournamentData({ sources: [IMAGE_SOURCE] }),
			"AI did not return structured data"
		);
	});

	it("reports a parse failure when the wire and app schemas disagree", async () => {
		mocks.parse.mockResolvedValue({
			incomplete_details: null,
			output_parsed: { buyIn: -1 },
			status: "completed",
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
			incomplete_details: null,
			output_parsed: {
				blindLevels: [
					{
						ante: null,
						blind1: 100,
						blind2: 200,
						blind3: null,
						isBreak: false,
						minutes: 20,
					},
				],
				buyIn: 10_000,
				chipPurchases: null,
				entryFee: null,
				name: "Daily",
				startingStack: null,
				tableSize: null,
			},
			status: "completed",
		});

		const result = await makeCaller().extractTournamentData({
			sources: [IMAGE_SOURCE],
		});

		expect(result).toEqual({
			blindLevels: [{ blind1: 100, blind2: 200, isBreak: false, minutes: 20 }],
			buyIn: 10_000,
			name: "Daily",
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
