import { filterPreset } from "@sapphire2/db/schema/filter-preset";
import type { TRPCError } from "@trpc/server";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	createChainableMockDb,
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

type Rows = Record<string, unknown>[];

const TABLE = getTableName(filterPreset);

const OWNER = "user-1";
const OTHER = "user-2";

function filterPresetCaller(userId: string, select: Record<string, Rows>) {
	const mock = createChainableMockDb({ evaluateWhere: true, select });
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

const writers = [
	[
		"create",
		appRouter.filterPreset.create,
		{ screenKey: "sessions", payload: {} },
	],
	["update", appRouter.filterPreset.update, { id: "fp-1" }],
] as const;

describe("filterPreset router", () => {
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

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.filterPreset, {
			clearDefault: "mutation",
			create: "mutation",
			delete: "mutation",
			list: "query",
			setDefault: "mutation",
			update: "mutation",
		});
	});
});

describe("filterPreset.list input validation", () => {
	it("rejects an unknown screenKey", () => {
		expectRejects(appRouter.filterPreset.list, { screenKey: "dashboard" });
	});
});

describe("filterPreset name validation", () => {
	it.each(writers)("%s rejects an empty name", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "" });
	});

	it.each(
		writers
	)("%s rejects a whitespace-only name (trimmed to empty)", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "   " });
	});

	it.each(
		writers
	)("%s accepts a name at the 50-character boundary", (_name, procedure, base) => {
		expectAccepts(procedure, { ...base, name: "a".repeat(50) });
	});

	it.each(
		writers
	)("%s rejects a name longer than 50 characters", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "a".repeat(51) });
	});
});

describe("filterPreset.create input validation", () => {
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
				display: "normalized",
			},
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

	it("rejects an unknown screenKey", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "dashboard",
			name: "My Preset",
			payload: {},
		});
	});

	it("rejects an invalid 'display' value on sessions payload", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "sessions",
			name: "My Preset",
			payload: { display: "bb" },
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

	it.each([
		["display", "statistics", { display: "currency" }],
		["roomId", "statistics", { roomId: "room-1" }],
		["norm", "sessions", { norm: "off" }],
	])("rejects the screen-scoped field '%s' under screenKey: %s", (_field, screenKey, payload) => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey,
			name: "My Preset",
			payload,
		});
	});

	it.each([
		["from", "sessions", { from: 1.5 }],
		["to", "statistics", { to: 2.5 }],
	])("rejects a non-integer '%s' on the %s payload", (_field, screenKey, payload) => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey,
			name: "My Preset",
			payload,
		});
	});
});

describe("filterPreset.update input validation", () => {
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
		const { caller, inserted } = filterPresetCaller(OWNER, {
			[TABLE]: [
				{ id: "fp-1", userId: OWNER, screenKey: "statistics", name: "Dup" },
			],
		});
		await caller.create({ screenKey: "sessions", name: "Dup", payload: {} });
		expect(inserted[TABLE]).toHaveLength(1);
	});

	it("does not conflict with a same-name preset owned by another user", async () => {
		const { caller, inserted } = filterPresetCaller(OWNER, {
			[TABLE]: [
				{ id: "fp-1", userId: OTHER, screenKey: "sessions", name: "Dup" },
			],
		});
		await caller.create({ screenKey: "sessions", name: "Dup", payload: {} });
		expect(inserted[TABLE]).toHaveLength(1);
	});

	it("binds userId, screenKey AND name into the collision query, fetching at most one row", async () => {
		const { caller, selectWhereParams, selectLimits } = filterPresetCaller(
			OWNER,
			{ [TABLE]: [] }
		);
		await caller.create({ screenKey: "sessions", name: "Fresh", payload: {} });
		expect(selectWhereParams).toContainEqual([OWNER, "sessions", "Fresh"]);
		expect(selectLimits).toContain(1);
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

	it("binds the new name and excludes the row's own id from the rename collision query", async () => {
		const { caller, selectWhereParams, selectLimits } = filterPresetCaller(
			OWNER,
			{ [TABLE]: [SESSIONS_ROW] }
		);
		await caller.update({ id: "fp-1", name: "Renamed" });
		expect(selectWhereParams).toContainEqual([
			OWNER,
			"sessions",
			"Renamed",
			"fp-1",
		]);
		expect(selectLimits).toContain(1);
	});

	it("allows resubmitting the row's own unchanged name without a collision query", async () => {
		const { caller, selectWhereParams, updated } = filterPresetCaller(OWNER, {
			[TABLE]: [SESSIONS_ROW],
		});
		await caller.update({ id: "fp-1", name: "My Preset" });
		expect(updated[TABLE]?.[0]).toMatchObject({ name: "My Preset" });
		expect(selectWhereParams).not.toContainEqual([
			OWNER,
			"sessions",
			"My Preset",
			"fp-1",
		]);
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
		expect(updateWhereParams[0]).toContain(OWNER);
		expect(updateWhereParams[0]).toContain("sessions");
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
