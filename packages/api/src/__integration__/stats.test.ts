import {
	entry,
	entryCash,
	entryTournament,
	playSession,
} from "@sapphire2/db/schema/entry";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { describe, expect } from "vitest";
import { fetchStatsRows } from "../routers/stats";
import { requireCreatedRow, test } from "./test-fixture";

const day = new Date("2026-09-05T00:00:00Z");
const start = new Date("2026-09-05T10:00:00Z");
const end = new Date("2026-09-05T12:00:00Z");

describe("statistics entry cutover on D1", () => {
	test("keeps unfinished cash entries, entry filters and live time while reconstructing EV from entry cash", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Wallet" })
		);
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		await api.db.insert(gameSession).values([
			{
				id: "cash",
				userId: "alice",
				kind: "tournament",
				status: "completed",
				source: "manual",
				sessionDate: new Date(0),
				updatedAt: day,
			},
			{
				id: "open",
				userId: "alice",
				kind: "tournament",
				status: "completed",
				source: "manual",
				sessionDate: new Date(0),
				updatedAt: day,
			},
		]);
		await api.db.insert(entry).values([
			{
				id: "cash",
				userId: "alice",
				kind: "cash",
				source: "live",
				status: "settled",
				playedOn: "2026-09-05",
				roomId: club.id,
				assetId: wallet.id,
				updatedAt: day,
			},
			{
				id: "open",
				userId: "alice",
				kind: "cash",
				source: "live",
				status: "open",
				playedOn: "2026-09-05",
				roomId: club.id,
				assetId: wallet.id,
				updatedAt: day,
			},
		]);
		await api.db.insert(entryCash).values([
			{ entryId: "cash", userId: "alice", evDiff: 50 },
			{ entryId: "open", userId: "alice" },
		]);
		await api.db.insert(playSession).values([
			{
				id: "cash",
				entryId: "cash",
				userId: "alice",
				kind: "cash",
				seq: 1,
				localDate: "2026-09-05",
				startedAt: start,
				endedAt: end,
				breakMinutes: 15,
				status: "ended",
				endState: "cashed_out",
				updatedAt: day,
			},
			{
				id: "open",
				entryId: "open",
				userId: "alice",
				kind: "cash",
				seq: 1,
				localDate: "2026-09-05",
				startedAt: start,
				status: "active",
				updatedAt: day,
			},
		]);
		await api.db.insert(sessionCashDetail).values([
			{
				sessionId: "cash",
				buyIn: 500,
				cashOut: 600,
				chipRemoveTotal: 100,
				blind1: 1,
				blind2: 2,
				variant: "nlh",
			},
			{ sessionId: "open", buyIn: 100, blind1: 1, blind2: 2 },
		]);
		const filters = {
			currencyId: wallet.id,
			roomId: club.id,
			type: "cash_game" as const,
			dateFrom: start.getTime() / 1000,
			dateTo: start.getTime() / 1000,
			normalized: false,
		};
		const rows = await fetchStatsRows(api.db, "alice", filters);
		expect(rows).toHaveLength(2);
		expect(rows).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "cash",
					type: "cash_game",
					sessionDate: start.getTime() / 1000,
					roomId: club.id,
					roomName: "Club",
					playMinutes: 105,
					profitLoss: 200,
					evProfitLoss: 250,
					evDiff: 50,
					evRecorded: true,
					variant: "nlh",
				}),
				expect.objectContaining({
					id: "open",
					playMinutes: null,
					profitLoss: 0,
					evProfitLoss: null,
					evRecorded: false,
				}),
			])
		);
		expect(await api.alice.stats.summary(filters)).toMatchObject({
			totalSessions: 2,
			totalProfitLoss: 200,
		});
		expect(await fetchStatsRows(api.db, "bob", filters)).toEqual([]);
		expect(
			await fetchStatsRows(api.db, "alice", { ...filters, type: "tournament" })
		).toEqual([]);
		expect(
			await fetchStatsRows(api.db, "alice", {
				...filters,
				dateFrom: start.getTime() / 1000 + 1,
			})
		).toEqual([]);
		expect(
			await fetchStatsRows(api.db, "alice", {
				...filters,
				dateTo: start.getTime() / 1000 - 1,
			})
		).toEqual([]);
		expect(
			await fetchStatsRows(api.db, "alice", { ...filters, roomId: "missing" })
		).toEqual([]);
		expect(
			await fetchStatsRows(api.db, "alice", {
				...filters,
				currencyId: "missing",
			})
		).toEqual([]);
	});

	test("reads tournament results and manual dates from entry while retaining legacy monetary rules", async ({
		api,
	}) => {
		await api.db.insert(gameSession).values({
			id: "tournament",
			userId: "alice",
			kind: "cash_game",
			status: "completed",
			source: "manual",
			sessionDate: new Date(0),
			updatedAt: day,
		});
		await api.db.insert(entry).values({
			id: "tournament",
			userId: "alice",
			kind: "tournament",
			source: "manual",
			status: "settled",
			playedOn: "2026-09-05",
			updatedAt: day,
		});
		await api.db.insert(entryTournament).values({
			entryId: "tournament",
			userId: "alice",
			placement: 3,
			totalEntries: 50,
		});
		await api.db.insert(playSession).values({
			id: "tournament",
			entryId: "tournament",
			userId: "alice",
			kind: "tournament",
			seq: 1,
			localDate: "2026-09-05",
			startedAt: start,
			endedAt: end,
			breakMinutes: 10,
			status: "ended",
			endState: "busted",
			updatedAt: day,
		});
		await api.db.insert(sessionTournamentDetail).values({
			sessionId: "tournament",
			tournamentBuyIn: 100,
			entryFee: 10,
			prizeMoney: 500,
			bountyPrizes: 25,
			variant: "nlh",
		});
		expect(
			await fetchStatsRows(api.db, "alice", {
				normalized: true,
				type: "tournament",
				dateFrom: day.getTime() / 1000,
				dateTo: day.getTime() / 1000,
			})
		).toEqual([
			expect.objectContaining({
				id: "tournament",
				type: "tournament",
				sessionDate: day.getTime() / 1000,
				placement: 3,
				totalEntries: 50,
				playMinutes: 110,
				profitLoss: 415,
				buyInTotal: 110,
				prizeMoney: 500,
				bountyPrizes: 25,
				evRecorded: false,
			}),
		]);
	});
});
