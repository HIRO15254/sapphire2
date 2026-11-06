import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	ExtractedTournamentDataSchema,
	TABLE_PLAYERS_OUTPUT_SCHEMA,
	TOURNAMENT_OUTPUT_SCHEMA,
} from "../routers/ai-extract";
import { expectAccepts, expectRejects } from "./test-utils";

describe("aiExtract.extractTournamentData input validation", () => {
	const urlSource = { kind: "url", url: "https://example.com/tournament" };
	const imageSource = {
		data: "ZGF0YQ==",
		kind: "image",
		mediaType: "image/png",
	};

	it("rejects URL sources so the Worker never fetches a user-supplied URL", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [urlSource],
		});
	});

	it("accepts up to 5 uploaded image sources (upper boundary)", () => {
		expectAccepts(appRouter.aiExtract.extractTournamentData, {
			sources: [
				imageSource,
				imageSource,
				imageSource,
				imageSource,
				imageSource,
			],
		});
	});

	it("rejects more than 5 sources", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [
				imageSource,
				imageSource,
				imageSource,
				imageSource,
				imageSource,
				imageSource,
			],
		});
	});

	it("rejects empty sources array", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [],
		});
	});

	it("rejects mixed URL and image sources", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [urlSource, imageSource],
		});
	});

	it("rejects image source with unknown media type", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [{ data: "ZGF0YQ==", kind: "image", mediaType: "image/bmp" }],
		});
	});

	it("rejects image source with empty data", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [{ data: "", kind: "image", mediaType: "image/png" }],
		});
	});

	it("rejects malformed base64 image data before contacting the provider", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [{ data: "not base64", kind: "image", mediaType: "image/png" }],
		});
	});

	it("accepts every allowed image media type", () => {
		for (const mediaType of [
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
		]) {
			expectAccepts(appRouter.aiExtract.extractTournamentData, {
				sources: [{ data: "ZGF0YQ==", kind: "image", mediaType }],
			});
		}
	});

	it("rejects source missing discriminator", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [{ url: "https://example.com" }],
		});
	});
});

describe("aiExtract.extractTablePlayers input validation", () => {
	const validImage = {
		data: "ZGF0YQ==",
		kind: "image",
		mediaType: "image/jpeg",
	};

	it("accepts dmm_waitinglist with exactly 1 source", () => {
		expectAccepts(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "dmm_waitinglist",
			sources: [validImage],
		});
	});

	it("rejects an unknown sourceApp", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "some_other_app",
			sources: [validImage],
		});
	});

	it("rejects missing sources", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "dmm_waitinglist",
		});
	});

	it("rejects missing sourceApp", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sources: [validImage],
		});
	});
});

describe("TABLE_PLAYERS_OUTPUT_SCHEMA seat numbers", () => {
	function scanWithSeat(seatNumber: number) {
		return {
			seats: [
				{ isHero: false, name: "First", seatNumber: 1 },
				{ isHero: false, name: "Player", seatNumber },
			],
		};
	}

	it("accepts every seat of a 10-max table, including seat 10", () => {
		expect(
			TABLE_PLAYERS_OUTPUT_SCHEMA.safeParse(scanWithSeat(10)).success
		).toBe(true);
	});

	it("rejects the whole scan when a seat number lies outside any table", () => {
		for (const seatNumber of [0, 11]) {
			expect(
				TABLE_PLAYERS_OUTPUT_SCHEMA.safeParse(scanWithSeat(seatNumber)).success
			).toBe(false);
		}
	});
});

describe("ExtractedTournamentDataSchema numeric boundaries", () => {
	const validBlindLevel = { isBreak: false };
	it("accepts zero and positive integer tournament values", () => {
		const parsed = ExtractedTournamentDataSchema.safeParse({
			blindLevels: [
				{
					...validBlindLevel,
					ante: 0,
					blind1: 0,
					blind2: 100,
					blind3: 200,
					minutes: 10,
				},
			],
			buyIn: 0,
			chipPurchases: [{ chips: 500, cost: 0, name: "Addon" }],
			entryFee: 12,
			startingStack: 1000,
			tableSize: 2,
		});
		expect(parsed.success).toBe(true);
	});
	it.each(["buyIn", "entryFee", "startingStack"])(
		"rejects negative or fractional %s",
		(field) => {
			for (const value of [-1, 1.5]) {
				expect(
					ExtractedTournamentDataSchema.safeParse({ [field]: value }).success
				).toBe(false);
			}
		}
	);
	it.each(["cost", "chips"])(
		"rejects negative or fractional chip purchase %s",
		(field) => {
			for (const value of [-1, 1.5]) {
				const parsed = ExtractedTournamentDataSchema.safeParse({
					chipPurchases: [{ chips: 0, cost: 0, name: "Addon", [field]: value }],
				});
				expect(parsed.success).toBe(false);
			}
		}
	);
	it.each(["blind1", "blind2", "blind3", "ante", "minutes"])(
		"rejects negative or fractional blind-level %s",
		(field) => {
			for (const value of [-1, 1.5]) {
				const parsed = ExtractedTournamentDataSchema.safeParse({
					blindLevels: [{ ...validBlindLevel, [field]: value }],
				});
				expect(parsed.success).toBe(false);
			}
		}
	);
	it("accepts table sizes 2 through 10 and rejects 1, 11, and fractions", () => {
		for (const tableSize of [2, 10]) {
			expect(
				ExtractedTournamentDataSchema.safeParse({ tableSize }).success
			).toBe(true);
		}
		for (const tableSize of [1, 11, 2.5]) {
			expect(
				ExtractedTournamentDataSchema.safeParse({ tableSize }).success
			).toBe(false);
		}
	});

	it("keeps the OpenAI output schema aligned with numeric Zod bounds", () => {
		const base = {
			blindLevels: null,
			buyIn: null,
			chipPurchases: null,
			entryFee: null,
			name: null,
			startingStack: null,
			tableSize: null,
		};
		expect(TOURNAMENT_OUTPUT_SCHEMA.safeParse(base).success).toBe(true);

		for (const value of [-1, 1.5]) {
			expect(
				TOURNAMENT_OUTPUT_SCHEMA.safeParse({ ...base, buyIn: value }).success
			).toBe(false);
		}
		for (const tableSize of [1, 11, 2.5]) {
			expect(
				TOURNAMENT_OUTPUT_SCHEMA.safeParse({ ...base, tableSize }).success
			).toBe(false);
		}
		expect(
			TOURNAMENT_OUTPUT_SCHEMA.safeParse({
				...base,
				chipPurchases: [{ chips: 0, cost: -1, name: "Addon" }],
			}).success
		).toBe(false);
		expect(
			TOURNAMENT_OUTPUT_SCHEMA.safeParse({
				...base,
				blindLevels: [
					{
						ante: null,
						blind1: null,
						blind2: null,
						blind3: null,
						isBreak: false,
						minutes: 1.5,
					},
				],
			}).success
		).toBe(false);
	});

	it("requires every top-level key so strict Structured Outputs can omit nothing", () => {
		expect(TOURNAMENT_OUTPUT_SCHEMA.safeParse({ name: "Daily" }).success).toBe(
			false
		);
	});

	it("rejects non-finite numeric output values", () => {
		for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(
				ExtractedTournamentDataSchema.safeParse({ buyIn: value }).success
			).toBe(false);
		}
	});
});
