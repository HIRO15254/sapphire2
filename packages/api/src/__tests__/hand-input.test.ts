import { describe, expect, it } from "vitest";
import { handSaveInputSchema } from "../services/hand";

const context = {
	id: "hand-1",
	buttonSeat: 0,
	tableSize: 6,
	levelOrdinal: null,
	stakes: { sb: 100, bb: 200 },
	variantId: null,
};

const summaryValues = {
	board: "Ah Kd 7c 2s 9h",
	pot: 1200,
	heroNet: -600,
	memo: null,
};

function seat(position: number, overrides: Record<string, unknown> = {}) {
	return {
		seat: position,
		playerId: null,
		isHero: false,
		startStack: 20_000,
		holeCards: null,
		net: null,
		showed: false,
		...overrides,
	};
}

function fullHand(overrides: Record<string, unknown> = {}) {
	return {
		...context,
		...summaryValues,
		detail: "full",
		seats: [seat(0, { isHero: true, holeCards: "As Ks" }), seat(3)],
		actions: [
			{ street: 0, seat: 3, action: "raise", amount: 600, allIn: false },
			{ street: 0, seat: 0, action: "call", amount: 400, allIn: false },
		],
		...overrides,
	};
}

describe("handSaveInputSchema", () => {
	it("accepts a full hand, a summary with only Hero's seat, and a bare count with a signed Hero result", () => {
		expect(handSaveInputSchema.safeParse(fullHand()).success).toBe(true);
		expect(
			handSaveInputSchema.safeParse({
				...context,
				...summaryValues,
				detail: "summary",
				hero: {
					seat: 2,
					startStack: 5000,
					holeCards: "Ts 9s",
					net: -600,
					showed: false,
				},
			}).success
		).toBe(true);
		expect(
			handSaveInputSchema.safeParse({ ...context, detail: "count" }).success
		).toBe(true);
	});

	const hero = seat(0, { isHero: true });
	const villain = seat(3);
	it.each<[string, Record<string, unknown>, (string | number)[]]>([
		["a malformed card", { board: "Ah 1d 7c" }, ["board"]],
		["a lowercase rank", { board: "ah Kd 7c" }, ["board"]],
		["the same card twice on the board", { board: "Ah Ah 7c" }, ["board"]],
		["a board of six cards", { board: "Ah Kd 7c 2s 9h 3d" }, ["board"]],
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
					seat(0, { isHero: true, holeCards: "2s 3s 4s 5s 6s 7s 8s 9s" }),
					villain,
				],
			},
			["seats", 0, "holeCards"],
		],
		["two Hero seats", { seats: [hero, seat(3, { isHero: true })] }, ["seats"]],
		["the same seat twice", { seats: [hero, villain, seat(3)] }, ["seats"]],
		[
			"an action from an empty seat",
			{
				actions: [
					{ street: 0, seat: 5, action: "fold", amount: null, allIn: false },
				],
			},
			["actions", 0, "seat"],
		],
		[
			"an action outside the eleven values",
			{
				actions: [
					{ street: 0, seat: 3, action: "limp", amount: null, allIn: false },
				],
			},
			["actions", 0, "action"],
		],
		[
			"a street past 7",
			{
				actions: [
					{ street: 8, seat: 3, action: "check", amount: null, allIn: false },
				],
			},
			["actions", 0, "street"],
		],
		[
			"a stakes key outside sb, bb, ante and straddle",
			{ stakes: { bigBlind: 200 } },
			["stakes"],
		],
	])("rejects %s", (_label, overrides, path) => {
		const result = handSaveInputSchema.safeParse(fullHand(overrides));
		expect(result.error?.issues.map((issue) => issue.path)).toEqual([path]);
	});

	it("rejects a summary without Hero's seat", () => {
		const result = handSaveInputSchema.safeParse({
			...context,
			...summaryValues,
			detail: "summary",
		});
		expect(result.error?.issues.map((issue) => issue.path)).toEqual([["hero"]]);
	});
});
