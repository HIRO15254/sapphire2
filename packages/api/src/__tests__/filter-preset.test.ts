import { filterPreset } from "@sapphire2/db/schema/filter-preset";
import type { TRPCError } from "@trpc/server";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	createChainableMockDb,
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

type Rows = Record<string, unknown>[];

const TABLE = getTableName(filterPreset);

const OWNER = "user-1";
const OTHER = "user-2";

function filterPresetCaller(userId: string, select: Record<string, Rows>) {
	const mock = createChainableMockDb({ select });
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db: mock.db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).filterPreset;
	return { caller, ...mock };
}

async function expectTrpcCode(
	promise: Promise<unknown>,
	code: TRPCError["code"]
): Promise<void> {
	await expect(promise).rejects.toMatchObject({ code });
}

const SESSIONS_ROW = {
	id: "fp-1",
	userId: OWNER,
	screenKey: "sessions",
	name: "My Preset",
	payload: { period: "last_7_days" },
	isDefault: false,
};

describe("filterPreset router", () => {
	it("appRouter has filterPreset namespace", () => {
		expect(appRouter.filterPreset).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.filterPreset.list).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.filterPreset.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.filterPreset.update).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.filterPreset.delete).toBeDefined();
	});

	it("has setDefault procedure", () => {
		expect(appRouter.filterPreset.setDefault).toBeDefined();
	});

	it("has clearDefault procedure", () => {
		expect(appRouter.filterPreset.clearDefault).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.filterPreset).sort()).toEqual(
			[
				"clearDefault",
				"create",
				"delete",
				"list",
				"setDefault",
				"update",
			].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.filterPreset.list);
		expectType(appRouter.filterPreset.list, "query");
	});

	it("create / update / delete / setDefault / clearDefault are protected mutations", () => {
		for (const proc of [
			appRouter.filterPreset.create,
			appRouter.filterPreset.update,
			appRouter.filterPreset.delete,
			appRouter.filterPreset.setDefault,
			appRouter.filterPreset.clearDefault,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("filterPreset.list input validation", () => {
	it("accepts screenKey: sessions", () => {
		expectAccepts(appRouter.filterPreset.list, { screenKey: "sessions" });
	});

	it("accepts screenKey: statistics", () => {
		expectAccepts(appRouter.filterPreset.list, { screenKey: "statistics" });
	});

	it("rejects missing screenKey", () => {
		expectRejects(appRouter.filterPreset.list, {});
	});

	it("rejects an unknown screenKey", () => {
		expectRejects(appRouter.filterPreset.list, { screenKey: "dashboard" });
	});

	it("rejects a non-string screenKey", () => {
		expectRejects(appRouter.filterPreset.list, { screenKey: 1 });
	});
});

describe("filterPreset.create input validation", () => {
	it("accepts a minimal sessions payload", () => {
		expectAccepts(appRouter.filterPreset.create, {
			screenKey: "sessions",
			name: "My Preset",
			payload: {},
		});
	});

	it("accepts a full sessions payload", () => {
		expectAccepts(appRouter.filterPreset.create, {
			screenKey: "sessions",
			name: "My Preset",
			payload: {
				period: "last_7_days",
				from: 1,
				to: 2,
				type: "cash_game",
				roomId: "room-1",
				currencyId: "cur-1",
			},
		});
	});

	it("accepts a minimal statistics payload", () => {
		expectAccepts(appRouter.filterPreset.create, {
			screenKey: "statistics",
			name: "My Preset",
			payload: {},
		});
	});

	it("accepts a full statistics payload", () => {
		expectAccepts(appRouter.filterPreset.create, {
			screenKey: "statistics",
			name: "My Preset",
			payload: {
				period: "last_7_days",
				from: 1,
				to: 2,
				currency: "cur-1",
				norm: "normalized",
				type: "all",
				room: "room-1",
			},
		});
	});

	it("rejects missing screenKey", () => {
		expectRejects(appRouter.filterPreset.create, {
			name: "My Preset",
			payload: {},
		});
	});

	it("rejects an unknown screenKey", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "dashboard",
			name: "My Preset",
			payload: {},
		});
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "sessions",
			payload: {},
		});
	});

	it("rejects an empty name", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "sessions",
			name: "",
			payload: {},
		});
	});

	it("rejects a whitespace-only name (trimmed to empty)", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "sessions",
			name: "   ",
			payload: {},
		});
	});

	it("accepts a name at the 50-character boundary", () => {
		expectAccepts(appRouter.filterPreset.create, {
			screenKey: "sessions",
			name: "a".repeat(50),
			payload: {},
		});
	});

	it("rejects a name longer than 50 characters (51 chars)", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "sessions",
			name: "a".repeat(51),
			payload: {},
		});
	});

	it("rejects missing payload", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "sessions",
			name: "My Preset",
		});
	});

	// The discriminated union must route validation per-screen, not accept a
	// merged/loose payload shape: "norm" only exists on the statistics
	// payload schema, so it must be rejected under screenKey: "sessions"
	// even though it is a perfectly valid statistics field.
	it("rejects a statistics-only payload field ('norm') under screenKey: sessions", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "sessions",
			name: "My Preset",
			payload: { norm: "off" },
		});
	});

	// Symmetric case: "roomId"/"currencyId" only exist on the sessions
	// payload schema.
	it("rejects a sessions-only payload field ('roomId') under screenKey: statistics", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "statistics",
			name: "My Preset",
			payload: { roomId: "room-1" },
		});
	});

	it("rejects a non-integer 'from' on sessions payload", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "sessions",
			name: "My Preset",
			payload: { from: 1.5 },
		});
	});

	it("rejects a non-integer 'to' on statistics payload", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "statistics",
			name: "My Preset",
			payload: { to: 2.5 },
		});
	});

	it("rejects an invalid 'type' enum value on sessions payload", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "sessions",
			name: "My Preset",
			payload: { type: "sit_n_go" },
		});
	});

	it("rejects an invalid 'norm' enum value on statistics payload", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "statistics",
			name: "My Preset",
			payload: { norm: "adjusted" },
		});
	});

	it("rejects a non-string roomId on sessions payload", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "sessions",
			name: "My Preset",
			payload: { roomId: 123 },
		});
	});
});

describe("filterPreset.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.filterPreset.update, { id: "fp-1" });
	});

	it("accepts id + name", () => {
		expectAccepts(appRouter.filterPreset.update, {
			id: "fp-1",
			name: "Renamed",
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.filterPreset.update, { name: "Renamed" });
	});

	it("rejects an empty name when provided", () => {
		expectRejects(appRouter.filterPreset.update, { id: "fp-1", name: "" });
	});

	it("accepts a name at the 50-character boundary", () => {
		expectAccepts(appRouter.filterPreset.update, {
			id: "fp-1",
			name: "a".repeat(50),
		});
	});

	it("rejects a name longer than 50 characters (51 chars)", () => {
		expectRejects(appRouter.filterPreset.update, {
			id: "fp-1",
			name: "a".repeat(51),
		});
	});

	it("accepts a payload shaped like a sessions payload", () => {
		expectAccepts(appRouter.filterPreset.update, {
			id: "fp-1",
			payload: { type: "cash_game" },
		});
	});

	it("accepts a payload shaped like a statistics payload", () => {
		expectAccepts(appRouter.filterPreset.update, {
			id: "fp-1",
			payload: { norm: "off" },
		});
	});

	it("rejects a payload matching neither payload shape (invalid enum on a shared field)", () => {
		expectRejects(appRouter.filterPreset.update, {
			id: "fp-1",
			payload: { type: "sit_n_go" },
		});
	});

	it("rejects a non-integer 'from' in the payload (fails both shapes)", () => {
		expectRejects(appRouter.filterPreset.update, {
			id: "fp-1",
			payload: { from: 1.5 },
		});
	});

	it("rejects a non-object payload", () => {
		expectRejects(appRouter.filterPreset.update, {
			id: "fp-1",
			payload: "not-an-object",
		});
	});
});

describe("filterPreset.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.filterPreset.delete, { id: "fp-1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.filterPreset.delete, {});
	});

	it("rejects a non-string id", () => {
		expectRejects(appRouter.filterPreset.delete, { id: 1 });
	});
});

describe("filterPreset.setDefault input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.filterPreset.setDefault, { id: "fp-1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.filterPreset.setDefault, {});
	});

	it("rejects a non-string id", () => {
		expectRejects(appRouter.filterPreset.setDefault, { id: 1 });
	});
});

describe("filterPreset.clearDefault input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.filterPreset.clearDefault, { id: "fp-1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.filterPreset.clearDefault, {});
	});

	it("rejects a non-string id", () => {
		expectRejects(appRouter.filterPreset.clearDefault, { id: 1 });
	});
});

describe("filterPreset.list behavior", () => {
	it("scopes the query to the caller's userId and the requested screenKey", async () => {
		const { caller, selectWhereParams } = filterPresetCaller(OWNER, {
			[TABLE]: [SESSIONS_ROW],
		});
		await caller.list({ screenKey: "sessions" });
		expect(selectWhereParams).toContainEqual([OWNER, "sessions"]);
	});

	it("returns the rows configured for the table", async () => {
		const { caller } = filterPresetCaller(OWNER, {
			[TABLE]: [SESSIONS_ROW],
		});
		const result = (await caller.list({ screenKey: "sessions" })) as unknown[];
		expect(result).toEqual([SESSIONS_ROW]);
	});
});

describe("filterPreset.create collision guard (CONFLICT)", () => {
	it("app-level pre-check: rejects a duplicate (userId, screenKey, name) visible via prior select, without attempting the insert", async () => {
		const { caller, inserted } = filterPresetCaller(OWNER, {
			[TABLE]: [
				{ id: "fp-1", userId: OWNER, screenKey: "sessions", name: "Dup" },
			],
		});
		await expectTrpcCode(
			caller.create({ screenKey: "sessions", name: "Dup", payload: {} }),
			"CONFLICT"
		);
		expect(inserted[TABLE]).toBeUndefined();
	});

	it("DB-constraint-catch: converts a UNIQUE constraint violation from the insert into CONFLICT, not a raw 500", async () => {
		const { caller, db } = filterPresetCaller(OWNER, {
			[TABLE]: [],
		});
		db.insert = () => ({
			values: () => {
				throw new Error(
					"UNIQUE constraint failed: filter_preset.user_id, filter_preset.screen_key, filter_preset.name"
				);
			},
		});
		await expectTrpcCode(
			caller.create({ screenKey: "sessions", name: "Dup", payload: {} }),
			"CONFLICT"
		);
	});

	it("does not conflict with a same-name preset on a different screenKey", async () => {
		const { caller } = filterPresetCaller(OWNER, {
			[TABLE]: [
				{ id: "fp-1", userId: OWNER, screenKey: "statistics", name: "Dup" },
			],
		});
		await expect(
			caller.create({ screenKey: "sessions", name: "Dup", payload: {} })
		).resolves.toBeDefined();
	});

	it("does not conflict with a same-name preset owned by another user", async () => {
		const { caller } = filterPresetCaller(OWNER, {
			[TABLE]: [
				{ id: "fp-1", userId: OTHER, screenKey: "sessions", name: "Dup" },
			],
		});
		await expect(
			caller.create({ screenKey: "sessions", name: "Dup", payload: {} })
		).resolves.toBeDefined();
	});
});

describe("filterPreset.create behavior", () => {
	it("stamps the created row with a generated id, the caller's userId, and isDefault: false", async () => {
		const { caller, inserted } = filterPresetCaller(OWNER, { [TABLE]: [] });
		await caller.create({
			screenKey: "sessions",
			name: "My Preset",
			payload: { type: "cash_game" },
		});
		expect(inserted[TABLE]).toHaveLength(1);
		const row = inserted[TABLE]?.[0] as Record<string, unknown>;
		expect(row).toMatchObject({
			userId: OWNER,
			screenKey: "sessions",
			name: "My Preset",
			isDefault: false,
			payload: { type: "cash_game" },
		});
		expect(typeof row.id).toBe("string");
		expect((row.id as string).length).toBeGreaterThan(0);
	});
});

describe("filterPreset.update behavior", () => {
	it("re-validates a provided payload against the STORED row's screenKey, not any caller assumption", async () => {
		const { caller } = filterPresetCaller(OWNER, {
			[TABLE]: [SESSIONS_ROW],
		});
		// "norm" is a statistics-only field; the stored row's screenKey is
		// "sessions", so this must be rejected even though it independently
		// parses as a valid statistics payload at the input-schema layer.
		await expectTrpcCode(
			caller.update({ id: "fp-1", payload: { norm: "off" } }),
			"BAD_REQUEST"
		);
	});

	it("accepts a payload that matches the stored row's screenKey", async () => {
		const { caller, updated } = filterPresetCaller(OWNER, {
			[TABLE]: [SESSIONS_ROW],
		});
		await caller.update({ id: "fp-1", payload: { type: "tournament" } });
		expect(updated[TABLE]?.[0]).toMatchObject({
			payload: { type: "tournament" },
		});
	});

	it("leaves the stored payload untouched when payload is omitted", async () => {
		const { caller, updated } = filterPresetCaller(OWNER, {
			[TABLE]: [SESSIONS_ROW],
		});
		await caller.update({ id: "fp-1", name: "Renamed" });
		expect(updated[TABLE]?.[0]).not.toHaveProperty("payload");
		expect(updated[TABLE]?.[0]).toMatchObject({ name: "Renamed" });
	});

	it("rejects renaming to a name that collides with another of the caller's presets on the same screen (CONFLICT)", async () => {
		const { caller } = filterPresetCaller(OWNER, {
			[TABLE]: [
				SESSIONS_ROW,
				{
					id: "fp-2",
					userId: OWNER,
					screenKey: "sessions",
					name: "Other Preset",
				},
			],
		});
		await expectTrpcCode(
			caller.update({ id: "fp-1", name: "Other Preset" }),
			"CONFLICT"
		);
	});

	it("allows resubmitting the row's own unchanged name (no self-collision)", async () => {
		const { caller } = filterPresetCaller(OWNER, {
			[TABLE]: [SESSIONS_ROW],
		});
		await expect(
			caller.update({ id: "fp-1", name: "My Preset" })
		).resolves.toBeDefined();
	});

	it("converts a UNIQUE constraint violation from the update into CONFLICT (TOCTOU backstop)", async () => {
		const { caller, db } = filterPresetCaller(OWNER, {
			[TABLE]: [SESSIONS_ROW],
		});
		db.update = () => ({
			set: () => ({
				where: () => {
					throw new Error(
						"UNIQUE constraint failed: filter_preset.user_id, filter_preset.screen_key, filter_preset.name"
					);
				},
			}),
		});
		await expectTrpcCode(
			caller.update({ id: "fp-1", name: "New Name" }),
			"CONFLICT"
		);
	});
});

describe("filterPreset.delete behavior", () => {
	it("deletes the row", async () => {
		const { caller, deleteWhereParams } = filterPresetCaller(OWNER, {
			[TABLE]: [SESSIONS_ROW],
		});
		await expect(caller.delete({ id: "fp-1" })).resolves.toEqual({
			success: true,
		});
		expect(deleteWhereParams).toHaveLength(1);
		expect(deleteWhereParams[0]).toContain("fp-1");
	});
});

describe("filterPreset.setDefault behavior", () => {
	it("is a no-op (does not call batch) when the target is already the default", async () => {
		const { caller, batch, updateWhereParams } = filterPresetCaller(OWNER, {
			[TABLE]: [{ ...SESSIONS_ROW, isDefault: true }],
		});
		await caller.setDefault({ id: "fp-1" });
		expect(batch).not.toHaveBeenCalled();
		expect(updateWhereParams).toHaveLength(0);
	});

	it("runs exactly two statements atomically via batch when the target is not yet the default", async () => {
		const { caller, batch } = filterPresetCaller(OWNER, {
			[TABLE]: [{ ...SESSIONS_ROW, isDefault: false }],
		});
		await caller.setDefault({ id: "fp-1" });
		expect(batch).toHaveBeenCalledTimes(1);
		expect(batch.mock.calls[0]?.[0]).toHaveLength(2);
	});

	it("scopes the clearing statement's WHERE by BOTH userId AND screenKey (not just userId)", async () => {
		const { caller, updateWhereParams } = filterPresetCaller(OWNER, {
			[TABLE]: [{ ...SESSIONS_ROW, isDefault: false }],
		});
		await caller.setDefault({ id: "fp-1" });
		expect(updateWhereParams).toHaveLength(2);
		// Statement 1: clear every OTHER row for this (userId, screenKey).
		expect(updateWhereParams[0]).toContain(OWNER);
		expect(updateWhereParams[0]).toContain("sessions");
		// Statement 2: set isDefault: true on the target row itself.
		expect(updateWhereParams[1]).toContain("fp-1");
	});
});

describe("filterPreset.clearDefault behavior", () => {
	it("is a no-op when the target is not currently the default", async () => {
		const { caller, updated } = filterPresetCaller(OWNER, {
			[TABLE]: [{ ...SESSIONS_ROW, isDefault: false }],
		});
		await caller.clearDefault({ id: "fp-1" });
		expect(updated[TABLE]).toBeUndefined();
	});

	it("clears isDefault when the target is currently the default", async () => {
		const { caller, updated } = filterPresetCaller(OWNER, {
			[TABLE]: [{ ...SESSIONS_ROW, isDefault: true }],
		});
		await caller.clearDefault({ id: "fp-1" });
		expect(updated[TABLE]?.[0]).toMatchObject({ isDefault: false });
	});
});
