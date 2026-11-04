import { playerTag, playerToPlayerTag } from "@sapphire2/db/schema/player";
import {
	sessionTag,
	sessionToSessionTag,
} from "@sapphire2/db/schema/session-tag";
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
