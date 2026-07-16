import { describe, expect, it, vi } from "vitest";
import { ensureSessionResultTypeId } from "../services/session-result-type";

interface TypeRow {
	id: string;
	name: string;
	updatedAt: Date;
	userId: string;
}

function createDb(initialRows: TypeRow[] = []) {
	const rows = [...initialRows];
	const conflictCalls: TypeRow[] = [];
	const values = vi.fn((value: TypeRow) => ({
		onConflictDoNothing: vi.fn(() => {
			conflictCalls.push(value);
			if (
				!rows.some(
					(row) => row.userId === value.userId && row.name === value.name
				)
			) {
				rows.push(value);
			}
		}),
	}));
	const select = vi.fn(() => ({
		from: () => ({
			where: () =>
				Promise.resolve(
					rows.filter(
						(row) => row.userId === "user-1" && row.name === "Session Result"
					)
				),
		}),
	}));
	const db = {
		select,
		insert: vi.fn(() => ({ values })),
	};

	return { db, rows, conflictCalls, values };
}

describe("ensureSessionResultTypeId", () => {
	it("returns an existing Session Result id without writing", async () => {
		const existing = {
			id: "existing",
			userId: "user-1",
			name: "Session Result",
			updatedAt: new Date(1),
		};
		const { db } = createDb([existing]);

		await expect(
			ensureSessionResultTypeId(db as never, "user-1")
		).resolves.toBe("existing");
		expect(db.insert).toHaveBeenCalledTimes(0);
	});

	it("creates the reserved type with conflict handling and returns its id", async () => {
		const { db, rows, conflictCalls, values } = createDb();

		const id = await ensureSessionResultTypeId(db as never, "user-1");

		expect(id).toBe(rows[0]?.id);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			userId: "user-1",
			name: "Session Result",
		});
		expect(values).toHaveBeenCalledTimes(1);
		expect(conflictCalls).toHaveLength(1);
	});

	it("converges two concurrent missing-type calls on the same stored id", async () => {
		const { db, rows, conflictCalls } = createDb();

		const [first, second] = await Promise.all([
			ensureSessionResultTypeId(db as never, "user-1"),
			ensureSessionResultTypeId(db as never, "user-1"),
		]);

		expect(first).toBe(second);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.id).toBe(first);
		expect(conflictCalls).toHaveLength(2);
	});

	it("fails explicitly when the canonical row is still missing after the upsert", async () => {
		const onConflictDoNothing = vi.fn(() => undefined);
		const db = {
			select: vi.fn(() => ({
				from: () => ({ where: () => Promise.resolve([]) }),
			})),
			insert: vi.fn(() => ({
				values: () => ({ onConflictDoNothing }),
			})),
		};

		await expect(
			ensureSessionResultTypeId(db as never, "user-1")
		).rejects.toThrow("Failed to ensure Session Result transaction type");
		expect(db.select).toHaveBeenCalledTimes(2);
		expect(db.insert).toHaveBeenCalledTimes(1);
		expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
	});
});
