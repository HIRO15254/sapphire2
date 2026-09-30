import { currencyTransaction } from "@sapphire2/db/schema/currency";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

describe("live-session persisted lifecycle", () => {
	test("records cash buy-ins, settles the ledger, reloads and reopens with the ledger removed", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Cash bankroll" })
		);
		const saved = requireCreatedRow(
			await api.alice.liveCashGameSession.create({
				initialBuyIn: 1000,
				currencyId: wallet.id,
			})
		);
		await api.alice.sessionEvent.create({
			sessionId: saved.id,
			eventType: "chips_add_remove",
			payload: { amount: 200 },
		});
		await api.alice.liveCashGameSession.complete({
			id: saved.id,
			finalStack: 1800,
		});
		const reloaded = await api
			.caller("alice")
			.liveCashGameSession.getById({ id: saved.id });
		expect(reloaded).toMatchObject({
			status: "completed",
			summary: { totalBuyIn: 1200, cashOut: 1800, profitLoss: 600 },
		});
		expect(
			await api.db
				.select()
				.from(currencyTransaction)
				.where(eq(currencyTransaction.sessionId, saved.id))
		).toEqual([
			expect.objectContaining({ currencyId: wallet.id, amount: 600 }),
		]);
		await expect(
			api.bob.liveCashGameSession.getById({ id: saved.id })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await api.alice.liveCashGameSession.reopen({ id: saved.id });
		expect(
			await api.caller("alice").liveCashGameSession.getById({ id: saved.id })
		).toMatchObject({ status: "active", endedAt: null });
		expect(
			await api.db
				.select()
				.from(currencyTransaction)
				.where(eq(currencyTransaction.sessionId, saved.id))
		).toEqual([]);
		expect(
			(
				await api.db
					.select()
					.from(sessionEvent)
					.where(eq(sessionEvent.sessionId, saved.id))
			).filter(({ eventType }) => eventType === "session_end")
		).toEqual([]);
	});

	test("concurrent cash and tournament starts yield one complete session aggregate and one conflict", async ({
		api,
	}) => {
		const outcomes = await Promise.allSettled([
			api.alice.liveCashGameSession.create({ initialBuyIn: 100 }),
			api.alice.liveTournamentSession.create({ buyIn: 200 }),
		]);
		expect(
			outcomes.filter(({ status }) => status === "fulfilled")
		).toHaveLength(1);
		expect(outcomes.filter(({ status }) => status === "rejected")).toEqual([
			expect.objectContaining({
				reason: expect.objectContaining({ code: "CONFLICT" }),
			}),
		]);
		const sessions = await api.db.select().from(gameSession);
		expect(sessions).toHaveLength(1);
		const details = [
			...(await api.db.select().from(sessionCashDetail)),
			...(await api.db.select().from(sessionTournamentDetail)),
		];
		expect(details).toEqual([
			expect.objectContaining({ sessionId: sessions[0]?.id }),
		]);
		expect(await api.db.select().from(sessionEvent)).toEqual([
			expect.objectContaining({
				sessionId: sessions[0]?.id,
				eventType: "session_start",
				sortOrder: 0,
			}),
		]);
		await api.bob.liveCashGameSession.create({ initialBuyIn: 50 });
		expect(await api.db.select().from(gameSession)).toHaveLength(2);
	});

	test("simultaneous append requests persist distinct event positions without losing either memo", async ({
		api,
	}) => {
		const saved = requireCreatedRow(
			await api.alice.liveCashGameSession.create({
				initialBuyIn: 100,
			})
		);
		await Promise.all([
			api.alice.sessionEvent.create({
				sessionId: saved.id,
				eventType: "memo",
				payload: { text: "First concurrent note" },
			}),
			api.alice.sessionEvent.create({
				sessionId: saved.id,
				eventType: "memo",
				payload: { text: "Second concurrent note" },
			}),
		]);
		const events = await api.db
			.select()
			.from(sessionEvent)
			.where(eq(sessionEvent.sessionId, saved.id))
			.orderBy(asc(sessionEvent.sortOrder));
		expect(events.map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2]);
		expect(
			events
				.filter(({ eventType }) => eventType === "memo")
				.map(({ payload }) => JSON.parse(payload).text)
				.sort()
		).toEqual(["First concurrent note", "Second concurrent note"]);
	});

	test("settles a tournament once and rejects reopening without rewriting completed history", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({
				name: "Tournament bankroll",
			})
		);
		const saved = requireCreatedRow(
			await api.alice.liveTournamentSession.create({
				currencyId: wallet.id,
				buyIn: 1000,
				entryFee: 100,
			})
		);
		await api.alice.liveTournamentSession.complete({
			id: saved.id,
			beforeDeadline: false,
			placement: 2,
			totalEntries: 10,
			prizeMoney: 3000,
			bountyPrizes: 200,
		});
		const before = await api.db.select().from(gameSession);
		const eventsBefore = await api.db.select().from(sessionEvent);
		const ledgerBefore = await api.db.select().from(currencyTransaction);
		expect(
			await api.caller("alice").liveTournamentSession.getById({ id: saved.id })
		).toMatchObject({ status: "completed" });
		expect(ledgerBefore).toEqual([
			expect.objectContaining({
				sessionId: saved.id,
				currencyId: wallet.id,
				amount: 2100,
			}),
		]);
		await expect(
			api.alice.liveTournamentSession.reopen({ id: saved.id })
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "Tournament sessions cannot be reopened after completion",
		});
		expect(await api.db.select().from(gameSession)).toEqual(before);
		expect(await api.db.select().from(sessionEvent)).toEqual(eventsBefore);
		expect(await api.db.select().from(currencyTransaction)).toEqual(
			ledgerBefore
		);
	});
});
