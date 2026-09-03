import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	createChainableMockDb,
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
	getInputSchema,
} from "./test-utils";

type Rows = Record<string, unknown>[];

const GROUP_TABLE = getTableName(gameGroup);
const VARIANT_TABLE = getTableName(gameVariant);
const MIX_TABLE = getTableName(gameMix);

function gameGroupCaller(userId: string, select: Record<string, Rows>) {
	const mock = createChainableMockDb({ select });
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db: mock.db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).gameGroup;
	return { caller, ...mock };
}

async function expectTrpcCode(
	promise: Promise<unknown>,
	code: TRPCError["code"]
): Promise<void> {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(TRPCError);
		expect((error as TRPCError).code).toBe(code);
		return;
	}
	throw new Error(`expected the call to throw ${code} but it resolved`);
}

const CUR_OWNER = "user-1";
const CUR_OTHER = "user-2";

function seededRows(extra: { variant?: Rows; group?: Rows } = {}) {
	return {
		[GROUP_TABLE]: extra.group ?? [{ id: "grp-1", userId: CUR_OWNER }],
		[VARIANT_TABLE]: extra.variant ?? [{ id: "gv-1", userId: CUR_OWNER }],
	};
}

const writers = [
	["create", appRouter.gameGroup.create, {}],
	["update", appRouter.gameGroup.update, { id: "grp-1" }],
] as const;

describe("gameGroup router", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.gameGroup).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.gameGroup, {
			create: "mutation",
			delete: "mutation",
			list: "query",
			update: "mutation",
		});
	});
});

describe("gameGroup label validation", () => {
	it.each(writers)("%s rejects an empty label", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, label: "" });
	});

	it.each(
		writers
	)("%s rejects a whitespace-only label (trimmed to empty)", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, label: "   " });
	});

	it.each(
		writers
	)("%s accepts a label at the 30-character boundary", (_name, procedure, base) => {
		expectAccepts(procedure, { ...base, label: "a".repeat(30) });
	});

	it.each(
		writers
	)("%s rejects a label longer than 30 characters", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, label: "a".repeat(31) });
	});
});

describe("gameGroup blind label validation", () => {
	it.each(
		writers
	)("%s accepts blind labels explicitly null", (_name, procedure, base) => {
		expectAccepts(procedure, {
			...base,
			label: "My Group",
			blind1Label: null,
			blind2Label: null,
			blind3Label: null,
		});
	});

	it.each(
		writers
	)("%s accepts blind labels at the 20-character boundary", (_name, procedure, base) => {
		expectAccepts(procedure, {
			...base,
			label: "My Group",
			blind1Label: "a".repeat(20),
			blind2Label: "a".repeat(20),
			blind3Label: "a".repeat(20),
		});
	});

	it.each(
		writers
	)("%s rejects a blind label longer than 20 characters", (_name, procedure, base) => {
		expectRejects(procedure, {
			...base,
			label: "My Group",
			blind1Label: "a".repeat(21),
		});
	});

	it.each(
		writers
	)("%s rejects an empty blind label", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, label: "My Group", blind1Label: "" });
	});
});

describe("gameGroup builtinKey immutability", () => {
	it.each(
		writers
	)("%s strips a builtinKey supplied in the input", (_name, procedure, base) => {
		const schema = getInputSchema(procedure);
		const parsed = schema.safeParse({
			...base,
			label: "My Group",
			builtinKey: "limit",
		}) as unknown as { data?: Record<string, unknown>; success: boolean };
		expect(parsed.success).toBe(true);
		expect(parsed.data?.builtinKey).toBeUndefined();
	});
});

describe("gameGroup.create collision guard (CONFLICT)", () => {
	it("rejects a label colliding with the caller's existing group label (case-insensitive)", async () => {
		const { caller } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }],
		});
		await expectTrpcCode(caller.create({ label: "my group" }), "CONFLICT");
	});

	it("inserts a genuinely new label with no collision", async () => {
		const { caller, inserted } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [{ id: "grp-1", userId: CUR_OWNER, label: "Other Group" }],
		});
		await caller.create({ label: "Brand New" });
		expect(inserted[GROUP_TABLE]).toHaveLength(1);
		expect(inserted[GROUP_TABLE]?.[0]).toMatchObject({ label: "Brand New" });
	});

	it("stamps the created row with the caller's userId, null builtinKey, and a generated id", async () => {
		const { caller, inserted } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [],
		});
		await caller.create({ label: "Brand New" });
		expect(inserted[GROUP_TABLE]).toHaveLength(1);
		expect(inserted[GROUP_TABLE]?.[0]).toMatchObject({
			userId: CUR_OWNER,
			label: "Brand New",
			builtinKey: null,
		});
		expect(
			typeof (inserted[GROUP_TABLE]?.[0] as Record<string, unknown>)?.id
		).toBe("string");
	});

	it("converts a (user_id, label) unique-constraint violation from the insert into the same CONFLICT (c14 backstop)", async () => {
		const { caller, db } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [],
		});
		db.insert = () => ({
			values: () => {
				throw new Error(
					"UNIQUE constraint failed: game_group.user_id, game_group.label"
				);
			},
		});
		await expectTrpcCode(caller.create({ label: "Brand New" }), "CONFLICT");
	});

	it("converts the migration-0041 label trigger abort into the same CONFLICT (the guard that actually fires)", async () => {
		const { caller, db } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [],
		});
		db.insert = () => ({
			values: () => {
				throw new Error("game_group label already exists");
			},
		});
		await expectTrpcCode(caller.create({ label: "Brand New" }), "CONFLICT");
	});
});

describe("gameGroup ownership (uniform FORBIDDEN, SA2-183)", () => {
	for (const op of ["update", "delete"] as const) {
		it(`${op} throws FORBIDDEN for a row owned by another user`, async () => {
			const { caller } = gameGroupCaller(CUR_OWNER, {
				[GROUP_TABLE]: [
					{ id: "grp-1", userId: CUR_OTHER, label: "Their Group" },
				],
				[VARIANT_TABLE]: [],
			});
			await expectTrpcCode(caller[op]({ id: "grp-1" }), "FORBIDDEN");
		});

		it(`${op} throws FORBIDDEN (not NOT_FOUND) for a missing row`, async () => {
			const { caller } = gameGroupCaller(CUR_OWNER, {
				[GROUP_TABLE]: [],
				[VARIANT_TABLE]: [],
			});
			await expectTrpcCode(caller[op]({ id: "missing" }), "FORBIDDEN");
		});
	}

	it("update writes the new label for a row owned by the caller", async () => {
		const { caller, updated } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }],
		});
		await caller.update({ id: "grp-1", label: "Renamed Group" });
		expect(updated[GROUP_TABLE]).toHaveLength(1);
		expect(updated[GROUP_TABLE]?.[0]).toMatchObject({ label: "Renamed Group" });
	});

	it("update sets blind1Label for a row owned by the caller", async () => {
		const { caller, updated } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }],
		});
		await caller.update({ id: "grp-1", blind1Label: "SB" });
		expect(updated[GROUP_TABLE]?.[0]).toMatchObject({ blind1Label: "SB" });
	});
});

describe("gameGroup.update excludes self from collision", () => {
	it("writes the row's own (unchanged) label without a self-collision", async () => {
		const { caller, updated } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }],
		});
		await caller.update({ id: "grp-1", label: "My Group" });
		expect(updated[GROUP_TABLE]?.[0]).toMatchObject({ label: "My Group" });
	});

	it("still rejects renaming to a different existing group label (CONFLICT)", async () => {
		const { caller } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [
				{ id: "grp-1", userId: CUR_OWNER, label: "My Group" },
				{ id: "grp-2", userId: CUR_OWNER, label: "Other Group" },
			],
		});
		await expectTrpcCode(
			caller.update({ id: "grp-1", label: "Other Group" }),
			"CONFLICT"
		);
	});
});

describe("gameGroup write-IDOR guard (SA2-176)", () => {
	it("update WHERE binds both the id and the caller's userId", async () => {
		const { caller, updateWhereParams } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }],
		});
		await caller.update({ id: "grp-1", label: "Renamed" });
		expect(updateWhereParams).toHaveLength(1);
		expect(updateWhereParams[0]).toContain("grp-1");
		expect(updateWhereParams[0]).toContain(CUR_OWNER);
	});

	it("delete WHERE binds both the id and the caller's userId", async () => {
		const { caller, deleteWhereParams } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }],
			[VARIANT_TABLE]: [],
		});
		await caller.delete({ id: "grp-1" });
		expect(deleteWhereParams).toHaveLength(1);
		expect(deleteWhereParams[0]).toContain("grp-1");
		expect(deleteWhereParams[0]).toContain(CUR_OWNER);
	});
});

describe("gameGroup.delete in-use rejection (cascade-aware delete, SA2-165)", () => {
	it("rejects with CONFLICT when a variant references the group", async () => {
		const { caller } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }],
			[VARIANT_TABLE]: [
				{
					id: "gv-1",
					userId: CUR_OWNER,
					groupId: "grp-1",
					label: "NL Hold'em",
				},
			],
		});
		await expectTrpcCode(caller.delete({ id: "grp-1" }), "CONFLICT");
	});

	it("succeeds when no variant references the group", async () => {
		const { caller } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }],
			[VARIANT_TABLE]: [],
		});
		await expect(caller.delete({ id: "grp-1" })).resolves.toEqual({
			success: true,
		});
	});
});

describe("gameGroup.list ordering + self-seed", () => {
	it("orders builtin groups limit -> stud -> bigbet ahead of custom groups", async () => {
		const { caller } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [
				{
					id: "custom-1",
					userId: CUR_OWNER,
					builtinKey: null,
					label: "Zeta Custom",
				},
				{
					id: "bigbet-1",
					userId: CUR_OWNER,
					builtinKey: "bigbet",
					label: "Big Bet",
				},
				{
					id: "custom-2",
					userId: CUR_OWNER,
					builtinKey: null,
					label: "Alpha Custom",
				},
				{
					id: "stud-1",
					userId: CUR_OWNER,
					builtinKey: "stud",
					label: "Stud",
				},
				{
					id: "limit-1",
					userId: CUR_OWNER,
					builtinKey: "limit",
					label: "Limit",
				},
			],
			[VARIANT_TABLE]: [{ id: "gv-1", userId: CUR_OWNER }],
		});
		const result = (await caller.list()) as { id: string }[];
		expect(result.map((r) => r.id)).toEqual([
			"limit-1",
			"stud-1",
			"bigbet-1",
			"custom-2",
			"custom-1",
		]);
	});

	it("self-seeds when the caller has zero groups and zero variants", async () => {
		const { caller, inserted } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [],
			[VARIANT_TABLE]: [],
		});
		await caller.list();
		expect(inserted[GROUP_TABLE]).toHaveLength(3);
		expect(inserted[VARIANT_TABLE]).toHaveLength(21);
		expect(inserted[MIX_TABLE]).toHaveLength(3);
	});

	it("does not re-seed when the caller already has a group", async () => {
		const { caller, inserted } = gameGroupCaller(CUR_OWNER, seededRows());
		await caller.list();
		expect(inserted[GROUP_TABLE]).toBeUndefined();
		expect(inserted[VARIANT_TABLE]).toBeUndefined();
	});

	it("scopes the list query to the caller's userId", async () => {
		const rows = seededRows({
			group: [{ id: "grp-1", userId: CUR_OWNER, builtinKey: null, label: "X" }],
		});
		const { caller, selectWhereParams } = gameGroupCaller(CUR_OWNER, rows);
		await caller.list();
		expect(selectWhereParams).toContainEqual([CUR_OWNER]);
	});
});
