import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	createChainableMockDb,
	expectAccepts,
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
		db: mock.db,
		session: { user: { id: userId } },
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).gameGroup;
	return { caller, ...mock };
}

const CUR_OWNER = "user-1";

function seededRows(extra: { variant?: Rows; group?: Rows } = {}) {
	return {
		[GROUP_TABLE]: extra.group ?? [{ id: "grp-1", userId: CUR_OWNER }],
		[VARIANT_TABLE]: extra.variant ?? [{ id: "gv-1", userId: CUR_OWNER }],
	};
}

describe("gameGroup.create input validation", () => {
	it("accepts a minimal valid label", () => {
		expectAccepts(appRouter.gameGroup.create, { label: "My Group" });
	});

	it("rejects an empty label", () => {
		expectRejects(appRouter.gameGroup.create, { label: "" });
	});

	it("rejects a whitespace-only label (trimmed to empty)", () => {
		expectRejects(appRouter.gameGroup.create, { label: "   " });
	});

	it("accepts a label at the 30-character boundary", () => {
		expectAccepts(appRouter.gameGroup.create, { label: "a".repeat(30) });
	});

	it("rejects a label longer than 30 characters", () => {
		expectRejects(appRouter.gameGroup.create, { label: "a".repeat(31) });
	});

	it("rejects missing label", () => {
		expectRejects(appRouter.gameGroup.create, {});
	});

	it("accepts blind labels omitted (nullish)", () => {
		expectAccepts(appRouter.gameGroup.create, { label: "My Group" });
	});

	it("accepts blind labels explicitly null", () => {
		expectAccepts(appRouter.gameGroup.create, {
			blind1Label: null,
			blind2Label: null,
			blind3Label: null,
			label: "My Group",
		});
	});

	it("accepts blind labels at the 20-character boundary", () => {
		expectAccepts(appRouter.gameGroup.create, {
			blind1Label: "a".repeat(20),
			blind2Label: "a".repeat(20),
			blind3Label: "a".repeat(20),
			label: "My Group",
		});
	});

	it("rejects a blind label longer than 20 characters", () => {
		expectRejects(appRouter.gameGroup.create, {
			blind1Label: "a".repeat(21),
			label: "My Group",
		});
	});

	it("rejects an empty blind label", () => {
		expectRejects(appRouter.gameGroup.create, {
			blind1Label: "",
			label: "My Group",
		});
	});

	it("rejects a builtinKey supplied in the input (immutable, not settable)", () => {
		const schema = getInputSchema(appRouter.gameGroup.create);
		const parsed = schema.safeParse({
			builtinKey: "limit",
			label: "My Group",
		}) as unknown as { data?: Record<string, unknown>; success: boolean };
		expect(parsed.success).toBe(true);
		expect(parsed.data?.builtinKey).toBeUndefined();
	});
});

describe("gameGroup.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.gameGroup.update, { id: "grp-1" });
	});

	it("accepts id + label", () => {
		expectAccepts(appRouter.gameGroup.update, {
			id: "grp-1",
			label: "New Label",
		});
	});

	it("rejects empty label when provided", () => {
		expectRejects(appRouter.gameGroup.update, { id: "grp-1", label: "" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.gameGroup.update, { label: "x" });
	});

	it("accepts blind labels cleared to null", () => {
		expectAccepts(appRouter.gameGroup.update, {
			blind1Label: null,
			blind2Label: null,
			blind3Label: null,
			id: "grp-1",
		});
	});

	it("rejects a blind label longer than 20 characters", () => {
		expectRejects(appRouter.gameGroup.update, {
			blind1Label: "a".repeat(21),
			id: "grp-1",
		});
	});

	it("strips a builtinKey supplied in the input (immutable)", () => {
		const schema = getInputSchema(appRouter.gameGroup.update);
		const parsed = schema.safeParse({
			builtinKey: "stud",
			id: "grp-1",
		}) as unknown as { data?: Record<string, unknown>; success: boolean };
		expect(parsed.success).toBe(true);
		expect(parsed.data?.builtinKey).toBeUndefined();
	});
});

describe("gameGroup.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.gameGroup.delete, { id: "grp-1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.gameGroup.delete, {});
	});
});

describe("gameGroup.create", () => {
	it("stamps the created row with the caller's userId, null builtinKey, and a generated id", async () => {
		const { caller, inserted } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [],
		});
		await caller.create({ label: "Brand New" });
		expect(inserted[GROUP_TABLE]).toHaveLength(1);
		expect(inserted[GROUP_TABLE]?.[0]).toMatchObject({
			builtinKey: null,
			label: "Brand New",
			userId: CUR_OWNER,
		});
		expect(
			typeof (inserted[GROUP_TABLE]?.[0] as Record<string, unknown>)?.id
		).toBe("string");
	});
});

describe("gameGroup.list ordering + self-seed", () => {
	it("orders builtin groups limit -> stud -> bigbet ahead of custom groups", async () => {
		const { caller } = gameGroupCaller(CUR_OWNER, {
			[GROUP_TABLE]: [
				{
					archivedAt: null,
					builtinKey: null,
					id: "custom-1",
					label: "Zeta Custom",
					userId: CUR_OWNER,
				},
				{
					archivedAt: null,
					builtinKey: "bigbet",
					id: "bigbet-1",
					label: "Big Bet",
					userId: CUR_OWNER,
				},
				{
					archivedAt: null,
					builtinKey: null,
					id: "custom-2",
					label: "Alpha Custom",
					userId: CUR_OWNER,
				},
				{
					archivedAt: null,
					builtinKey: "stud",
					id: "stud-1",
					label: "Stud",
					userId: CUR_OWNER,
				},
				{
					archivedAt: null,
					builtinKey: "limit",
					id: "limit-1",
					label: "Limit",
					userId: CUR_OWNER,
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
			group: [{ builtinKey: null, id: "grp-1", label: "X", userId: CUR_OWNER }],
		});
		const { caller, selectWhereParams } = gameGroupCaller(CUR_OWNER, rows);
		await caller.list();
		expect(selectWhereParams).toContainEqual([CUR_OWNER]);
	});
});
