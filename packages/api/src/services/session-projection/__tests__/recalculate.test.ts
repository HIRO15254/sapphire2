import { describe, expect, it, vi } from "vitest";
import { recalculate } from "../index";
import { makeChainableDb, makeGameSession } from "./test-utils";

vi.mock("../cash", () => ({
	cashProjection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../tournament", () => ({
	tournamentProjection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../chip-purchase", () => ({
	chipPurchaseProjection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lifecycle", () => ({
	lifecycleProjection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../currency-transaction", () => ({
	currencyTransactionProjection: vi.fn().mockResolvedValue(undefined),
}));

async function getImports() {
	const [cash, tournament, chipPurchase, lifecycle, currencyTx] =
		await Promise.all([
			import("../cash"),
			import("../tournament"),
			import("../chip-purchase"),
			import("../lifecycle"),
			import("../currency-transaction"),
		]);
	return { cash, tournament, chipPurchase, lifecycle, currencyTx };
}

describe("recalculate — manual source is no-op", () => {
	it("returns without calling any sub-projection when source is manual", async () => {
		const session = makeGameSession({ source: "manual" });
		const db = makeChainableDb([[session]]);

		await recalculate(
			db as unknown as Parameters<typeof recalculate>[0],
			"session-1"
		);

		const { cash, tournament, chipPurchase, lifecycle, currencyTx } =
			await getImports();

		expect(cash.cashProjection).not.toHaveBeenCalled();
		expect(tournament.tournamentProjection).not.toHaveBeenCalled();
		expect(chipPurchase.chipPurchaseProjection).not.toHaveBeenCalled();
		expect(lifecycle.lifecycleProjection).not.toHaveBeenCalled();
		expect(currencyTx.currencyTransactionProjection).not.toHaveBeenCalled();
	});

	it("returns without calling any sub-projection when session is not found", async () => {
		const db = makeChainableDb([[]]);

		await recalculate(
			db as unknown as Parameters<typeof recalculate>[0],
			"nonexistent"
		);

		const { cash, chipPurchase } = await getImports();
		expect(cash.cashProjection).not.toHaveBeenCalled();
		expect(chipPurchase.chipPurchaseProjection).not.toHaveBeenCalled();
	});
});

describe("recalculate — live cash_game session", () => {
	it("calls chipPurchase, lifecycle, cash, and currencyTransaction projections", async () => {
		const session = makeGameSession({ source: "live", kind: "cash_game" });
		const db = makeChainableDb([[session]]);

		vi.clearAllMocks();

		await recalculate(
			db as unknown as Parameters<typeof recalculate>[0],
			"session-1"
		);

		const { cash, tournament, chipPurchase, lifecycle, currencyTx } =
			await getImports();

		expect(chipPurchase.chipPurchaseProjection).toHaveBeenCalledTimes(1);
		expect(chipPurchase.chipPurchaseProjection).toHaveBeenCalledWith(
			expect.anything(),
			"session-1"
		);
		expect(lifecycle.lifecycleProjection).toHaveBeenCalledTimes(1);
		expect(cash.cashProjection).toHaveBeenCalledTimes(1);
		expect(cash.cashProjection).toHaveBeenCalledWith(
			expect.anything(),
			"session-1"
		);
		expect(tournament.tournamentProjection).not.toHaveBeenCalled();
		expect(currencyTx.currencyTransactionProjection).toHaveBeenCalledTimes(1);
	});
});

describe("recalculate — live tournament session", () => {
	it("calls chipPurchase, lifecycle, tournament, and currencyTransaction projections (not cash)", async () => {
		const session = makeGameSession({ source: "live", kind: "tournament" });
		const db = makeChainableDb([[session]]);

		vi.clearAllMocks();

		await recalculate(
			db as unknown as Parameters<typeof recalculate>[0],
			"session-1"
		);

		const { cash, tournament, chipPurchase, lifecycle, currencyTx } =
			await getImports();

		expect(chipPurchase.chipPurchaseProjection).toHaveBeenCalledTimes(1);
		expect(lifecycle.lifecycleProjection).toHaveBeenCalledTimes(1);
		expect(tournament.tournamentProjection).toHaveBeenCalledTimes(1);
		expect(tournament.tournamentProjection).toHaveBeenCalledWith(
			expect.anything(),
			"session-1"
		);
		expect(cash.cashProjection).not.toHaveBeenCalled();
		expect(currencyTx.currencyTransactionProjection).toHaveBeenCalledTimes(1);
	});
});
