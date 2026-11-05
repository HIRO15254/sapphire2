import { filterPreset } from "@sapphire2/db/schema/filter-preset";
import type { TRPCError } from "@trpc/server";
import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import {
	createChainableMockDb,
	expectAccepts,
	expectRejects,
} from "./test-utils";

type Rows = Record<string, unknown>[];

const TABLE = getTableName(filterPreset);

const OWNER = "user-1";

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

	it("accepts the shared statistics filters", () => {
		expectAccepts(appRouter.filterPreset.create, {
			screenKey: "statistics",
			name: "My Preset",
			payload: {
				period: "last_7_days",
				dateFrom: "2026-01-01",
				dateTo: "2026-01-31",
				valuation: "real",
				baseAssetId: "base-1",
				roomId: "room-1",
				entryTagIds: ["entry-tag-1"],
				tournamentTagIds: ["tournament-tag-1"],
			},
		});
	});

	it("requires a statistics mode", () => {
		expectRejects(appRouter.filterPreset.create, {
			screenKey: "statistics",
			name: "My Preset",
			payload: {},
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

	it("rejects legacy and conflicting filter fields", () => {
		for (const payload of [
			{ display: "currency" },
			{ norm: "off" },
			{ type: "cash_game" },
			{ assetId: "asset-1", normalized: true },
			{ dateFrom: "2026-02-01", dateTo: "2026-01-01" },
		]) {
			expectRejects(appRouter.filterPreset.create, {
				screenKey: "sessions",
				name: "My Preset",
				payload,
			});
		}
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

	it("accepts a shared payload", () => {
		expectAccepts(appRouter.filterPreset.update, {
			id: "fp-1",
			payload: { valuation: "real", baseAssetId: "base-1" },
		});
	});

	it("rejects legacy payload fields", () => {
		expectRejects(appRouter.filterPreset.update, {
			id: "fp-1",
			payload: { norm: "off" },
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
		const { caller, insert } = filterPresetCaller(OWNER, {
			[TABLE]: [],
		});
		insert.mockImplementation(() => ({
			values: vi.fn(() => {
				throw new Error("Failed query", {
					cause: new Error(
						"UNIQUE constraint failed: filter_preset.user_id, filter_preset.screen_key, filter_preset.name"
					),
				});
			}),
		}));
		await expectTrpcCode(
			caller.create({ screenKey: "sessions", name: "Dup", payload: {} }),
			"CONFLICT"
		);
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
			payload: { kind: "cash" },
		});
		expect(inserted[TABLE]).toHaveLength(1);
		const row = inserted[TABLE]?.[0] as Record<string, unknown>;
		expect(row).toMatchObject({
			userId: OWNER,
			screenKey: "sessions",
			name: "My Preset",
			isDefault: false,
			payload: { kind: "cash" },
		});
		expect(typeof row.id).toBe("string");
		expect((row.id as string).length).toBeGreaterThan(0);
	});
});

describe("filterPreset.update behavior", () => {
	it("re-validates a provided payload against the STORED row's screenKey, not any caller assumption", async () => {
		const { caller } = filterPresetCaller(OWNER, {
			[TABLE]: [
				{
					...SESSIONS_ROW,
					screenKey: "statistics",
					payload: { normalized: true },
				},
			],
		});
		await expectTrpcCode(
			caller.update({ id: "fp-1", payload: {} }),
			"BAD_REQUEST"
		);
	});

	it("accepts a payload that matches the stored row's screenKey", async () => {
		const { caller, updated } = filterPresetCaller(OWNER, {
			[TABLE]: [SESSIONS_ROW],
		});
		await caller.update({ id: "fp-1", payload: { kind: "tournament" } });
		expect(updated[TABLE]?.[0]).toMatchObject({
			payload: { kind: "tournament" },
		});
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
		const { caller, select, update } = filterPresetCaller(OWNER, {
			[TABLE]: [],
		});
		select.mockImplementationOnce(
			createChainableMockDb({ select: { [TABLE]: [SESSIONS_ROW] } }).select
		);
		update.mockImplementation(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => {
					throw new Error(
						"UNIQUE constraint failed: filter_preset.user_id, filter_preset.screen_key, filter_preset.name"
					);
				}),
			})),
		}));
		await expectTrpcCode(
			caller.update({ id: "fp-1", name: "New Name" }),
			"CONFLICT"
		);
		expect(update).toHaveBeenCalledTimes(1);
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
