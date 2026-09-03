import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	ExtractedTournamentDataSchema,
	TOOL_INPUT_SCHEMA,
} from "../routers/ai-extract";
import {
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

const imageSource = {
	kind: "image",
	data: "base64data",
	mediaType: "image/png",
} as const;

const urlSource = { kind: "url", url: "https://example.com/tournament" };

describe("aiExtract router", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.aiExtract).sort()).toEqual(
			["extractTablePlayers", "extractTournamentData"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.aiExtract, {
			extractTablePlayers: "mutation",
			extractTournamentData: "mutation",
		});
	});
});

describe("aiExtract.extractTournamentData input validation", () => {
	it("rejects URL sources so the Worker never fetches a user-supplied URL", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [urlSource],
		});
	});

	it.each([
		[0, false],
		[1, true],
		[5, true],
		[6, false],
	])("accepts %i image sources: %s (1..5 allowed)", (count, accepted) => {
		const input = { sources: Array.from({ length: count }, () => imageSource) };
		if (accepted) {
			expectAccepts(appRouter.aiExtract.extractTournamentData, input);
		} else {
			expectRejects(appRouter.aiExtract.extractTournamentData, input);
		}
	});

	it("rejects image source with unknown media type", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [{ kind: "image", data: "d", mediaType: "image/bmp" }],
		});
	});

	it("rejects image source with empty data", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [{ kind: "image", data: "", mediaType: "image/png" }],
		});
	});

	it.each([
		"image/jpeg",
		"image/png",
		"image/gif",
		"image/webp",
	])("accepts the %s media type", (mediaType) => {
		expectAccepts(appRouter.aiExtract.extractTournamentData, {
			sources: [{ kind: "image", data: "d", mediaType }],
		});
	});
});

describe("aiExtract.extractTablePlayers input validation", () => {
	it("rejects URL sources so Anthropic never fetches a user-supplied URL", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "dmm_waitinglist",
			sources: [
				{ kind: "url", url: "https://example.com/table-screenshot.png" },
			],
		});
	});

	it("rejects an unknown sourceApp", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "some_other_app",
			sources: [imageSource],
		});
	});

	it.each([
		[0, false],
		[1, true],
		[2, false],
	])("accepts %i image sources: %s (exactly 1 allowed)", (count, accepted) => {
		const input = {
			sourceApp: "dmm_waitinglist",
			sources: Array.from({ length: count }, () => imageSource),
		};
		if (accepted) {
			expectAccepts(appRouter.aiExtract.extractTablePlayers, input);
		} else {
			expectRejects(appRouter.aiExtract.extractTablePlayers, input);
		}
	});
});

describe("ExtractedTournamentDataSchema numeric boundaries", () => {
	const validBlindLevel = { isBreak: false };

	it("accepts zero and positive integer tournament values", () => {
		const parsed = ExtractedTournamentDataSchema.safeParse({
			buyIn: 0,
			entryFee: 12,
			startingStack: 1000,
			tableSize: 2,
			chipPurchases: [{ name: "Addon", cost: 0, chips: 500 }],
			blindLevels: [
				{
					...validBlindLevel,
					blind1: 0,
					blind2: 100,
					blind3: 200,
					ante: 0,
					minutes: 10,
				},
			],
		});
		expect(parsed.success).toBe(true);
	});

	it.each([
		["buyIn", (value: number) => ({ buyIn: value })],
		["entryFee", (value: number) => ({ entryFee: value })],
		["startingStack", (value: number) => ({ startingStack: value })],
		[
			"chipPurchases.cost",
			(value: number) => ({
				chipPurchases: [{ name: "Addon", cost: value, chips: 0 }],
			}),
		],
		[
			"chipPurchases.chips",
			(value: number) => ({
				chipPurchases: [{ name: "Addon", cost: 0, chips: value }],
			}),
		],
		[
			"blindLevels.blind1",
			(value: number) => ({
				blindLevels: [{ ...validBlindLevel, blind1: value }],
			}),
		],
		[
			"blindLevels.blind2",
			(value: number) => ({
				blindLevels: [{ ...validBlindLevel, blind2: value }],
			}),
		],
		[
			"blindLevels.blind3",
			(value: number) => ({
				blindLevels: [{ ...validBlindLevel, blind3: value }],
			}),
		],
		[
			"blindLevels.ante",
			(value: number) => ({
				blindLevels: [{ ...validBlindLevel, ante: value }],
			}),
		],
		[
			"blindLevels.minutes",
			(value: number) => ({
				blindLevels: [{ ...validBlindLevel, minutes: value }],
			}),
		],
	])("rejects negative, fractional and non-finite %s", (_field, build) => {
		for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(
				ExtractedTournamentDataSchema.safeParse(build(value)).success
			).toBe(false);
		}
	});

	it.each([
		[1, false],
		[2, true],
		[2.5, false],
		[10, true],
		[11, false],
	])("tableSize %s is accepted: %s (2..10 integers)", (tableSize, accepted) => {
		expect(ExtractedTournamentDataSchema.safeParse({ tableSize }).success).toBe(
			accepted
		);
	});

	it("keeps the Anthropic tool schema aligned with numeric Zod bounds", () => {
		const properties = TOOL_INPUT_SCHEMA.properties;
		expect(properties.buyIn).toMatchObject({ type: "integer", minimum: 0 });
		expect(properties.tableSize).toMatchObject({
			type: "integer",
			minimum: 2,
			maximum: 10,
		});
		expect(properties.chipPurchases.items.properties.cost).toMatchObject({
			type: "integer",
			minimum: 0,
		});
		expect(properties.blindLevels.items.properties.minutes).toMatchObject({
			type: "integer",
			minimum: 0,
		});
	});
});
