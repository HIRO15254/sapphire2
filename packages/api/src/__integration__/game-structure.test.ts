import type { Database } from "@sapphire2/db";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { blindLevel, tournament } from "@sapphire2/db/schema/tournament";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

const SESSION_DATE = Date.UTC(2026, 8, 1) / 1000;

const MIXED_GROUP = {
	variants: ["NL Hold'em", "Razz"],
	blind1: 100,
	blind2: 200,
};

const MIXED_LEVEL = {
	isBreak: false,
	minutes: 20,
	games: [MIXED_GROUP],
};

const SINGLE_STRUCTURE_LEVEL = {
	isBreak: false,
	minutes: 20,
	games: [
		{ variants: ["NL Hold'em", "Pot Limit Omaha"], blind1: 100, blind2: 200 },
		{ variants: ["Razz", "Seven Card Stud"], blind1: 100, blind2: 200 },
	],
};

const MIXED_MIX = [MIXED_GROUP, { variants: ["Limit Hold'em"] }];

const STRUCTURE_REJECTION = {
	code: "BAD_REQUEST",
	message: expect.stringContaining("must share a game group"),
};

async function persistedRuleRows(api: { db: Database }) {
	return {
		blindLevels: await api.db.select().from(blindLevel),
		ringGames: await api.db.select().from(ringGame),
		cashDetails: await api.db.select().from(sessionCashDetail),
		sessionLevels: await api.db.select().from(sessionBlindLevel),
		sessionIds: (await api.db.select({ id: gameSession.id }).from(gameSession))
			.map((row) => row.id)
			.sort(),
		tournaments: await api.db.select().from(tournament),
	};
}

describe("one game group per mix group on D1", () => {
	test("every level-games write path rejects a group mixing game groups and leaves stored levels untouched", async ({
		api,
	}) => {
		await api.alice.gameVariant.list();
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const master = requireCreatedRow(
			await api.alice.tournament.createWithLevels({
				roomId: room.id,
				name: "Mixed deepstack",
				blindLevels: [SINGLE_STRUCTURE_LEVEL],
			})
		);
		const [storedLevel] = await api.db
			.select()
			.from(blindLevel)
			.where(eq(blindLevel.tournamentId, master.id));
		const manual = requireCreatedRow(
			await api.alice.session.create({
				type: "tournament",
				sessionDate: SESSION_DATE,
				tournamentBuyIn: 100,
				blindLevels: [SINGLE_STRUCTURE_LEVEL],
			})
		);
		const live = requireCreatedRow(
			await api.alice.liveTournamentSession.create({ buyIn: 200 })
		);
		const before = await persistedRuleRows(api);

		const writes = [
			() =>
				api.alice.tournament.createWithLevels({
					roomId: room.id,
					name: "Another",
					blindLevels: [MIXED_LEVEL],
				}),
			() =>
				api.alice.tournament.updateWithLevels({
					id: master.id,
					blindLevels: [MIXED_LEVEL],
				}),
			() =>
				api.alice.blindLevel.create({
					tournamentId: master.id,
					level: 2,
					games: MIXED_LEVEL.games,
				}),
			() =>
				api.alice.blindLevel.update({
					id: storedLevel?.id ?? "",
					games: MIXED_LEVEL.games,
				}),
			() =>
				api.alice.session.create({
					type: "tournament",
					sessionDate: SESSION_DATE,
					tournamentBuyIn: 100,
					blindLevels: [MIXED_LEVEL],
				}),
			() =>
				api.alice.session.update({
					id: manual.id,
					blindLevels: [MIXED_LEVEL],
				}),
			() =>
				api.alice.liveTournamentSession.updateSnapshot({
					id: live.id,
					blindLevels: [MIXED_LEVEL],
				}),
		];
		for (const write of writes) {
			await expect(write()).rejects.toMatchObject(STRUCTURE_REJECTION);
		}
		expect(await persistedRuleRows(api)).toEqual(before);
	});

	test("every legacy mix cash path rejects a group mixing game groups and accepts one group per structure", async ({
		api,
	}) => {
		await api.alice.gameVariant.list();
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const manual = requireCreatedRow(
			await api.alice.session.create({
				type: "cash_game",
				sessionDate: SESSION_DATE,
				buyIn: 100,
				cashOut: 100,
			})
		);
		const live = requireCreatedRow(
			await api.alice.liveCashGameSession.create({ initialBuyIn: 100 })
		);
		const before = await persistedRuleRows(api);

		const writes = [
			() =>
				api.alice.ringGame.create({
					roomId: room.id,
					name: "Dealer's choice",
					variant: "mix",
					mixGames: MIXED_MIX,
				}),
			() =>
				api.alice.session.create({
					type: "cash_game",
					sessionDate: SESSION_DATE,
					buyIn: 100,
					cashOut: 100,
					variant: "mix",
					mixGames: MIXED_MIX,
				}),
			() =>
				api.alice.session.update({
					id: manual.id,
					variant: "mix",
					mixGames: MIXED_MIX,
				}),
			() =>
				api.alice.liveCashGameSession.updateSnapshot({
					id: live.id,
					variant: "mix",
					mixGames: MIXED_MIX,
				}),
		];
		for (const write of writes) {
			await expect(write()).rejects.toMatchObject(STRUCTURE_REJECTION);
		}
		expect(await persistedRuleRows(api)).toEqual(before);

		const accepted = requireCreatedRow(
			await api.alice.ringGame.create({
				roomId: room.id,
				name: "Dealer's choice",
				variant: "mix",
				mixGames: SINGLE_STRUCTURE_LEVEL.games,
			})
		);
		const [stored] = await api.db
			.select({ mixGames: ringGame.mixGames })
			.from(ringGame)
			.where(eq(ringGame.id, accepted.id));
		expect(stored?.mixGames?.map((group) => group.variants)).toEqual([
			["NL Hold'em", "Pot Limit Omaha"],
			["Razz", "Seven Card Stud"],
		]);
	});

	test("a stored group that a regroup made mixed stays editable, but no game can join it", async ({
		api,
	}) => {
		const variants = await api.alice.gameVariant.list();
		const groups = await api.alice.gameGroup.list();
		const badugi = variants.find((variant) => variant.label === "Badugi");
		const bigBet = groups.find((group) => group.builtinKey === "bigbet");
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const drawGroup = { variants: ["Badugi", "Badeucy"] };
		const ring = requireCreatedRow(
			await api.alice.ringGame.create({
				roomId: room.id,
				name: "Draw mix",
				variant: "mix",
				mixGames: [
					{ ...drawGroup, blind1: 10, blind2: 20 },
					{ variants: ["Razz"] },
				],
			})
		);
		const master = requireCreatedRow(
			await api.alice.tournament.createWithLevels({
				roomId: room.id,
				name: "Draw deepstack",
				blindLevels: [{ isBreak: false, games: [drawGroup] }],
			})
		);
		await api.alice.gameVariant.update({
			id: badugi?.id ?? "",
			groupId: bigBet?.id ?? "",
		});

		await api.alice.ringGame.update({
			id: ring.id,
			mixGames: [
				{ ...drawGroup, blind1: 20, blind2: 40 },
				{ variants: ["Razz"] },
			],
		});
		await api.alice.tournament.updateWithLevels({
			id: master.id,
			blindLevels: [
				{ isBreak: false, games: [{ variants: ["Badeucy", "Badugi"] }] },
			],
		});
		const [ringAfterEcho] = await api.db
			.select({ mixGames: ringGame.mixGames })
			.from(ringGame)
			.where(eq(ringGame.id, ring.id));
		expect(ringAfterEcho?.mixGames?.[0]).toMatchObject({
			blind1: 20,
			blind2: 40,
		});

		const grownGroup = { variants: ["Badugi", "Badeucy", "Limit Hold'em"] };
		await expect(
			api.alice.ringGame.update({
				id: ring.id,
				mixGames: [grownGroup, { variants: ["Razz"] }],
			})
		).rejects.toMatchObject(STRUCTURE_REJECTION);
		await expect(
			api.alice.tournament.updateWithLevels({
				id: master.id,
				blindLevels: [{ isBreak: false, games: [grownGroup] }],
			})
		).rejects.toMatchObject(STRUCTURE_REJECTION);
	});
});
