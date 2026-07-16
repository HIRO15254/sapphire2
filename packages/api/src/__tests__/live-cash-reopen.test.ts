import { currencyTransaction } from "@sapphire2/db/schema/currency";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { describe, expect, it, vi } from "vitest";
import { persistCashSessionReopenEvents } from "../routers/live-cash-game-session";

interface Statement {
	kind: "delete" | "insert" | "update";
	table: unknown;
	values?: unknown;
}

const NOW = new Date("2026-07-15T06:00:30.000Z");
const END = new Date("2026-07-15T05:30:00.000Z");
const REOPEN_PARAMS = {
	cashOutAmount: 1200,
	endSortOrder: 4,
	flooredEndOccurredAt: END,
	flooredNow: new Date("2026-07-15T06:00:00.000Z"),
	now: NOW,
	sessionEndEventId: "end-1",
	sessionId: "session-1",
};

function createMockDb(batchError?: Error) {
	const batch = vi.fn((statements: Statement[]) => {
		if (batchError) {
			return Promise.reject(batchError);
		}
		return Promise.resolve(statements);
	});

	return {
		batch,
		db: {
			batch,
			delete: (table: unknown) => ({
				where: () => ({ kind: "delete", table }) satisfies Statement,
			}),
			insert: (table: unknown) => ({
				values: (values: unknown) =>
					({ kind: "insert", table, values }) satisfies Statement,
			}),
			update: (table: unknown) => ({
				set: (values: unknown) => ({
					where: () => ({ kind: "update", table, values }) satisfies Statement,
				}),
			}),
		} as never,
	};
}

describe("persistCashSessionReopenEvents (SA2-211)", () => {
	it("commits event replacement, active status, and ledger deletion in one batch", async () => {
		const { batch, db } = createMockDb();

		await persistCashSessionReopenEvents(db, REOPEN_PARAMS);

		expect(batch).toHaveBeenCalledTimes(1);
		const statements = batch.mock.calls[0]?.[0] as Statement[];
		expect(statements).toHaveLength(6);
		expect(statements.map(({ kind, table }) => ({ kind, table }))).toEqual([
			{ kind: "delete", table: sessionEvent },
			{ kind: "insert", table: sessionEvent },
			{ kind: "insert", table: sessionEvent },
			{ kind: "insert", table: sessionEvent },
			{ kind: "update", table: gameSession },
			{ kind: "delete", table: currencyTransaction },
		]);
		expect(statements[4]?.values).toEqual({
			endedAt: null,
			status: "active",
			updatedAt: NOW,
		});
	});

	it("surfaces a batch failure without performing a second write phase", async () => {
		const batchError = new Error("unique conflict");
		const { batch, db } = createMockDb(batchError);

		await expect(
			persistCashSessionReopenEvents(db, REOPEN_PARAMS)
		).rejects.toBe(batchError);
		expect(batch).toHaveBeenCalledTimes(1);
		expect(batch.mock.calls[0]?.[0]).toHaveLength(6);
	});
});
