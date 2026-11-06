import { describe, expect, it } from "vitest";
import { handUpdateInputSchema } from "../services/hand";

const context = {
	buttonSeat: 0,
	id: "hand-1",
	levelOrdinal: null,
	stakes: { ante: 200, anteType: "bb", blind1: 100, blind2: 200 },
	tableSize: 6,
	variantId: null,
};

const summaryValues = {
	boards: ["Ah Kd 7c 2s 9h"],
	memo: null,
	pot: 1200,
	rake: 60,
};

function seat(position: number, overrides: Record<string, unknown> = {}) {
	return {
		holeCards: null,
		net: null,
		playerId: null,
		seat: position,
		showed: false,
		startStack: 20_000,
		...overrides,
	};
}

function fullHand(overrides: Record<string, unknown> = {}) {
	return {
		...context,
		...summaryValues,
		actions: [
			{ action: "raise", allIn: false, amount: 600, seat: 3, street: 0 },
			{ action: "call", allIn: false, amount: 400, seat: 0, street: 0 },
		],
		detail: "full",
		seats: [seat(0, { holeCards: "As Ks", playerId: "self" }), seat(3)],
		...overrides,
	};
}

describe("handUpdateInputSchema", () => {
	it("accepts a full hand, a summary with only Hero's seat, and a bare count", () => {
		expect(handUpdateInputSchema.safeParse(fullHand()).success).toBe(true);
		expect(
			handUpdateInputSchema.safeParse({
				...context,
				...summaryValues,
				detail: "summary",
				hero: {
					holeCards: "Ts 9s",
					net: -600,
					playerId: "self",
					seat: 2,
					showed: false,
					startStack: 5000,
				},
			}).success
		).toBe(true);
		expect(
			handUpdateInputSchema.safeParse({ ...context, detail: "count" }).success
		).toBe(true);
	});

	it("accepts a run-it-twice whose boards share the flop and a shown seat with its cards", () => {
		expect(
			handUpdateInputSchema.safeParse(
				fullHand({
					actions: [
						{ action: "raise", allIn: true, amount: 600, seat: 3, street: 0 },
						{ action: "call", allIn: false, amount: 400, seat: 0, street: 0 },
						{ action: "show", allIn: false, amount: null, seat: 3, street: 3 },
					],
					boards: ["Ah Kd 7c 2s 9h", "Ah Kd 7c 3d 4c"],
					seats: [
						seat(0, { holeCards: "As Ks", playerId: "self" }),
						seat(3, { holeCards: "Qd Qc", showed: true }),
					],
				})
			).success
		).toBe(true);
	});

	const hero = seat(0, { playerId: "self" });
	const villain = seat(3);
	it.each<[string, Record<string, unknown>, (string | number)[]]>([
		["a malformed card", { boards: ["Ah 1d 7c"] }, ["boards", 0]],
		[
			"the same card twice on one board",
			{ boards: ["Ah Kd 7c", "Ah Ah 7c"] },
			["boards", 1],
		],
		["a board of six cards", { boards: ["Ah Kd 7c 2s 9h 3d"] }, ["boards", 0]],
		["five boards", { boards: ["Ah", "Kd", "7c", "2s", "9h"] }, ["boards"]],
		["a negative pot", { pot: -1 }, ["pot"]],
		[
			"a seat outside 0 to 9",
			{ seats: [hero, villain, seat(10)] },
			["seats", 2, "seat"],
		],
		[
			"hole cards of eight cards",
			{
				seats: [
					seat(0, { holeCards: "2s 3s 4s 5s 6s 7s 8s 9s", playerId: "self" }),
					villain,
				],
			},
			["seats", 0, "holeCards"],
		],
		[
			"the same player in two seats",
			{ seats: [hero, seat(3, { playerId: "self" })] },
			["seats"],
		],
		["the same seat twice", { seats: [hero, villain, seat(3)] }, ["seats"]],
		[
			"a shown seat without its hole cards",
			{ seats: [hero, seat(3, { showed: true })] },
			["seats", 1, "holeCards"],
		],
		[
			"a show action from a seat not marked as shown",
			{
				actions: [
					{ action: "show", allIn: false, amount: null, seat: 3, street: 3 },
				],
				seats: [hero, seat(3, { holeCards: "Qd Qc" })],
			},
			["actions", 0, "seat"],
		],
		[
			"an action from an empty seat",
			{
				actions: [
					{ action: "fold", allIn: false, amount: null, seat: 5, street: 0 },
				],
			},
			["actions", 0, "seat"],
		],
		[
			"an action outside the eleven values",
			{
				actions: [
					{ action: "limp", allIn: false, amount: null, seat: 3, street: 0 },
				],
			},
			["actions", 0, "action"],
		],
		[
			"a street past 7",
			{
				actions: [
					{ action: "check", allIn: false, amount: null, seat: 3, street: 8 },
				],
			},
			["actions", 0, "street"],
		],
		[
			"a stakes key outside blind1-3, ante and anteType",
			{ stakes: { bb: 200, sb: 100 } },
			["stakes"],
		],
		[
			"an ante type outside none, all and bb",
			{ stakes: { ante: 100, anteType: "button" } },
			["stakes", "anteType"],
		],
	])("rejects %s", (_label, overrides, path) => {
		const result = handUpdateInputSchema.safeParse(fullHand(overrides));
		expect(result.error?.issues.map((issue) => issue.path)).toEqual([path]);
	});

	it("rejects a summary without Hero's seat", () => {
		const result = handUpdateInputSchema.safeParse({
			...context,
			...summaryValues,
			detail: "summary",
		});
		expect(result.error?.issues.map((issue) => issue.path)).toEqual([["hero"]]);
	});

	it("rejects a summary whose Hero showed without hole cards", () => {
		const result = handUpdateInputSchema.safeParse({
			...context,
			...summaryValues,
			detail: "summary",
			hero: {
				holeCards: null,
				net: 600,
				playerId: "self",
				seat: 2,
				showed: true,
				startStack: null,
			},
		});
		expect(result.error?.issues.map((issue) => issue.path)).toEqual([
			["hero", "holeCards"],
		]);
	});
});
