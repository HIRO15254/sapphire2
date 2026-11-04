import { playerTag, playerToPlayerTag } from "@sapphire2/db/schema/player";
import { room } from "@sapphire2/db/schema/room";
import {
	sessionTag,
	sessionToSessionTag,
} from "@sapphire2/db/schema/session-tag";
import {
	blindLevel,
	tournament,
	tournamentChipPurchase,
} from "@sapphire2/db/schema/tournament";
import { tournamentTag } from "@sapphire2/db/schema/tournament-tag";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

type Rows = Record<string, unknown>[];

interface Stmt {
	kind: "delete" | "insert" | "update";
	table: unknown;
	values?: unknown;
}

type ChainablePromise = Promise<Rows> &
	Record<string, (...args: unknown[]) => unknown>;

function createBatchTrackingDb(
	rowsByTable: Map<unknown, Rows> = new Map(),
	options: { batchError?: Error } = {}
) {
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
				const stmt = {
					kind: "insert",
					table,
					values,
				} as Stmt & {
					onConflictDoNothing: () => Stmt;
					onConflictDoUpdate: () => Stmt;
				};
				stmt.onConflictDoUpdate = () => stmt;
				stmt.onConflictDoNothing = () => stmt;
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
			set: (values: unknown) => ({
				where: () => ({ kind: "update", table, values }) as Stmt,
			}),
		}),
		batch: (stmts: Stmt[]) => {
			batchCalls.push([...stmts]);
			if (options.batchError) {
				return Promise.reject(options.batchError);
			}
			return Promise.resolve(stmts.map(() => ({})));
		},
	};

	return { db, batchCalls, inserts, deletes };
}

const opsOn = (stmts: Stmt[], table: unknown, kind: Stmt["kind"]): Stmt[] =>
	stmts.filter((s) => s.table === table && s.kind === kind);

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

describe("tournament.createWithLevels batch composition (SA2-116)", () => {
	it("submits the tournament and all tags / chip purchases / blind levels in one batch", async () => {
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

	it("submits a bare tournament (no children) as a single-statement batch", async () => {
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

describe("tournament.updateWithLevels batch composition (SA2-116)", () => {
	it("submits the tournament UPDATE and every clear-and-reseed group in one batch", async () => {
		const rows = new Map<unknown, Rows>([
			[
				tournament,
				[{ id: "tn-1", roomId: "room-1", userId: "user-1", name: "T" }],
			],
			[room, [{ id: "room-1", userId: "user-1" }]],
		]);
		const { db, batchCalls } = createBatchTrackingDb(rows);

		await callerFor(db, "user-1").tournament.updateWithLevels({
			id: "tn-1",
			name: "T2",
			tags: ["A", "B"],
			chipPurchases: [{ name: "Rebuy", cost: 100, chips: 1000 }],
			blindLevels: [
				{ isBreak: false, blind1: 100, blind2: 200 },
				{ isBreak: true },
			],
		});

		expect(batchCalls).toHaveLength(1);
		const batch = sole(batchCalls);

		expect(batch[0]).toMatchObject({ kind: "update", table: tournament });
		expect(opsOn(batch, tournamentTag, "delete")).toHaveLength(1);
		expect(opsOn(batch, tournamentTag, "insert")).toHaveLength(2);
		expect(opsOn(batch, tournamentChipPurchase, "delete")).toHaveLength(1);
		expect(opsOn(batch, tournamentChipPurchase, "insert")).toHaveLength(1);
		expect(opsOn(batch, blindLevel, "delete")).toHaveLength(1);
		expect(opsOn(batch, blindLevel, "insert")).toHaveLength(2);
	});

	it("batches the blind-level clear-and-reseed even when tags / chips are omitted", async () => {
		const rows = new Map<unknown, Rows>([
			[
				tournament,
				[{ id: "tn-1", roomId: "room-1", userId: "user-1", name: "T" }],
			],
			[room, [{ id: "room-1", userId: "user-1" }]],
		]);
		const { db, batchCalls } = createBatchTrackingDb(rows);

		await callerFor(db, "user-1").tournament.updateWithLevels({
			id: "tn-1",
			blindLevels: [{ isBreak: false, blind1: 100, blind2: 200 }],
		});

		const batch = sole(batchCalls);
		expect(batch[0]).toMatchObject({ kind: "update", table: tournament });

		expect(opsOn(batch, tournamentTag, "delete")).toHaveLength(0);
		expect(opsOn(batch, tournamentChipPurchase, "delete")).toHaveLength(0);
		expect(opsOn(batch, blindLevel, "delete")).toHaveLength(1);
		expect(opsOn(batch, blindLevel, "insert")).toHaveLength(1);
	});
});

describe("tag deletion batch composition (SA2-116)", () => {
	it("deletes player-tag links and the player tag in one batch", async () => {
		const rows = new Map<unknown, Rows>([
			[playerTag, [{ id: "pt-1", userId: "user-1" }]],
		]);
		const { db, batchCalls } = createBatchTrackingDb(rows);

		await callerFor(db, "user-1").playerTag.delete({ id: "pt-1" });

		const batch = sole(batchCalls);
		expect(batch).toHaveLength(2);
		expect(batch[0]).toMatchObject({
			kind: "delete",
			table: playerToPlayerTag,
		});
		expect(batch[1]).toMatchObject({ kind: "delete", table: playerTag });
	});

	it("deletes session-tag links and the session tag in one batch", async () => {
		const rows = new Map<unknown, Rows>([
			[sessionTag, [{ id: "st-1", userId: "user-1" }]],
		]);
		const { db, batchCalls } = createBatchTrackingDb(rows);

		await callerFor(db, "user-1").sessionTag.delete({ id: "st-1" });

		const batch = sole(batchCalls);
		expect(batch).toHaveLength(2);
		expect(batch[0]).toMatchObject({
			kind: "delete",
			table: sessionToSessionTag,
		});
		expect(batch[1]).toMatchObject({ kind: "delete", table: sessionTag });
	});

	it("propagates player-tag deletion batch failure without a second batch", async () => {
		const rows = new Map<unknown, Rows>([
			[playerTag, [{ id: "pt-1", userId: "user-1" }]],
		]);
		const { db, batchCalls } = createBatchTrackingDb(rows, {
			batchError: new Error("D1 batch failed"),
		});

		await expect(
			callerFor(db, "user-1").playerTag.delete({ id: "pt-1" })
		).rejects.toThrow("D1 batch failed");

		expect(sole(batchCalls)).toHaveLength(2);
	});

	it("propagates session-tag deletion batch failure without a second batch", async () => {
		const rows = new Map<unknown, Rows>([
			[sessionTag, [{ id: "st-1", userId: "user-1" }]],
		]);
		const { db, batchCalls } = createBatchTrackingDb(rows, {
			batchError: new Error("D1 batch failed"),
		});

		await expect(
			callerFor(db, "user-1").sessionTag.delete({ id: "st-1" })
		).rejects.toThrow("D1 batch failed");

		expect(sole(batchCalls)).toHaveLength(2);
	});
});
