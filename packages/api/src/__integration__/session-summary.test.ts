import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

const SESSION_DATE = new Date("2026-09-01T00:00:00.000Z");

describe("stats.summary on D1", () => {
	test("charges tournament buy-ins and fees when totaling cash and tournament results", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Wallet" })
		);
		const tournaments = [
			{ tournamentBuyIn: 1000, entryFee: 100, prizeMoney: 0 },
			{ tournamentBuyIn: 1000, entryFee: 0, prizeMoney: 500 },
			{ tournamentBuyIn: 200, entryFee: 0, prizeMoney: 1000 },
		];
		for (const [index, result] of tournaments.entries()) {
			const id = `tournament-${index}`;
			await api.db.insert(gameSession).values({
				id,
				userId: "alice",
				kind: "tournament",
				status: "completed",
				source: "manual",
				sessionDate: SESSION_DATE,
				currencyId: wallet.id,
				updatedAt: SESSION_DATE,
			});
			await api.db
				.insert(sessionTournamentDetail)
				.values({ sessionId: id, ...result });
		}
		await api.db.insert(gameSession).values({
			id: "cash",
			userId: "alice",
			kind: "cash_game",
			status: "completed",
			source: "manual",
			sessionDate: SESSION_DATE,
			currencyId: wallet.id,
			updatedAt: SESSION_DATE,
		});
		await api.db
			.insert(sessionCashDetail)
			.values({ sessionId: "cash", buyIn: 300, cashOut: 1000 });

		expect(
			await api.alice.stats.summary({ currencyId: wallet.id })
		).toMatchObject({
			totalSessions: 4,
			totalProfitLoss: -100,
			avgProfitLoss: -25,
			winRate: 50,
		});
	});
});
