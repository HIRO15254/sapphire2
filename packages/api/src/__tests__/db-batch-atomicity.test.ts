import {
	currency,
	currencyTransaction,
	transactionType,
} from "@sapphire2/db/schema/currency";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionChipPurchaseResult } from "@sapphire2/db/schema/session-chip-purchase-result";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import {
	sessionTag,
	sessionToSessionTag,
} from "@sapphire2/db/schema/session-tag";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import {
	blindLevel,
	tournament,
	tournamentChipPurchase,
} from "@sapphire2/db/schema/tournament";
import { tournamentTag } from "@sapphire2/db/schema/tournament-tag";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { persistCashSessionReopenEvents } from "../routers/live-cash-game-session";
import {
	persistSessionBlindLevels,
	persistSessionChipPurchases,
	resnapshotTournamentStructure,
	snapshotTournamentStructure,
} from "../routers/session";

/**
 * SA2-116 — every multi-statement write in the api package must commit through
 * a single `db.batch([...])` so a mid-sequence failure can no longer leave a
 * DELETE committed with its re-INSERT missing (permanent data loss) or a parent
 * row committed without its children (orphan). These tests drive the real
 * helpers / procedures against a descriptor-recording mock db and assert the
 * statements land TOGETHER in one batch call.
 */

type Rows = Record<string, unknown>[];

interface Stmt {
	kind: "delete" | "insert" | "update";
	table: unknown;
	values?: unknown;
}

type ChainablePromise = Promise<Rows> &
	Record<string, (...args: unknown[]) => unknown>;

/**
 * A drizzle-shaped mock whose `insert(t).values(v)` / `delete(t).where()` return
 * inert descriptor objects (never executed on their own) and whose `batch(stmts)`
 * records the exact array it received. `select().from(t)` resolves to the rows
 * registered for the schema-table reference `t`.
 */
function createBatchTrackingDb(rowsByTable: Map<unknown, Rows> = new Map()) {
	const batchCalls: Stmt[][] = [];
	const inserts: Stmt[] = [];
	const deletes: Stmt[] = [];

	const makeChain = (rows: Rows): ChainablePromise => {
		const chain = Promise.resolve(rows) as ChainablePromise;
		chain.from = (table: unknown) => makeChain(rowsByTable.get(table) ?? []);
		chain.where = () => chain;
		chain.orderBy = () => chain;
		chain.limit = () => chain;
		chain.innerJoin = () => chain;
		chain.leftJoin = () => chain;
		return chain;
	};

	const db = {
		select: () => makeChain([]),
		insert: (table: unknown) => ({
			values: (values: unknown) => {
				const stmt: Stmt = { kind: "insert", table, values };
				inserts.push(stmt);
				return stmt;
			},
		}),
		delete: (table: unknown) => ({
			where: () => {
				const stmt: Stmt = { kind: "delete", table };
				deletes.push(stmt);
				return stmt;
			},
		}),
		update: (table: unknown) => ({
			set: () => ({
				where: () => ({ kind: "update", table }) as Stmt,
			}),
		}),
		batch: (stmts: Stmt[]) => {
			batchCalls.push([...stmts]);
			return Promise.resolve(stmts.map(() => ({})));
		},
	};

	return { db, batchCalls, inserts, deletes };
}

const opsOn = (stmts: Stmt[], table: unknown, kind: Stmt["kind"]): Stmt[] =>
	stmts.filter((s) => s.table === table && s.kind === kind);

/** Assert exactly one batch was issued and return its statement array. */
function sole(batchCalls: Stmt[][]): Stmt[] {
	expect(batchCalls).toHaveLength(1);
	return batchCalls[0] as Stmt[];
}

function callerFor(db: unknown, userId: string) {
	return appRouter.createCaller({
		session: { user: { id: userId } },
		db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]);
}

function makeChipPurchases(count: number) {
	return Array.from({ length: count }, (_, i) => ({
		name: `Rebuy ${i}`,
		cost: 100 + i,
		chips: 1000 + i,
		count: i,
	}));
}

function makeBlindLevels(count: number) {
	return Array.from({ length: count }, (_, i) => ({
		isBreak: false,
		blind1: (i + 1) * 100,
		blind2: (i + 1) * 200,
		blind3: null,
		ante: null,
		minutes: 15,
	}));
}

describe("persistSessionChipPurchases atomicity (SA2-116)", () => {
	it("passes the DELETE and both INSERT groups in a single batch call", async () => {
		const { db, batchCalls } = createBatchTrackingDb();

		await persistSessionChipPurchases(
			db as never,
			"sess-1",
			makeChipPurchases(1)
		);

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);
		// The purchase DELETE must be the first statement so it commits with the
		// re-INSERTs rather than as a separate auto-commit that could strand the
		// table empty on a later failure.
		expect(batch[0]).toMatchObject({
			kind: "delete",
			table: sessionChipPurchase,
		});
		expect(opsOn(batch, sessionChipPurchase, "delete")).toHaveLength(1);
		expect(opsOn(batch, sessionChipPurchase, "insert")).toHaveLength(1);
		expect(opsOn(batch, sessionChipPurchaseResult, "insert")).toHaveLength(1);
	});

	it("still runs the DELETE (and nothing else) in one batch for an empty list", async () => {
		const { db, batchCalls, inserts } = createBatchTrackingDb();

		await persistSessionChipPurchases(db as never, "sess-1", []);

		expect(batchCalls).toHaveLength(1);
		expect(sole(batchCalls)).toEqual([
			{ kind: "delete", table: sessionChipPurchase },
		]);
		// No re-INSERT is attempted when there are no purchases to write.
		expect(inserts).toHaveLength(0);
	});

	it("keeps every chunked purchase + result INSERT together with the DELETE in one batch", async () => {
		const { db, batchCalls } = createBatchTrackingDb();

		// 20 purchases: 6 cols -> chunks of 16 + 4 (two INSERTs); results 2 cols ->
		// one INSERT of 20. All must live in the single batch alongside the DELETE.
		await persistSessionChipPurchases(
			db as never,
			"sess-1",
			makeChipPurchases(20)
		);

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);
		expect(opsOn(batch, sessionChipPurchase, "delete")).toHaveLength(1);
		const purchaseInserts = opsOn(batch, sessionChipPurchase, "insert");
		expect(purchaseInserts).toHaveLength(2);
		expect((purchaseInserts[0].values as unknown[]).length).toBe(16);
		expect((purchaseInserts[1].values as unknown[]).length).toBe(4);
		const resultInserts = opsOn(batch, sessionChipPurchaseResult, "insert");
		expect(resultInserts).toHaveLength(1);
		expect((resultInserts[0].values as unknown[]).length).toBe(20);
	});
});

describe("persistSessionBlindLevels atomicity (SA2-116)", () => {
	it("passes the DELETE and the level INSERT together in one batch", async () => {
		const { db, batchCalls } = createBatchTrackingDb();

		await persistSessionBlindLevels(db as never, "sess-1", makeBlindLevels(1));

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);
		expect(batch[0]).toMatchObject({
			kind: "delete",
			table: sessionBlindLevel,
		});
		expect(opsOn(batch, sessionBlindLevel, "insert")).toHaveLength(1);
	});

	it("runs only the DELETE (single batch) for an empty blind-level list", async () => {
		const { db, batchCalls, inserts } = createBatchTrackingDb();

		await persistSessionBlindLevels(db as never, "sess-1", []);

		expect(batchCalls).toHaveLength(1);
		expect(sole(batchCalls)).toEqual([
			{ kind: "delete", table: sessionBlindLevel },
		]);
		expect(inserts).toHaveLength(0);
	});

	it("keeps both chunked level INSERTs with the DELETE in one batch (12 levels)", async () => {
		const { db, batchCalls } = createBatchTrackingDb();

		await persistSessionBlindLevels(db as never, "sess-1", makeBlindLevels(12));

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);
		expect(opsOn(batch, sessionBlindLevel, "delete")).toHaveLength(1);
		const inserts = opsOn(batch, sessionBlindLevel, "insert");
		expect(inserts).toHaveLength(2);
		expect((inserts[0].values as unknown[]).length).toBe(11);
		expect((inserts[1].values as unknown[]).length).toBe(1);
	});
});

describe("snapshotTournamentStructure atomicity (SA2-116)", () => {
	function structureRows(opts: { levels?: Rows; purchases?: Rows }) {
		return new Map<unknown, Rows>([
			[blindLevel, opts.levels ?? []],
			[tournamentChipPurchase, opts.purchases ?? []],
		]);
	}

	it("writes the copied blind + chip + result rows in a single batch", async () => {
		const { db, batchCalls } = createBatchTrackingDb(
			structureRows({
				levels: [{ level: 1, isBreak: false, blind1: 100, blind2: 200 }],
				purchases: [{ name: "Rebuy", cost: 100, chips: 1000, sortOrder: 0 }],
			})
		);

		await snapshotTournamentStructure(db as never, "sess-1", "tn-1");

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);
		expect(opsOn(batch, sessionBlindLevel, "insert")).toHaveLength(1);
		expect(opsOn(batch, sessionChipPurchase, "insert")).toHaveLength(1);
		expect(opsOn(batch, sessionChipPurchaseResult, "insert")).toHaveLength(1);
		// A pure copy never deletes.
		expect(batch.some((s) => s.kind === "delete")).toBe(false);
	});

	it("issues no batch when the tournament has no structure to copy", async () => {
		const { db, batchCalls } = createBatchTrackingDb(structureRows({}));

		await snapshotTournamentStructure(db as never, "sess-1", "tn-1");

		expect(batchCalls).toHaveLength(0);
	});

	it("batches only the blind rows when there are no chip purchases", async () => {
		const { db, batchCalls } = createBatchTrackingDb(
			structureRows({
				levels: [{ level: 1, isBreak: false, blind1: 100, blind2: 200 }],
			})
		);

		await snapshotTournamentStructure(db as never, "sess-1", "tn-1");

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);
		expect(opsOn(batch, sessionBlindLevel, "insert")).toHaveLength(1);
		expect(opsOn(batch, sessionChipPurchase, "insert")).toHaveLength(0);
	});
});

describe("resnapshotTournamentStructure atomicity (SA2-116)", () => {
	it("groups both DELETEs with the re-copied structure in one batch", async () => {
		const { db, batchCalls } = createBatchTrackingDb(
			new Map<unknown, Rows>([
				[blindLevel, [{ level: 1, isBreak: false, blind1: 100, blind2: 200 }]],
				[
					tournamentChipPurchase,
					[{ name: "Rebuy", cost: 100, chips: 1000, sortOrder: 0 }],
				],
			])
		);

		await resnapshotTournamentStructure(db as never, "sess-1", "tn-1");

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);
		// Both DELETEs and every re-INSERT commit atomically — the SA2-116 fix for
		// permanent structure loss on a failed re-snapshot.
		expect(opsOn(batch, sessionBlindLevel, "delete")).toHaveLength(1);
		expect(opsOn(batch, sessionChipPurchase, "delete")).toHaveLength(1);
		expect(opsOn(batch, sessionBlindLevel, "insert")).toHaveLength(1);
		expect(opsOn(batch, sessionChipPurchase, "insert")).toHaveLength(1);
		expect(opsOn(batch, sessionChipPurchaseResult, "insert")).toHaveLength(1);
		expect(batch[0]).toMatchObject({ kind: "delete" });
	});

	it("still batches both DELETEs when the parent tournament has no structure", async () => {
		const { db, batchCalls } = createBatchTrackingDb();

		await resnapshotTournamentStructure(db as never, "sess-1", "tn-1");

		expect(batchCalls).toHaveLength(1);
		expect(sole(batchCalls)).toEqual([
			{ kind: "delete", table: sessionBlindLevel },
			{ kind: "delete", table: sessionChipPurchase },
		]);
	});
});

describe("persistCashSessionReopenEvents atomicity (SA2-116)", () => {
	it("deletes the session_end event and inserts the 3 reopen events in one batch", async () => {
		const { db, batchCalls } = createBatchTrackingDb();

		await persistCashSessionReopenEvents(db as never, {
			sessionId: "s1",
			sessionEndEventId: "end-1",
			flooredEndOccurredAt: new Date(1_000_000),
			endSortOrder: 5,
			cashOutAmount: 4200,
			flooredNow: new Date(2_000_000),
			now: new Date(3_000_000),
		});

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);
		expect(batch[0]).toMatchObject({ kind: "delete", table: sessionEvent });
		const eventInserts = opsOn(batch, sessionEvent, "insert");
		expect(eventInserts).toHaveLength(3);
		expect(
			eventInserts.map((s) => (s.values as { eventType: string }).eventType)
		).toEqual(["update_stack", "session_pause", "session_resume"]);
		// sortOrder must stay contiguous so the pause/resume pair sorts after the
		// re-stamped end state.
		expect(
			eventInserts.map((s) => (s.values as { sortOrder: number }).sortOrder)
		).toEqual([5, 6, 7]);
	});
});

describe("session.create atomicity (SA2-116)", () => {
	it("commits gameSession + cash detail (+ auto ring game) in a single batch", async () => {
		const { db, batchCalls } = createBatchTrackingDb();

		await callerFor(db, "user-1").session.create({
			type: "cash_game",
			sessionDate: 1_700_000_000,
			buyIn: 1000,
			cashOut: 2000,
		});

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);
		expect(opsOn(batch, gameSession, "insert")).toHaveLength(1);
		expect(opsOn(batch, ringGame, "insert")).toHaveLength(1);
		expect(opsOn(batch, sessionCashDetail, "insert")).toHaveLength(1);
		// The session row must precede the child rows so FK checks pass inside the
		// transaction.
		expect(batch[0]).toMatchObject({ kind: "insert", table: gameSession });
	});

	it("commits gameSession + tournament detail + copied structure atomically", async () => {
		const rows = new Map<unknown, Rows>([
			[
				tournament,
				[{ id: "tn-1", roomId: "room-1", name: "Main", variant: "nlh" }],
			],
			[room, [{ id: "room-1", userId: "user-1" }]],
			[blindLevel, [{ level: 1, isBreak: false, blind1: 100, blind2: 200 }]],
			[
				tournamentChipPurchase,
				[{ name: "Rebuy", cost: 100, chips: 1000, sortOrder: 0 }],
			],
		]);
		const { db, batchCalls } = createBatchTrackingDb(rows);

		await callerFor(db, "user-1").session.create({
			type: "tournament",
			sessionDate: 1_700_000_000,
			tournamentBuyIn: 10_000,
			tournamentId: "tn-1",
		});

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);
		expect(opsOn(batch, gameSession, "insert")).toHaveLength(1);
		expect(opsOn(batch, sessionTournamentDetail, "insert")).toHaveLength(1);
		expect(opsOn(batch, sessionBlindLevel, "insert")).toHaveLength(1);
		expect(opsOn(batch, sessionChipPurchase, "insert")).toHaveLength(1);
		expect(opsOn(batch, sessionChipPurchaseResult, "insert")).toHaveLength(1);
	});

	it("includes tag links and the currency ledger row in the same batch", async () => {
		const rows = new Map<unknown, Rows>([
			[currency, [{ id: "cur-1", userId: "user-1" }]],
			[sessionTag, [{ id: "tag-1" }]],
			// No "Session Result" transaction type yet -> its INSERT must join the batch.
			[transactionType, []],
		]);
		const { db, batchCalls } = createBatchTrackingDb(rows);

		await callerFor(db, "user-1").session.create({
			type: "cash_game",
			sessionDate: 1_700_000_000,
			buyIn: 1000,
			cashOut: 2000,
			currencyId: "cur-1",
			tagIds: ["tag-1"],
		});

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);
		expect(opsOn(batch, sessionToSessionTag, "insert")).toHaveLength(1);
		expect(opsOn(batch, transactionType, "insert")).toHaveLength(1);
		expect(opsOn(batch, currencyTransaction, "insert")).toHaveLength(1);
	});
});

describe("tournament.createWithLevels atomicity (SA2-116)", () => {
	it("commits the tournament and all tags / chip purchases / blind levels in one batch", async () => {
		const rows = new Map<unknown, Rows>([
			[room, [{ id: "room-1", userId: "user-1" }]],
			[tournament, [{ id: "tn-created", roomId: "room-1", name: "T" }]],
		]);
		const { db, batchCalls } = createBatchTrackingDb(rows);

		await callerFor(db, "user-1").tournament.createWithLevels({
			roomId: "room-1",
			name: "T",
			tags: ["A", "B"],
			chipPurchases: [{ name: "Rebuy", cost: 100, chips: 1000 }],
			blindLevels: [
				{ isBreak: false, blind1: 100, blind2: 200 },
				{ isBreak: true },
			],
		});

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);
		expect(batch[0]).toMatchObject({ kind: "insert", table: tournament });
		expect(opsOn(batch, tournamentTag, "insert")).toHaveLength(2);
		expect(opsOn(batch, tournamentChipPurchase, "insert")).toHaveLength(1);
		expect(opsOn(batch, blindLevel, "insert")).toHaveLength(2);
	});

	it("commits a bare tournament (no children) as a single-statement batch", async () => {
		const rows = new Map<unknown, Rows>([
			[room, [{ id: "room-1", userId: "user-1" }]],
			[tournament, [{ id: "tn-created", roomId: "room-1", name: "T" }]],
		]);
		const { db, batchCalls } = createBatchTrackingDb(rows);

		await callerFor(db, "user-1").tournament.createWithLevels({
			roomId: "room-1",
			name: "T",
		});

		const batch = sole(batchCalls);
		expect(batch).toHaveLength(1);
		expect(batch[0]).toMatchObject({
			kind: "insert",
			table: tournament,
		});
	});
});
