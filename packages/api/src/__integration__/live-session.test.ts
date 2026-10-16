import { currencyTransaction } from "@sapphire2/db/schema/currency";
import { entry, playEvent, playSession } from "@sapphire2/db/schema/entry";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { asc, eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
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
					.from(playEvent)
					.where(eq(playEvent.entryId, saved.id))
			).filter(({ type }) => type === "session_end")
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
		const sessions = await api.db.select().from(entry);
		expect(sessions).toHaveLength(1);
		const details = [
			...(await api.db.select().from(sessionCashDetail)),
			...(await api.db.select().from(sessionTournamentDetail)),
		];
		expect(details).toEqual([
			expect.objectContaining({ sessionId: sessions[0]?.id }),
		]);
		expect(await api.db.select().from(playEvent)).toEqual([
			expect.objectContaining({
				entryId: sessions[0]?.id,
				type: "session_start",
				sortOrder: 0,
			}),
		]);
		await api.bob.liveCashGameSession.create({ initialBuyIn: 50 });
		expect(await api.db.select().from(entry)).toHaveLength(2);
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
			.from(playEvent)
			.where(eq(playEvent.entryId, saved.id))
			.orderBy(asc(playEvent.sortOrder));
		expect(events.map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2]);
		expect(
			events
				.filter(({ type }) => type === "memo")
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
		const before = await api.db.select().from(entry);
		const eventsBefore = await api.db.select().from(playEvent);
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
		expect(await api.db.select().from(entry)).toEqual(before);
		expect(await api.db.select().from(playEvent)).toEqual(eventsBefore);
		expect(await api.db.select().from(currencyTransaction)).toEqual(
			ledgerBefore
		);
	});

	test("resyncs completed cash and tournament ledgers when their currency changes", async ({
		api,
	}) => {
		const first = requireCreatedRow(
			await api.alice.currency.create({ name: "First wallet" })
		);
		const second = requireCreatedRow(
			await api.alice.currency.create({ name: "Second wallet" })
		);
		const cash = requireCreatedRow(
			await api.alice.liveCashGameSession.create({
				initialBuyIn: 1000,
				currencyId: first.id,
			})
		);
		await api.alice.liveCashGameSession.complete({
			id: cash.id,
			finalStack: 1500,
		});
		await api.alice.liveCashGameSession.update({
			id: cash.id,
			currencyId: second.id,
		});
		const tournament = requireCreatedRow(
			await api.alice.liveTournamentSession.create({
				buyIn: 1000,
				entryFee: 100,
				currencyId: first.id,
			})
		);
		await api.alice.liveTournamentSession.complete({
			id: tournament.id,
			beforeDeadline: false,
			placement: 2,
			totalEntries: 10,
			prizeMoney: 2000,
			bountyPrizes: 0,
		});
		await api.alice.liveTournamentSession.update({
			id: tournament.id,
			currencyId: second.id,
		});
		expect(await api.db.select().from(currencyTransaction)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					sessionId: cash.id,
					currencyId: second.id,
					amount: 500,
				}),
				expect.objectContaining({
					sessionId: tournament.id,
					currencyId: second.id,
					amount: 900,
				}),
			])
		);
		expect(await api.db.select().from(currencyTransaction)).toHaveLength(2);
	});

	test("rewrites tournament timer facts and reprojects the clock without changing the session start", async ({
		api,
	}) => {
		const saved = requireCreatedRow(
			await api.alice.liveTournamentSession.create({
				buyIn: 1000,
				timerStartedAt: 1_788_000_000,
			})
		);
		const before = await api.alice.liveTournamentSession.getById({
			id: saved.id,
		});
		await api.alice.liveTournamentSession.update({
			id: saved.id,
			timerStartedAt: 1_788_000_600,
		});
		expect(
			await api.alice.liveTournamentSession.getById({ id: saved.id })
		).toMatchObject({
			startedAt: before.startedAt,
			timerStartedAt: new Date(1_788_000_600_000),
		});
		const [play] = await api.db
			.select()
			.from(playSession)
			.where(eq(playSession.entryId, saved.id));
		expect(play?.clockStartedAt).toEqual(new Date(1_788_000_600_000));
		const [start] = await api.db
			.select()
			.from(playEvent)
			.where(eq(playEvent.entryId, saved.id));
		expect(JSON.parse(start?.payload ?? "{}")).toMatchObject({
			timerStartedAt: 1_788_000_600,
		});
		await api.alice.liveTournamentSession.update({
			id: saved.id,
			timerStartedAt: null,
		});
		expect(
			await api.alice.liveTournamentSession.getById({ id: saved.id })
		).toMatchObject({ timerStartedAt: null });
	});

	test("uses the JST start date for cash and tournament entries across midnight", async ({
		api,
	}) => {
		vi.useFakeTimers({ toFake: ["Date"] });
		try {
			for (const [instant, localDate] of [
				["2026-10-15T14:59:59.000Z", "2026-10-15"],
				["2026-10-15T15:00:00.000Z", "2026-10-16"],
			] as const) {
				vi.setSystemTime(new Date(instant));
				const cash = requireCreatedRow(
					await api.alice.liveCashGameSession.create({ initialBuyIn: 100 })
				);
				const tournament = requireCreatedRow(
					await api.bob.liveTournamentSession.create({ buyIn: 100 })
				);
				for (const id of [cash.id, tournament.id]) {
					expect(
						await api.db
							.select({ playedOn: entry.playedOn })
							.from(entry)
							.where(eq(entry.id, id))
					).toEqual([{ playedOn: localDate }]);
					expect(
						await api.db
							.select({ localDate: playSession.localDate })
							.from(playSession)
							.where(eq(playSession.entryId, id))
					).toEqual([{ localDate }]);
				}
				await api.alice.liveCashGameSession.discard({ id: cash.id });
				await api.bob.liveTournamentSession.discard({ id: tournament.id });
			}
		} finally {
			vi.useRealTimers();
		}
	});
});
