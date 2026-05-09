import { describe, expect, it } from "vitest";
import {
	currencyTransactionProjection,
	getOrCreateSessionResultTypeId,
} from "../currency-transaction";
import { makeChainableDb, makeGameSession } from "./test-utils";

describe("getOrCreateSessionResultTypeId", () => {
	it("returns existing typeId when Session Result type already exists", async () => {
		const existingType = [
			{
				id: "tt-existing",
				name: "Session Result",
				userId: "user-1",
				updatedAt: new Date(),
			},
		];
		const db = makeChainableDb([existingType]);

		const result = await getOrCreateSessionResultTypeId(
			db as unknown as Parameters<typeof getOrCreateSessionResultTypeId>[0],
			"user-1"
		);

		expect(result).toBe("tt-existing");
		expect(db.insert).not.toHaveBeenCalled();
	});

	it("inserts a new Session Result type and returns its id when none exists", async () => {
		const db = makeChainableDb([[]]);

		const result = await getOrCreateSessionResultTypeId(
			db as unknown as Parameters<typeof getOrCreateSessionResultTypeId>[0],
			"user-1"
		);

		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(db.insert).toHaveBeenCalledTimes(1);
		const inserted = db._insertChain.values.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(inserted.name).toBe("Session Result");
		expect(inserted.userId).toBe("user-1");
	});
});

describe("currencyTransactionProjection — session not found", () => {
	it("returns early when session does not exist", async () => {
		const db = makeChainableDb([[]]);

		await currencyTransactionProjection(
			db as unknown as Parameters<typeof currencyTransactionProjection>[0],
			"nonexistent"
		);

		expect(db.update).not.toHaveBeenCalled();
		expect(db.insert).not.toHaveBeenCalled();
	});
});

describe("currencyTransactionProjection — no currency or not completed", () => {
	it("deletes existing transaction when currencyId is null", async () => {
		const session = makeGameSession({ currencyId: null, status: "completed" });
		const db = makeChainableDb([[session]]);

		await currencyTransactionProjection(
			db as unknown as Parameters<typeof currencyTransactionProjection>[0],
			"session-1"
		);

		expect(db.delete).toHaveBeenCalledTimes(1);
		expect(db.insert).not.toHaveBeenCalled();
	});

	it("deletes existing transaction when status is not completed", async () => {
		const session = makeGameSession({
			currencyId: "currency-1",
			status: "active",
		});
		const db = makeChainableDb([[session]]);

		await currencyTransactionProjection(
			db as unknown as Parameters<typeof currencyTransactionProjection>[0],
			"session-1"
		);

		expect(db.delete).toHaveBeenCalledTimes(1);
	});

	it("deletes existing transaction when status is paused", async () => {
		const session = makeGameSession({
			currencyId: "currency-1",
			status: "paused",
		});
		const db = makeChainableDb([[session]]);

		await currencyTransactionProjection(
			db as unknown as Parameters<typeof currencyTransactionProjection>[0],
			"session-1"
		);

		expect(db.delete).toHaveBeenCalledTimes(1);
	});
});

describe("currencyTransactionProjection — cash_game completed", () => {
	it("inserts new currency_transaction when none exists and P/L is calculable", async () => {
		const session = makeGameSession({
			kind: "cash_game",
			status: "completed",
			currencyId: "currency-1",
		});
		const cashDetail = [{ buyIn: 200, cashOut: 350 }];
		const existingTx: unknown[] = [];
		const existingType = [
			{ id: "tt-1", name: "Session Result", userId: "user-1" },
		];

		const db = makeChainableDb([
			[session],
			cashDetail,
			existingTx,
			existingType,
		]);

		await currencyTransactionProjection(
			db as unknown as Parameters<typeof currencyTransactionProjection>[0],
			"session-1"
		);

		expect(db.insert).toHaveBeenCalledTimes(1);
		const inserted = db._insertChain.values.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(inserted.amount).toBe(150);
		expect(inserted.currencyId).toBe("currency-1");
		expect(inserted.sessionId).toBe("session-1");
	});

	it("updates existing currency_transaction with new P/L", async () => {
		const session = makeGameSession({
			kind: "cash_game",
			status: "completed",
			currencyId: "currency-1",
		});
		const cashDetail = [{ buyIn: 500, cashOut: 400 }];
		const existingTx = [{ id: "tx-1", amount: 0 }];

		const db = makeChainableDb([[session], cashDetail, existingTx]);

		await currencyTransactionProjection(
			db as unknown as Parameters<typeof currencyTransactionProjection>[0],
			"session-1"
		);

		expect(db.update).toHaveBeenCalledTimes(1);
		expect(db._updateChain.set).toHaveBeenCalledWith({ amount: -100 });
	});

	it("deletes currency_transaction when cashOut is null (session not fully completed)", async () => {
		const session = makeGameSession({
			kind: "cash_game",
			status: "completed",
			currencyId: "currency-1",
		});
		const cashDetail = [{ buyIn: 200, cashOut: null }];

		const db = makeChainableDb([[session], cashDetail]);

		await currencyTransactionProjection(
			db as unknown as Parameters<typeof currencyTransactionProjection>[0],
			"session-1"
		);

		expect(db.delete).toHaveBeenCalledTimes(1);
		expect(db.insert).not.toHaveBeenCalled();
	});

	it("deletes currency_transaction when no cash detail row exists", async () => {
		const session = makeGameSession({
			kind: "cash_game",
			status: "completed",
			currencyId: "currency-1",
		});

		const db = makeChainableDb([[session], []]);

		await currencyTransactionProjection(
			db as unknown as Parameters<typeof currencyTransactionProjection>[0],
			"session-1"
		);

		expect(db.delete).toHaveBeenCalledTimes(1);
	});
});

describe("currencyTransactionProjection — tournament completed", () => {
	it("inserts currency_transaction with correct P/L for tournament", async () => {
		const session = makeGameSession({
			kind: "tournament",
			status: "completed",
			currencyId: "currency-1",
		});
		const tournDetail = [
			{ buyIn: 1000, entryFee: 100, prizeMoney: 3000, bountyPrizes: 200 },
		];
		const existingTx: unknown[] = [];
		const existingType = [
			{ id: "tt-1", name: "Session Result", userId: "user-1" },
		];

		const db = makeChainableDb([
			[session],
			tournDetail,
			existingTx,
			existingType,
		]);

		await currencyTransactionProjection(
			db as unknown as Parameters<typeof currencyTransactionProjection>[0],
			"session-1"
		);

		const inserted = db._insertChain.values.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		// P/L = (3000 + 200) - (1000 + 100) = 2100
		expect(inserted.amount).toBe(2100);
	});

	it("deletes currency_transaction when prizeMoney is null", async () => {
		const session = makeGameSession({
			kind: "tournament",
			status: "completed",
			currencyId: "currency-1",
		});
		const tournDetail = [
			{ buyIn: 1000, entryFee: 100, prizeMoney: null, bountyPrizes: null },
		];

		const db = makeChainableDb([[session], tournDetail]);

		await currencyTransactionProjection(
			db as unknown as Parameters<typeof currencyTransactionProjection>[0],
			"session-1"
		);

		expect(db.delete).toHaveBeenCalledTimes(1);
		expect(db.insert).not.toHaveBeenCalled();
	});
});
