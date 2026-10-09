import type { Database } from "@sapphire2/db";
import { currencyTransaction } from "@sapphire2/db/schema/currency";
import {
	entry,
	entryCash,
	entryTournament,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionToSessionTag } from "@sapphire2/db/schema/session-tag";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import type z from "zod";
import {
	createSessionViaEntry,
	deleteSessionViaEntry,
	getSessionViaEntry,
	listSessionsViaEntries,
	type SessionCreateInput,
	type sessionListInputSchema,
	type sessionUpdateInputSchema,
	updateSessionViaEntry,
} from "../routers/session";
import {
	backfillEntryTables,
	retireMovedLegacyColumns,
} from "./entry-cutover-fixture";
import { type ApiFixture, requireCreatedRow, test } from "./test-fixture";

type Api = ApiFixture;
type CreateInput = SessionCreateInput;
type UpdateInput = Omit<z.infer<typeof sessionUpdateInputSchema>, "id">;
type SessionListInput = z.infer<typeof sessionListInputSchema>;
type Row = Record<string, unknown>;

const SEP_1 = Date.UTC(2026, 8, 1) / 1000;
const SEP_2 = Date.UTC(2026, 8, 2) / 1000;
const HOUR = 3600;
const VOLATILE: Record<string, true> = {
	id: true,
	entryId: true,
	sessionId: true,
	sessionChipPurchaseId: true,
	createdAt: true,
	updatedAt: true,
	liveCashGameSessionId: true,
	liveTournamentSessionId: true,
};

function stable(row: Row | undefined): Row | undefined {
	if (!row) {
		return row;
	}
	return Object.fromEntries(
		Object.entries(row).filter(([key]) => !VOLATILE[key])
	);
}

async function ringGameName(db: Database, id: unknown) {
	if (typeof id !== "string") {
		return id;
	}
	const [found] = await db
		.select({ name: ringGame.name })
		.from(ringGame)
		.where(eq(ringGame.id, id));
	return `ring game: ${found?.name}`;
}

async function newTablesOf(db: Database, id: string) {
	const [cash] = await db
		.select()
		.from(entryCash)
		.where(eq(entryCash.entryId, id));
	return {
		entry: stable((await db.select().from(entry).where(eq(entry.id, id)))[0]),
		cash: cash
			? { ...stable(cash), ringGameId: await ringGameName(db, cash.ringGameId) }
			: undefined,
		tournament: stable(
			(
				await db
					.select()
					.from(entryTournament)
					.where(eq(entryTournament.entryId, id))
			)[0]
		),
		plays: (
			await db.select().from(playSession).where(eq(playSession.entryId, id))
		).map(stable),
		events: await db.select().from(playEvent).where(eq(playEvent.entryId, id)),
	};
}

async function legacyChildrenOf(db: Database, id: string) {
	return {
		blindLevels: (
			await db
				.select()
				.from(sessionBlindLevel)
				.where(eq(sessionBlindLevel.sessionId, id))
				.orderBy(asc(sessionBlindLevel.level))
		).map(stable),
		chipPurchases: (
			await db
				.select()
				.from(sessionChipPurchase)
				.where(eq(sessionChipPurchase.sessionId, id))
				.orderBy(asc(sessionChipPurchase.sortOrder))
		).map(stable),
		tags: (
			await db
				.select({ tagId: sessionToSessionTag.sessionTagId })
				.from(sessionToSessionTag)
				.where(eq(sessionToSessionTag.sessionId, id))
		).map((link) => link.tagId),
		ledger: (
			await db
				.select()
				.from(currencyTransaction)
				.where(eq(currencyTransaction.sessionId, id))
		).map(stable),
	};
}

interface DetailRows {
	cash: Row | undefined;
	tournament: Row | undefined;
}

async function detailOf(db: Database, id: string): Promise<DetailRows> {
	const [cash] = await db
		.select()
		.from(sessionCashDetail)
		.where(eq(sessionCashDetail.sessionId, id));
	const [tournament] = await db
		.select()
		.from(sessionTournamentDetail)
		.where(eq(sessionTournamentDetail.sessionId, id));
	return { cash: stable(cash), tournament: stable(tournament) };
}

function retiredDetail(detail: DetailRows): DetailRows {
	return {
		cash: detail.cash && { ...detail.cash, ringGameId: null, evCashOut: null },
		tournament: detail.tournament && {
			...detail.tournament,
			tournamentId: null,
			placement: null,
			totalEntries: null,
			beforeDeadline: null,
			timerStartedAt: null,
		},
	};
}

type Masters = Record<
	| "room"
	| "otherRoom"
	| "wallet"
	| "otherWallet"
	| "ring"
	| "event"
	| "tag"
	| "otherTag",
	{ id: string }
>;

async function seedMasters(api: Api): Promise<Masters> {
	const room = requireCreatedRow(await api.alice.room.create({ name: "Club" }));
	const otherRoom = requireCreatedRow(
		await api.alice.room.create({ name: "Annex" })
	);
	const wallet = requireCreatedRow(
		await api.alice.currency.create({ name: "Wallet" })
	);
	const otherWallet = requireCreatedRow(
		await api.alice.currency.create({ name: "Points" })
	);
	const ring = requireCreatedRow(
		await api.alice.ringGame.create({
			roomId: room.id,
			name: "NLH 1/2",
			blind1: 1,
			blind2: 2,
		})
	);
	const event = requireCreatedRow(
		await api.alice.tournament.createWithLevels({
			roomId: room.id,
			name: "Deepstack",
			buyIn: 1000,
			entryFee: 100,
			chipPurchases: [{ name: "Rebuy", cost: 500, chips: 10_000 }],
			blindLevels: [
				{ isBreak: false, blind1: 100, blind2: 200, minutes: 20 },
				{ isBreak: true, minutes: 10 },
			],
		})
	);
	const tag = requireCreatedRow(
		await api.alice.sessionTag.create({ name: "Live read" })
	);
	const otherTag = requireCreatedRow(
		await api.alice.sessionTag.create({ name: "Swapped" })
	);
	return { room, otherRoom, wallet, otherWallet, ring, event, tag, otherTag };
}

interface Scenario {
	create: (m: Masters) => CreateInput;
	endTimeBeforeStartIsDropped?: true;
	name: string;
	updates: (m: Masters) => UpdateInput[];
}

const SCENARIOS: Scenario[] = [
	{
		name: "a cash session linked to every master",
		create: (m) => ({
			type: "cash_game",
			sessionDate: SEP_1,
			startedAt: SEP_1 + 10 * HOUR,
			endedAt: SEP_1 + 14 * HOUR,
			breakMinutes: 15,
			buyIn: 100,
			cashOut: 300,
			evCashOut: 250,
			roomId: m.room.id,
			currencyId: m.wallet.id,
			ringGameId: m.ring.id,
			memo: "Good table",
			tagIds: [m.tag.id],
		}),
		updates: (m) => [
			{
				sessionDate: SEP_2,
				startedAt: SEP_2 + 20 * HOUR,
				endedAt: SEP_2 + 23 * HOUR,
				memo: "Edited",
				roomId: m.otherRoom.id,
				currencyId: m.otherWallet.id,
				tagIds: [m.otherTag.id],
			},
			{ cashOut: 500 },
			{ evCashOut: null, ringGameId: null, ruleName: "Home game" },
		],
	},
	{
		name: "a cash session without masters that names its own ring game",
		create: () => ({
			type: "cash_game",
			sessionDate: SEP_1,
			buyIn: 200,
			cashOut: 50,
			variant: "NL Hold'em",
			blind1: 2,
			blind2: 5,
		}),
		updates: (m) => [
			{ breakMinutes: 30, currencyId: m.wallet.id, buyIn: 300 },
			{ startedAt: SEP_1 + 22 * HOUR, endedAt: SEP_1 + 2 * HOUR },
		],
		endTimeBeforeStartIsDropped: true,
	},
	{
		name: "a tournament copied from its master with a placement",
		create: (m) => ({
			type: "tournament",
			sessionDate: SEP_1,
			tournamentBuyIn: 2000,
			entryFee: 200,
			placement: 3,
			totalEntries: 100,
			prizeMoney: 5000,
			bountyPrizes: 300,
			tournamentId: m.event.id,
			currencyId: m.wallet.id,
			chipPurchases: [{ name: "Add-on", cost: 300, chips: 5000, count: 2 }],
		}),
		updates: () => [
			{ placement: 1, prizeMoney: 9000 },
			{ beforeDeadline: true },
			{ placement: 5 },
		],
	},
	{
		name: "a tournament without a master that ended before the deadline",
		create: (m) => ({
			type: "tournament",
			sessionDate: SEP_2,
			tournamentBuyIn: 1000,
			entryFee: 0,
			beforeDeadline: true,
			ruleName: "Sunday Major",
			blindLevels: [{ isBreak: false, blind1: 50, blind2: 100, minutes: 15 }],
			tagIds: [m.tag.id],
		}),
		updates: (m) => [
			{ beforeDeadline: false, placement: 7, totalEntries: 40 },
			{ tournamentId: m.event.id },
		],
	},
];

describe("prep write service stores what the T07 cutover expects from today's session writes (characterization until T07 wires it)", () => {
	for (const scenario of SCENARIOS) {
		test(`create and update of ${scenario.name}`, async ({ api }) => {
			const masters = await seedMasters(api);
			const createInput = scenario.create(masters);
			const updates = scenario.updates(masters);

			const today = requireCreatedRow(
				await api.alice.session.create(createInput)
			);
			const todayCreated = stable(today);
			let todayUpdated: Row | undefined;
			for (const update of updates) {
				todayUpdated = await api.alice.session.update({
					id: today.id,
					...update,
				});
			}
			const todayDetail = retiredDetail(await detailOf(api.db, today.id));
			const todayChildren = await legacyChildrenOf(api.db, today.id);
			await backfillEntryTables(api.d1);
			const expectedNew = await newTablesOf(api.db, today.id);

			const prep = requireCreatedRow(
				await createSessionViaEntry(api.db, "alice", createInput)
			);
			expect(stable(prep)).toEqual(todayCreated);
			let prepUpdated: Row | undefined;
			for (const update of updates) {
				prepUpdated = await updateSessionViaEntry(api.db, "alice", {
					id: prep.id,
					...update,
				});
			}

			expect(stable(prepUpdated)).toEqual({
				...stable(todayUpdated),
				...(scenario.endTimeBeforeStartIsDropped ? { endedAt: null } : {}),
			});
			expect(await newTablesOf(api.db, prep.id)).toEqual(expectedNew);
			expect(await detailOf(api.db, prep.id)).toEqual(todayDetail);
			expect(await legacyChildrenOf(api.db, prep.id)).toEqual(todayChildren);
			const [anchor] = await api.db
				.select()
				.from(gameSession)
				.where(eq(gameSession.id, prep.id));
			expect(anchor).toMatchObject({
				userId: "alice",
				kind: createInput.type,
				status: "completed",
				source: "manual",
				sessionDate: new Date(0),
				startedAt: null,
				endedAt: null,
				breakMinutes: null,
				memo: null,
				roomId: null,
				currencyId: null,
			});
		});
	}

	test("an update by another user is rejected before anything is read or written", async ({
		api,
	}) => {
		const created = requireCreatedRow(
			await createSessionViaEntry(api.db, "alice", {
				type: "cash_game",
				sessionDate: SEP_1,
				buyIn: 100,
				cashOut: 300,
			})
		);
		const before = await newTablesOf(api.db, created.id);
		await expect(
			updateSessionViaEntry(api.db, "bob", { id: created.id, memo: "x" })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			deleteSessionViaEntry(api.db, "bob", created.id)
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(await newTablesOf(api.db, created.id)).toEqual(before);
	});

	test("delete removes the entry, the anchor row and every child of both", async ({
		api,
	}) => {
		const masters = await seedMasters(api);
		const created = requireCreatedRow(
			await createSessionViaEntry(api.db, "alice", {
				type: "tournament",
				sessionDate: SEP_1,
				tournamentBuyIn: 1000,
				entryFee: 0,
				tournamentId: masters.event.id,
				currencyId: masters.wallet.id,
				tagIds: [masters.tag.id],
			})
		);
		const kept = requireCreatedRow(
			await createSessionViaEntry(api.db, "alice", {
				type: "cash_game",
				sessionDate: SEP_2,
				buyIn: 100,
				cashOut: 300,
				currencyId: masters.wallet.id,
			})
		);

		expect(await deleteSessionViaEntry(api.db, "alice", created.id)).toEqual({
			success: true,
		});

		expect(await newTablesOf(api.db, created.id)).toEqual({
			entry: undefined,
			cash: undefined,
			tournament: undefined,
			plays: [],
			events: [],
		});
		expect(await detailOf(api.db, created.id)).toEqual({
			cash: undefined,
			tournament: undefined,
		});
		expect(await legacyChildrenOf(api.db, created.id)).toEqual({
			blindLevels: [],
			chipPurchases: [],
			tags: [],
			ledger: [],
		});
		expect(
			await api.db
				.select()
				.from(gameSession)
				.where(eq(gameSession.id, created.id))
		).toEqual([]);
		expect((await newTablesOf(api.db, kept.id)).entry).toBeDefined();
		expect((await legacyChildrenOf(api.db, kept.id)).ledger).toHaveLength(1);
	});
});

function errorMessages(error: unknown): string {
	const messages: string[] = [];
	for (
		let cause: unknown = error;
		cause instanceof Error;
		cause = cause.cause
	) {
		messages.push(cause.message);
	}
	return messages.join("\n");
}

async function everyRow(db: Database) {
	return {
		sessions: await db.select().from(gameSession),
		entries: await db.select().from(entry),
		cash: await db.select().from(entryCash),
		tournaments: await db.select().from(entryTournament),
		plays: await db.select().from(playSession),
		cashDetails: await db.select().from(sessionCashDetail),
		tournamentDetails: await db.select().from(sessionTournamentDetail),
		chipPurchases: await db.select().from(sessionChipPurchase),
		tags: await db.select().from(sessionToSessionTag),
		ledger: await db.select().from(currencyTransaction),
		ringGames: await db.select().from(ringGame),
	};
}

async function failLastStatement(api: Api, trigger: string) {
	await api.d1
		.prepare(
			`CREATE TRIGGER test_fail_last ${trigger} BEGIN SELECT RAISE(ABORT, 'test forced failure'); END;`
		)
		.run();
}

describe("prep write service commits all of a write or none of it on D1", () => {
	test("a create whose ledger row fails leaves no entry, anchor, detail or auto-created ring game", async ({
		api,
	}) => {
		const masters = await seedMasters(api);
		const before = await everyRow(api.db);
		await failLastStatement(api, "BEFORE INSERT ON currency_transaction");

		const failure = await createSessionViaEntry(api.db, "alice", {
			type: "cash_game",
			sessionDate: SEP_1,
			buyIn: 100,
			cashOut: 300,
			currencyId: masters.wallet.id,
			tagIds: [masters.tag.id],
		}).catch((error: unknown) => error);

		expect(errorMessages(failure)).toContain("test forced failure");
		expect(await everyRow(api.db)).toEqual(before);
	});

	test("an update whose ledger row fails leaves the entry and the old tables as they were", async ({
		api,
	}) => {
		const masters = await seedMasters(api);
		const created = requireCreatedRow(
			await createSessionViaEntry(api.db, "alice", {
				type: "tournament",
				sessionDate: SEP_1,
				tournamentBuyIn: 1000,
				entryFee: 0,
				placement: 3,
				totalEntries: 50,
				currencyId: masters.wallet.id,
			})
		);
		const before = await everyRow(api.db);
		await failLastStatement(api, "BEFORE UPDATE ON currency_transaction");

		const failure = await updateSessionViaEntry(api.db, "alice", {
			id: created.id,
			placement: 1,
			prizeMoney: 4000,
			memo: "Must roll back",
			tagIds: [masters.tag.id],
		}).catch((error: unknown) => error);

		expect(errorMessages(failure)).toContain("test forced failure");
		expect(await everyRow(api.db)).toEqual(before);
	});

	test("a delete whose anchor row fails keeps the entry", async ({ api }) => {
		const created = requireCreatedRow(
			await createSessionViaEntry(api.db, "alice", {
				type: "cash_game",
				sessionDate: SEP_1,
				buyIn: 100,
				cashOut: 300,
			})
		);
		const before = await everyRow(api.db);
		await failLastStatement(api, "BEFORE DELETE ON game_session");

		const failure = await deleteSessionViaEntry(
			api.db,
			"alice",
			created.id
		).catch((error: unknown) => error);

		expect(errorMessages(failure)).toContain("test forced failure");
		expect(await everyRow(api.db)).toEqual(before);
	});
});

describe("prep read assembly returns today's session.list / getById output from the entry tables (characterization until T07 wires it)", () => {
	test("list pages, filters, summary and getById match today's output after the cutover retires the old columns", async ({
		api,
	}) => {
		const masters = await seedMasters(api);
		const ids: string[] = [];
		for (const scenario of SCENARIOS) {
			ids.push(
				requireCreatedRow(
					await api.alice.session.create(scenario.create(masters))
				).id
			);
		}
		for (let day = 3; day <= 22; day++) {
			await api.alice.session.create({
				type: "cash_game",
				sessionDate: Date.UTC(2026, 8, day) / 1000,
				buyIn: 100,
				cashOut: 100 + day,
				currencyId: day % 2 === 0 ? masters.wallet.id : undefined,
			});
		}
		const live = requireCreatedRow(
			await api.alice.liveCashGameSession.create({
				initialBuyIn: 1000,
				currencyId: masters.wallet.id,
				roomId: masters.room.id,
			})
		);
		await api.alice.liveCashGameSession.complete({
			id: live.id,
			finalStack: 1800,
		});
		ids.push(live.id);
		const liveTournament = requireCreatedRow(
			await api.alice.liveTournamentSession.create({
				currencyId: masters.wallet.id,
				buyIn: 1000,
				entryFee: 100,
			})
		);
		ids.push(liveTournament.id);
		await api.bob.session.create({
			type: "cash_game",
			sessionDate: SEP_1,
			buyIn: 1,
			cashOut: 2,
		});

		const filters = [
			{},
			{ type: "tournament" as const },
			{ type: "cash_game" as const },
			{ roomId: masters.room.id },
			{ currencyId: masters.wallet.id },
			{ dateFrom: SEP_2, dateTo: Date.UTC(2026, 8, 10) / 1000 },
		];
		const todayPages: { filter: SessionListInput; page: unknown }[] = [];
		for (const filter of filters) {
			const first = await api.alice.session.list(filter);
			todayPages.push({ filter, page: first });
			if (first.nextCursor) {
				todayPages.push({
					filter: { ...filter, cursor: first.nextCursor },
					page: await api.alice.session.list({
						...filter,
						cursor: first.nextCursor,
					}),
				});
			}
		}
		expect(todayPages.some(({ filter }) => "cursor" in filter)).toBe(true);
		const todayDetails: unknown[] = [];
		for (const id of ids) {
			todayDetails.push(await api.alice.session.getById({ id }));
		}

		await backfillEntryTables(api.d1);
		await retireMovedLegacyColumns(api.d1);

		for (const { filter, page } of todayPages) {
			expect(await listSessionsViaEntries(api.db, "alice", filter)).toEqual(
				page
			);
		}
		for (const [index, id] of ids.entries()) {
			expect(await getSessionViaEntry(api.db, "alice", id)).toEqual(
				todayDetails[index]
			);
		}
		await expect(
			getSessionViaEntry(api.db, "bob", ids[0] as string)
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(
			(await listSessionsViaEntries(api.db, "bob", {})).items
		).toHaveLength(1);
	});

	test("a second page never returns another user's session that ties with the cursor on the sort key", async ({
		api,
	}) => {
		for (let index = 0; index < 21; index++) {
			await api.alice.session.create({
				type: "cash_game",
				sessionDate: SEP_1,
				buyIn: 100,
				cashOut: 100 + index,
			});
		}
		await api.db.insert(gameSession).values({
			id: "0",
			userId: "bob",
			kind: "cash_game",
			status: "completed",
			source: "manual",
			sessionDate: new Date(SEP_1 * 1000),
			updatedAt: new Date(SEP_1 * 1000),
		});
		await api.db
			.insert(sessionCashDetail)
			.values({ sessionId: "0", buyIn: 1, cashOut: 2 });

		const first = await api.alice.session.list({});
		expect(first.items).toHaveLength(20);
		const second = await api.alice.session.list({ cursor: first.nextCursor });
		expect(second.items.map((item) => item.id)).not.toContain("0");
		expect(second.items).toHaveLength(1);

		await backfillEntryTables(api.d1);
		const prepSecond = await listSessionsViaEntries(api.db, "alice", {
			cursor: first.nextCursor,
		});
		expect(prepSecond.items.map((item) => item.id)).toEqual(
			second.items.map((item) => item.id)
		);
	});
});
