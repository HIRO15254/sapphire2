import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

const SESSION_DATE = Date.UTC(2026, 8, 1) / 1000;

describe("session.list summary on D1", () => {
	test("charges the tournament buy-in and agrees with stats.summary over the same scope", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Wallet" })
		);
		const sessions = [
			{
				type: "tournament" as const,
				tournamentBuyIn: 1000,
				entryFee: 100,
				prizeMoney: 0,
			},
			{
				type: "tournament" as const,
				tournamentBuyIn: 1000,
				entryFee: 0,
				prizeMoney: 500,
			},
			{
				type: "tournament" as const,
				tournamentBuyIn: 200,
				entryFee: 0,
				prizeMoney: 1000,
			},
			{ type: "cash_game" as const, buyIn: 300, cashOut: 1000 },
		];
		for (const session of sessions) {
			requireCreatedRow(
				await api.alice.session.create({
					...session,
					sessionDate: SESSION_DATE,
					currencyId: wallet.id,
				})
			);
		}

		const list = await api.alice.session.list({ currencyId: wallet.id });
		const stats = await api.alice.stats.summary({ currencyId: wallet.id });

		expect(
			list.items.map((item) => item.profitLoss).sort((a, b) => a - b)
		).toEqual([-1100, -500, 700, 800]);
		expect(list.summary).toMatchObject({
			totalSessions: 4,
			totalProfitLoss: -100,
			avgProfitLoss: -25,
			winRate: 50,
		});
		expect({
			totalSessions: stats.totalSessions,
			totalProfitLoss: stats.totalProfitLoss,
			avgProfitLoss: stats.avgProfitLoss,
			winRate: stats.winRate,
		}).toEqual({
			totalSessions: list.summary.totalSessions,
			totalProfitLoss: list.summary.totalProfitLoss,
			avgProfitLoss: list.summary.avgProfitLoss,
			winRate: list.summary.winRate,
		});
	});
});
