import { filterPreset } from "@sapphire2/db/schema/filter-preset";
import type { TRPCError } from "@trpc/server";
import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import { createChainableMockDb } from "./test-utils";

type Rows = Record<string, unknown>[];

const TABLE = getTableName(filterPreset);

const OWNER = "user-1";

function filterPresetCaller(userId: string, select: Record<string, Rows>) {
	const mock = createChainableMockDb({ select });
	const caller = appRouter.createCaller({
		db: mock.db,
		session: { user: { id: userId } },
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
	isDefault: false,
	name: "My Preset",
	payload: { period: "last_7_days" },
	screenKey: "sessions",
	userId: OWNER,
};

describe("filterPreset.create collision guard", () => {
	it("DB-constraint-catch: converts a UNIQUE constraint violation from the insert into CONFLICT, not a raw 500", async () => {
		const { caller, insert } = filterPresetCaller(OWNER, {
			[TABLE]: [],
		});
		insert.mockImplementation(() => ({
			select: vi.fn(() => Promise.resolve(undefined)),
			values: vi.fn(() => {
				throw new Error("Failed query", {
					cause: new Error(
						"UNIQUE constraint failed: filter_preset.user_id, filter_preset.screen_key, filter_preset.name"
					),
				});
			}),
		}));
		await expectTrpcCode(
			caller.create({ name: "Dup", payload: {}, screenKey: "sessions" }),
			"CONFLICT"
		);
	});
});

describe("filterPreset.update behavior", () => {
	it("re-validates a provided payload against the STORED row's screenKey, not any caller assumption", async () => {
		const { caller } = filterPresetCaller(OWNER, {
			[TABLE]: [
				{
					...SESSIONS_ROW,
					payload: { normalized: true },
					screenKey: "statistics",
				},
			],
		});
		await expectTrpcCode(
			caller.update({ id: "fp-1", payload: {} }),
			"BAD_REQUEST"
		);
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
