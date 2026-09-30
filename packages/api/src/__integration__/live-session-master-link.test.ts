import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

describe("linking a live session to a master while keeping its snapshot", () => {
	test("links a cash session to another room's ring game without touching the rules, then unlinks it", async ({
		api,
	}) => {
		const home = requireCreatedRow(
			await api.alice.room.create({ name: "Home" })
		);
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const master = requireCreatedRow(
			await api.alice.ringGame.create({
				roomId: club.id,
				name: "NLH 200/400",
				blind1: 200,
				blind2: 400,
				tableSize: 8,
			})
		);
		const saved = requireCreatedRow(
			await api.alice.liveCashGameSession.create({ initialBuyIn: 10_000 })
		);
		await api.alice.liveCashGameSession.update({
			id: saved.id,
			roomId: home.id,
		});
		await api.alice.liveCashGameSession.updateSnapshot({
			id: saved.id,
			ruleName: "Friday game",
			blind1: 100,
			blind2: 200,
			tableSize: 6,
		});
		const readDetail = async () => {
			const [row] = await api.db
				.select()
				.from(sessionCashDetail)
				.where(eq(sessionCashDetail.sessionId, saved.id));
			return row;
		};
		const before = await readDetail();

		await api.alice.liveCashGameSession.update({
			id: saved.id,
			roomId: club.id,
			ringGameId: master.id,
			keepSnapshot: true,
		});

		expect(await readDetail()).toEqual({ ...before, ringGameId: master.id });
		expect(
			await api.caller("alice").session.getById({ id: saved.id })
		).toMatchObject({ roomId: club.id, ringGameId: master.id });

		await api.alice.liveCashGameSession.update({
			id: saved.id,
			ringGameId: null,
		});
		expect(await readDetail()).toEqual({ ...before, ringGameId: null });
	});

	test("refuses another user's ring game without writing anything", async ({
		api,
	}) => {
		const bobRoom = requireCreatedRow(
			await api.bob.room.create({ name: "Bob" })
		);
		const bobMaster = requireCreatedRow(
			await api.bob.ringGame.create({ roomId: bobRoom.id, name: "Bob NLH" })
		);
		const saved = requireCreatedRow(
			await api.alice.liveCashGameSession.create({ initialBuyIn: 100 })
		);
		const [before] = await api.db
			.select()
			.from(sessionCashDetail)
			.where(eq(sessionCashDetail.sessionId, saved.id));

		await expect(
			api.alice.liveCashGameSession.update({
				id: saved.id,
				ringGameId: bobMaster.id,
				keepSnapshot: true,
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			api.alice.liveCashGameSession.update({
				id: saved.id,
				roomId: bobRoom.id,
				ringGameId: bobMaster.id,
				keepSnapshot: true,
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		const [after] = await api.db
			.select()
			.from(sessionCashDetail)
			.where(eq(sessionCashDetail.sessionId, saved.id));
		expect(after).toEqual(before);
	});

	test("links a tournament session without replacing its rules or blind structure", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const master = requireCreatedRow(
			await api.alice.tournament.createWithLevels({
				roomId: club.id,
				name: "Daily Deepstack",
				buyIn: 10_000,
				entryFee: 1000,
				startingStack: 30_000,
				blindLevels: [
					{ isBreak: false, blind1: 100, blind2: 200, ante: 200, minutes: 20 },
				],
			})
		);
		const saved = requireCreatedRow(
			await api.alice.liveTournamentSession.create({ buyIn: 5000 })
		);
		await api.alice.liveTournamentSession.updateSnapshot({
			id: saved.id,
			ruleName: "Weekend Turbo",
			startingStack: 15_000,
			blindLevels: [
				{ isBreak: false, blind1: 50, blind2: 100, ante: 100, minutes: 10 },
				{ isBreak: false, blind1: 100, blind2: 200, ante: 200, minutes: 10 },
			],
		});
		const readDetail = async () => {
			const [row] = await api.db
				.select()
				.from(sessionTournamentDetail)
				.where(eq(sessionTournamentDetail.sessionId, saved.id));
			return row;
		};
		const readLevels = () =>
			api.db
				.select()
				.from(sessionBlindLevel)
				.where(eq(sessionBlindLevel.sessionId, saved.id))
				.orderBy(asc(sessionBlindLevel.level));
		const detailBefore = await readDetail();
		const levelsBefore = await readLevels();

		await api.alice.liveTournamentSession.update({
			id: saved.id,
			roomId: club.id,
			tournamentId: master.id,
			keepSnapshot: true,
		});

		expect(await readDetail()).toEqual({
			...detailBefore,
			tournamentId: master.id,
		});
		expect(await readLevels()).toEqual(levelsBefore);
	});

	test("refuses another user's tournament", async ({ api }) => {
		const bobRoom = requireCreatedRow(
			await api.bob.room.create({ name: "Bob" })
		);
		const bobMaster = requireCreatedRow(
			await api.bob.tournament.createWithLevels({
				roomId: bobRoom.id,
				name: "Bob Daily",
			})
		);
		const saved = requireCreatedRow(
			await api.alice.liveTournamentSession.create({ buyIn: 100 })
		);

		await expect(
			api.alice.liveTournamentSession.update({
				id: saved.id,
				tournamentId: bobMaster.id,
				keepSnapshot: true,
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		const [detail] = await api.db
			.select()
			.from(sessionTournamentDetail)
			.where(eq(sessionTournamentDetail.sessionId, saved.id));
		expect(detail?.tournamentId).toBeNull();
	});
});
