import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	parse: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = { create: mocks.create, parse: mocks.parse };
	},
}));

vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({
	zodOutputFormat: () => ({ type: "json_schema" }),
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
		anthropicApiKey: "test-key",
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

beforeEach(() => {
	mocks.create.mockReset();
	mocks.parse.mockReset();
});

describe("extractTablePlayers truncation reporting", () => {
	it("reports truncation when the response hit max_tokens", async () => {
		// Opus 5 以降 thinking はデフォルト ON で max_tokens を共有するため、
		// 打ち切りは現実に起こりうる失敗経路。
		mocks.parse.mockResolvedValue({
			parsed_output: null,
			stop_reason: "max_tokens",
		});

		await expectMessage(
			makeCaller().extractTablePlayers({
				sourceApp: "dmm_waitinglist",
				sources: [IMAGE_SOURCE],
			}),
			"AI response was truncated (max_tokens reached)"
		);
	});

	it("reports a missing structured output when the turn ended normally", async () => {
		mocks.parse.mockResolvedValue({
			parsed_output: null,
			stop_reason: "end_turn",
		});

		await expectMessage(
			makeCaller().extractTablePlayers({
				sourceApp: "dmm_waitinglist",
				sources: [IMAGE_SOURCE],
			}),
			"AI did not return structured data"
		);
	});

	it("returns deduped seats on success", async () => {
		mocks.parse.mockResolvedValue({
			parsed_output: {
				seats: [
					{ seatNumber: 1, name: "Alice", isHero: true },
					{ seatNumber: 1, name: "Duplicate", isHero: false },
					{ seatNumber: 2, name: "Bob", isHero: false },
				],
			},
			stop_reason: "end_turn",
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
});

describe("extractTournamentData truncation reporting", () => {
	it("reports truncation when no tool_use block came back at max_tokens", async () => {
		mocks.create.mockResolvedValue({
			content: [{ type: "text", text: "partial" }],
			stop_reason: "max_tokens",
		});

		await expectMessage(
			makeCaller().extractTournamentData({ sources: [IMAGE_SOURCE] }),
			"AI response was truncated (max_tokens reached)"
		);
	});

	it("reports missing structured data when the turn ended without a tool_use block", async () => {
		mocks.create.mockResolvedValue({
			content: [{ type: "text", text: "no tool call" }],
			stop_reason: "end_turn",
		});

		await expectMessage(
			makeCaller().extractTournamentData({ sources: [IMAGE_SOURCE] }),
			"AI did not return structured data"
		);
	});

	it("reports truncation when a tool_use block was cut off mid-input", async () => {
		// 打ち切りでは tool_use ブロック自体は返るが input が途中で切れるため、
		// スキーマ不一致と区別できる必要がある。
		mocks.create.mockResolvedValue({
			content: [
				{
					type: "tool_use",
					name: "extract_tournament_data",
					input: { buyIn: -1 },
				},
			],
			stop_reason: "max_tokens",
		});

		await expectMessage(
			makeCaller().extractTournamentData({ sources: [IMAGE_SOURCE] }),
			"AI response was truncated (max_tokens reached)"
		);
	});

	it("reports a parse failure when the schema rejects a complete response", async () => {
		mocks.create.mockResolvedValue({
			content: [
				{
					type: "tool_use",
					name: "extract_tournament_data",
					input: { buyIn: -1 },
				},
			],
			stop_reason: "end_turn",
		});

		await expectMessage(
			makeCaller().extractTournamentData({ sources: [IMAGE_SOURCE] }),
			"Failed to parse AI response"
		);
	});

	it("returns the parsed tournament data on success", async () => {
		mocks.create.mockResolvedValue({
			content: [
				{
					type: "tool_use",
					name: "extract_tournament_data",
					input: { name: "Daily", buyIn: 5000, tableSize: 9 },
				},
			],
			stop_reason: "end_turn",
		});

		const result = await makeCaller().extractTournamentData({
			sources: [IMAGE_SOURCE],
		});

		expect(result).toEqual({ name: "Daily", buyIn: 5000, tableSize: 9 });
	});
});
