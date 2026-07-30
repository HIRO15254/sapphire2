import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	ExtractedTournamentDataSchema,
	TOOL_INPUT_SCHEMA,
} from "../routers/ai-extract";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("aiExtract router", () => {
	it("appRouter has aiExtract namespace", () => {
		expect(appRouter.aiExtract).toBeDefined();
	});

	it("has extractTournamentData procedure", () => {
		expect(appRouter.aiExtract.extractTournamentData).toBeDefined();
	});

	it("has extractTablePlayers procedure", () => {
		expect(appRouter.aiExtract.extractTablePlayers).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.aiExtract).sort()).toEqual(
			["extractTablePlayers", "extractTournamentData"].sort()
		);
	});

	it("both procedures are protected mutations", () => {
		expectProtected(appRouter.aiExtract.extractTournamentData);
		expectType(appRouter.aiExtract.extractTournamentData, "mutation");
		expectProtected(appRouter.aiExtract.extractTablePlayers);
		expectType(appRouter.aiExtract.extractTablePlayers, "mutation");
	});
});

describe("aiExtract.extractTournamentData input validation", () => {
	const urlSource = { kind: "url", url: "https://example.com/tournament" };
	const imageSource = {
		kind: "image",
		data: "base64data",
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
				urlSource,
				urlSource,
				urlSource,
				urlSource,
				urlSource,
				urlSource,
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

	it("rejects url source with malformed URL", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [{ kind: "url", url: "not a url" }],
		});
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

	it("accepts every allowed image media type", () => {
		for (const mediaType of [
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
		]) {
			expectAccepts(appRouter.aiExtract.extractTournamentData, {
				sources: [{ kind: "image", data: "d", mediaType }],
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
		kind: "image",
		data: "d",
		mediaType: "image/jpeg",
	};

	it("accepts dmm_waitinglist with exactly 1 source", () => {
		expectAccepts(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "dmm_waitinglist",
			sources: [validImage],
		});
	});

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
			sources: [validImage],
		});
	});

	it("rejects 0 sources", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "dmm_waitinglist",
			sources: [],
		});
	});

	it("rejects more than 1 source (length constraint)", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "dmm_waitinglist",
			sources: [validImage, validImage],
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

	it("rejects image source with empty data", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "dmm_waitinglist",
			sources: [{ kind: "image", data: "", mediaType: "image/jpeg" }],
		});
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
		"buyIn",
		"entryFee",
		"startingStack",
	])("rejects negative or fractional %s", (field) => {
		for (const value of [-1, 1.5]) {
			expect(
				ExtractedTournamentDataSchema.safeParse({ [field]: value }).success
			).toBe(false);
		}
	});
	it.each([
		"cost",
		"chips",
	])("rejects negative or fractional chip purchase %s", (field) => {
		for (const value of [-1, 1.5]) {
			const parsed = ExtractedTournamentDataSchema.safeParse({
				chipPurchases: [{ name: "Addon", cost: 0, chips: 0, [field]: value }],
			});
			expect(parsed.success).toBe(false);
		}
	});
	it.each([
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"minutes",
	])("rejects negative or fractional blind-level %s", (field) => {
		for (const value of [-1, 1.5]) {
			const parsed = ExtractedTournamentDataSchema.safeParse({
				blindLevels: [{ ...validBlindLevel, [field]: value }],
			});
			expect(parsed.success).toBe(false);
		}
	});
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

	it("rejects non-finite numeric output values", () => {
		for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(
				ExtractedTournamentDataSchema.safeParse({ buyIn: value }).success
			).toBe(false);
		}
	});
});
