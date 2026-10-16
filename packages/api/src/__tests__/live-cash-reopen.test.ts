import { currencyTransaction } from "@sapphire2/db/schema/currency";
import { entry, playEvent, playSession } from "@sapphire2/db/schema/entry";
import { describe, expect, it, vi } from "vitest";
import { persistCashSessionReopenEvents } from "../routers/live-cash-game-session";

interface Statement {
	kind: "delete" | "insert" | "update";
	table: unknown;
	values?: Record<string, unknown>;
}

const NOW = new Date("2026-07-15T06:00:30.000Z");
const END = new Date("2026-07-15T05:30:00.000Z");
const REOPEN_PARAMS = {
	cashOutAmount: 1200,
	flooredEndOccurredAt: END,
	flooredNow: new Date("2026-07-15T06:00:00.000Z"),
	now: NOW,
	sessionEndEventId: "end-1",
	sessionId: "session-1",
	userId: "user-1",
};

function createMockDb(batchError?: Error) {
	const rows = new Map<unknown, Record<string, unknown>[]>([
		[entry, [{ kind: "cash", assetId: null }]],
		[
			playSession,
			[{ id: "play-1", seq: 1, localDate: "2026-07-15", status: "ended" }],
		],
		[
			playEvent,
			[
				{
					id: "start-1",
					entryId: "session-1",
					playSessionId: "play-1",
					type: "session_start",
					schemaVersion: 1,
					occurredAt: new Date("2026-07-15T04:00:00.000Z"),
					sortOrder: 0,
					payload: JSON.stringify({ buyInAmount: 1000 }),
				},
				{
					id: "end-1",
					entryId: "session-1",
					playSessionId: "play-1",
					type: "session_end",
					schemaVersion: 1,
					occurredAt: END,
					sortOrder: 4,
					payload: JSON.stringify({ cashOutAmount: 1200 }),
				},
			],
		],
	]);
	const batch = vi.fn((statements: Statement[]) => {
		if (batchError) {
			return Promise.reject(batchError);
		}
		return Promise.resolve(statements);
	});

	return {
		batch,
		db: {
			select: () => ({
				from: (table: unknown) => {
					const result = Promise.resolve(rows.get(table) ?? []);
					return Object.assign(result, {
						where: () => Object.assign(result, { orderBy: () => result }),
					});
				},
			}),
			batch,
			delete: (table: unknown) => ({
				where: () => ({ kind: "delete", table }) satisfies Statement,
			}),
			insert: (table: unknown) => ({
				values: (values: Record<string, unknown>) =>
					({ kind: "insert", table, values }) satisfies Statement,
			}),
			update: (table: unknown) => ({
				set: (values: Record<string, unknown>) => ({
					where: () => ({ kind: "update", table, values }) satisfies Statement,
				}),
			}),
		} as never,
	};
}

describe("persistCashSessionReopenEvents (SA2-211)", () => {
	it("replaces the cash out with stack, pause and resume events and clears the settled ledger together", async () => {
		const { batch, db } = createMockDb();

		await persistCashSessionReopenEvents(db, REOPEN_PARAMS);

		expect(batch).toHaveBeenCalledTimes(1);
		const statements = batch.mock.calls[0]?.[0] as Statement[];
		const events = statements.filter(
			(statement) =>
				statement.kind === "insert" && statement.table === playEvent
		);
		expect(
			events.map((statement) => ({
				type: statement.values?.type,
				payload: JSON.parse(statement.values?.payload as string),
				occurredAt: statement.values?.occurredAt,
			}))
		).toEqual([
			{ type: "update_stack", payload: { stackAmount: 1200 }, occurredAt: END },
			{ type: "session_pause", payload: {}, occurredAt: END },
			{
				type: "session_resume",
				payload: {},
				occurredAt: REOPEN_PARAMS.flooredNow,
			},
		]);
		expect(statements).toContainEqual({ kind: "delete", table: playEvent });
		expect(statements).toContainEqual({
			kind: "delete",
			table: currencyTransaction,
		});
		expect(statements).toContainEqual(
			expect.objectContaining({
				kind: "update",
				table: entry,
				values: expect.objectContaining({ status: "open" }),
			})
		);
		expect(statements).toContainEqual(
			expect.objectContaining({
				kind: "update",
				table: playSession,
				values: expect.objectContaining({ status: "active", endedAt: null }),
			})
		);
	});

	it("surfaces a batch failure without performing a second write phase", async () => {
		const batchError = new Error("unique conflict");
		const { batch, db } = createMockDb(batchError);

		await expect(
			persistCashSessionReopenEvents(db, REOPEN_PARAMS)
		).rejects.toBe(batchError);
		expect(batch).toHaveBeenCalledTimes(1);
	});
});
