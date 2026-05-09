import { describe, expect, it } from "vitest";
import { cashProjection, computeCashFromEvents } from "../cash";
import { makeChainableDb, makeEvent } from "./test-utils";

describe("computeCashFromEvents — buy_in from chips_add_remove", () => {
	it("returns buyIn=0 and null cashOut for empty events", () => {
		const result = computeCashFromEvents([]);
		expect(result.buyIn).toBe(0);
		expect(result.cashOut).toBeNull();
		expect(result.evCashOut).toBeNull();
	});

	it("accumulates positive chips_add_remove amounts into buyIn", () => {
		const events = [
			makeEvent("chips_add_remove", { amount: 100 }),
			makeEvent("chips_add_remove", { amount: 200 }),
		];
		const result = computeCashFromEvents(events);
		expect(result.buyIn).toBe(300);
		expect(result.cashOut).toBeNull();
	});

	it("ignores negative chips_add_remove amounts (chip removes)", () => {
		const events = [
			makeEvent("chips_add_remove", { amount: 500 }),
			makeEvent("chips_add_remove", { amount: -200 }),
		];
		const result = computeCashFromEvents(events);
		expect(result.buyIn).toBe(500);
	});

	it("accumulates a single positive chips_add_remove", () => {
		const result = computeCashFromEvents([
			makeEvent("chips_add_remove", { amount: 1 }),
		]);
		expect(result.buyIn).toBe(1);
	});

	it("returns buyIn=0 when all chips_add_remove are negative", () => {
		const result = computeCashFromEvents([
			makeEvent("chips_add_remove", { amount: -100 }),
		]);
		expect(result.buyIn).toBe(0);
	});
});

describe("computeCashFromEvents — cash_out and ev_cash_out", () => {
	it("sets cashOut from session_end cashOutAmount", () => {
		const result = computeCashFromEvents([
			makeEvent("chips_add_remove", { amount: 200 }),
			makeEvent("session_end", { cashOutAmount: 350 }),
		]);
		expect(result.cashOut).toBe(350);
		expect(result.evCashOut).toBe(350);
	});

	it("computes evCashOut with positive all_in ev diff", () => {
		const result = computeCashFromEvents([
			makeEvent("chips_add_remove", { amount: 200 }),
			makeEvent("all_in", { potSize: 400, equity: 75, trials: 1, wins: 0 }),
			makeEvent("session_end", { cashOutAmount: 0 }),
		]);
		// EV diff = 400 * 0.75 - (400/1) * 0 = 300
		expect(result.evCashOut).toBe(300);
	});

	it("computes evCashOut with negative all_in ev diff (bad run)", () => {
		const result = computeCashFromEvents([
			makeEvent("chips_add_remove", { amount: 500 }),
			makeEvent("all_in", { potSize: 600, equity: 50, trials: 3, wins: 2 }),
			makeEvent("session_end", { cashOutAmount: 400 }),
		]);
		// EV diff = 600*0.5 - (600/3)*2 = 300-400 = -100
		expect(result.evCashOut).toBe(300);
	});

	it("accumulates multiple all_in ev diffs", () => {
		const result = computeCashFromEvents([
			// EV diff 1: 200 * (100/100) - (200/1)*0 = 200
			makeEvent("all_in", { potSize: 200, equity: 100, trials: 1, wins: 0 }),
			// EV diff 2: 200 * (0/100) - (200/1)*0 = 0
			makeEvent("all_in", { potSize: 200, equity: 0, trials: 1, wins: 0 }),
			makeEvent("session_end", { cashOutAmount: 50 }),
		]);
		// total EV diff = 200 + 0 = 200; evCashOut = 50 + 200 = 250
		expect(result.evCashOut).toBe(250);
	});

	it("evCashOut is null when there is no session_end", () => {
		const result = computeCashFromEvents([
			makeEvent("chips_add_remove", { amount: 300 }),
		]);
		expect(result.evCashOut).toBeNull();
	});
});

describe("computeCashFromEvents — ignores non-cash event types", () => {
	it("ignores update_stack, player_join, memo events", () => {
		const result = computeCashFromEvents([
			makeEvent("update_stack", { stackAmount: 1000 }),
			makeEvent("player_join", { isHero: true }),
			makeEvent("memo", { text: "note" }),
			makeEvent("chips_add_remove", { amount: 50 }),
		]);
		expect(result.buyIn).toBe(50);
	});
});

describe("cashProjection — DB side effects", () => {
	it("updates session_cash_detail when existing row is found", async () => {
		const events = [
			makeEvent("chips_add_remove", { amount: 300 }),
			makeEvent("session_end", { cashOutAmount: 500 }),
		];
		const existingDetail = [{ sessionId: "session-1", buyIn: 0 }];

		const db = makeChainableDb([events, existingDetail]);

		await cashProjection(
			db as unknown as Parameters<typeof cashProjection>[0],
			"session-1"
		);

		expect(db.update).toHaveBeenCalledTimes(1);
		expect(db._updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ buyIn: 300, cashOut: 500 })
		);
	});

	it("does not insert or update when no existing detail row", async () => {
		const events = [makeEvent("chips_add_remove", { amount: 100 })];
		const db = makeChainableDb([events, []]);

		await cashProjection(
			db as unknown as Parameters<typeof cashProjection>[0],
			"session-1"
		);

		expect(db.update).not.toHaveBeenCalled();
		expect(db.insert).not.toHaveBeenCalled();
	});

	it("updates buyIn to 0 and cashOut to null when no relevant events", async () => {
		const events = [makeEvent("memo", { text: "hi" })];
		const existingDetail = [{ sessionId: "session-1", buyIn: 100 }];
		const db = makeChainableDb([events, existingDetail]);

		await cashProjection(
			db as unknown as Parameters<typeof cashProjection>[0],
			"session-1"
		);

		expect(db._updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ buyIn: 0, cashOut: null, evCashOut: null })
		);
	});
});
