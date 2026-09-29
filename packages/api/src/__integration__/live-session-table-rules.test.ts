import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

describe("house rules are a frozen copy of the master", () => {
	test("a live cash session copies the master's house rules on link, keeps its own on keepSnapshot, and edits them only through updateSnapshot", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const straddleGame = requireCreatedRow(
			await api.alice.ringGame.create({
				roomId: club.id,
				name: "NLH 100/200",
				memo: "Parking behind the building",
				houseRules: "Straddle allowed from UTG",
			})
		);
		const bombPotGame = requireCreatedRow(
			await api.alice.ringGame.create({
				roomId: club.id,
				name: "PLO 100/200",
				houseRules: "Bomb pot every orbit",
			})
		);
		const saved = requireCreatedRow(
			await api.alice.liveCashGameSession.create({
				roomId: club.id,
				ringGameId: straddleGame.id,
				memo: "Table 3",
				initialBuyIn: 20_000,
			})
		);
		const read = () =>
			api.caller("alice").liveCashGameSession.getById({ id: saved.id });

		expect(await read()).toMatchObject({
			houseRules: "Straddle allowed from UTG",
			memo: "Table 3",
		});

		await api.alice.ringGame.update({
			id: straddleGame.id,
			houseRules: "No straddles",
		});
		expect(await read()).toMatchObject({
			houseRules: "Straddle allowed from UTG",
		});

		await api.alice.liveCashGameSession.updateSnapshot({
			id: saved.id,
			houseRules: "Run it twice on request",
		});
		await api.alice.liveCashGameSession.update({
			id: saved.id,
			ringGameId: bombPotGame.id,
			keepSnapshot: true,
		});
		expect(await read()).toMatchObject({
			ringGameId: bombPotGame.id,
			houseRules: "Run it twice on request",
		});

		await api.alice.liveCashGameSession.update({
			id: saved.id,
			ringGameId: straddleGame.id,
		});
		expect(await read()).toMatchObject({
			ringGameId: straddleGame.id,
			houseRules: "No straddles",
			memo: "Table 3",
		});

		await api.alice.liveCashGameSession.updateSnapshot({
			id: saved.id,
			houseRules: null,
		});
		expect(await read()).toMatchObject({ houseRules: null });

		const [before] = await api.db
			.select()
			.from(sessionCashDetail)
			.where(eq(sessionCashDetail.sessionId, saved.id));
		await expect(
			api.alice.session.update({ id: saved.id, houseRules: "Sneaky edit" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const [after] = await api.db
			.select()
			.from(sessionCashDetail)
			.where(eq(sessionCashDetail.sessionId, saved.id));
		expect(after).toEqual(before);

		await expect(
			api.bob.liveCashGameSession.updateSnapshot({
				id: saved.id,
				houseRules: "Bob's rules",
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(await read()).toMatchObject({ houseRules: null });
	});

	test("a live tournament session copies the master's house rules and keeps them apart from its memo", async ({
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
				memo: "Registration closes at level 8",
				houseRules: "Late reg ends at first break",
				blindLevels: [
					{ isBreak: false, blind1: 100, blind2: 200, ante: 200, minutes: 20 },
				],
			})
		);
		const saved = requireCreatedRow(
			await api.alice.liveTournamentSession.create({
				roomId: club.id,
				tournamentId: master.id,
			})
		);
		const read = () =>
			api.caller("alice").liveTournamentSession.getById({ id: saved.id });

		expect(await read()).toMatchObject({
			houseRules: "Late reg ends at first break",
			memo: null,
		});

		await api.alice.liveTournamentSession.updateSnapshot({
			id: saved.id,
			houseRules: "Two re-entries max",
		});
		expect(await read()).toMatchObject({ houseRules: "Two re-entries max" });
		expect(
			await api.caller("alice").session.getById({ id: saved.id })
		).toMatchObject({
			tournamentHouseRules: "Two re-entries max",
			cashHouseRules: null,
		});
		await expect(
			api.alice.session.update({ id: saved.id, houseRules: "Sneaky edit" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("a manual session keeps the house rules it was recorded with when re-snapshotted onto its own shadow ring game", async ({
		api,
	}) => {
		const saved = requireCreatedRow(
			await api.alice.session.create({
				type: "cash_game",
				sessionDate: 1_788_000_000,
				buyIn: 10_000,
				cashOut: 12_000,
				blind1: 100,
				blind2: 200,
				houseRules: "Must post to enter",
			})
		);
		const recorded = await api
			.caller("alice")
			.session.getById({ id: saved.id });
		expect(recorded).toMatchObject({ cashHouseRules: "Must post to enter" });

		await api.alice.session.update({
			id: saved.id,
			ringGameId: recorded.ringGameId,
		});
		expect(
			await api.caller("alice").session.getById({ id: saved.id })
		).toMatchObject({ cashHouseRules: "Must post to enter" });

		await api.alice.session.update({ id: saved.id, houseRules: null });
		expect(
			await api.caller("alice").session.getById({ id: saved.id })
		).toMatchObject({ cashHouseRules: null });
	});
});

describe("hand count and dealer offset", () => {
	test("a new live session starts uncounted with the dealer offset at zero, and both persist while it is active", async ({
		api,
	}) => {
		const saved = requireCreatedRow(
			await api.alice.liveCashGameSession.create({ initialBuyIn: 10_000 })
		);
		const read = () =>
			api.caller("alice").liveCashGameSession.getById({ id: saved.id });

		expect(await read()).toMatchObject({ handCount: null, dealerOffset: 0 });

		await api.alice.liveCashGameSession.update({
			id: saved.id,
			handCount: 42,
			dealerOffset: 3,
		});
		expect(await read()).toMatchObject({ handCount: 42, dealerOffset: 3 });

		await expect(
			api.bob.liveCashGameSession.update({ id: saved.id, handCount: 0 })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(await read()).toMatchObject({ handCount: 42, dealerOffset: 3 });
	});

	test("rejects hand tracking edits while paused or after completion without writing them", async ({
		api,
	}) => {
		const saved = requireCreatedRow(
			await api.alice.liveTournamentSession.create({ buyIn: 5000 })
		);
		await api.alice.liveTournamentSession.update({
			id: saved.id,
			handCount: 10,
			dealerOffset: 1,
		});
		await api.alice.sessionEvent.create({
			sessionId: saved.id,
			eventType: "session_pause",
			payload: {},
		});
		const readRow = async () => {
			const [row] = await api.db
				.select({
					handCount: gameSession.handCount,
					dealerOffset: gameSession.dealerOffset,
					memo: gameSession.memo,
				})
				.from(gameSession)
				.where(eq(gameSession.id, saved.id));
			return row;
		};

		await expect(
			api.alice.liveTournamentSession.update({
				id: saved.id,
				handCount: 11,
				memo: "Paused edit",
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.alice.liveTournamentSession.update({ id: saved.id, dealerOffset: 2 })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(await readRow()).toEqual({
			handCount: 10,
			dealerOffset: 1,
			memo: null,
		});

		await api.alice.liveTournamentSession.update({
			id: saved.id,
			memo: "Notes still save while paused",
		});
		expect(await readRow()).toMatchObject({
			memo: "Notes still save while paused",
		});

		const cash = requireCreatedRow(
			await api.bob.liveCashGameSession.create({ initialBuyIn: 1000 })
		);
		await api.bob.liveCashGameSession.complete({
			id: cash.id,
			finalStack: 1000,
		});
		await expect(
			api.bob.liveCashGameSession.update({ id: cash.id, handCount: 1 })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
