import { currency } from "@sapphire2/db/schema/currency";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { room } from "@sapphire2/db/schema/room";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
	getInputSchema,
} from "./test-utils";

type Rows = Record<string, unknown>[];

function createMockDb(rowsByTable: Map<unknown, Rows>) {
	const makeChain = (rows: Rows) => {
		const chain = Promise.resolve(rows) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.from = (table: unknown) => makeChain(rowsByTable.get(table) ?? []);
		chain.where = () => chain;
		chain.orderBy = () => chain;
		chain.limit = () => chain;
		chain.innerJoin = () => chain;
		chain.leftJoin = () => chain;
		return chain;
	};
	return {
		select: () => makeChain([]),
		insert: () => ({ values: () => Promise.resolve(undefined) }),
		update: () => ({
			set: () => ({ where: () => Promise.resolve(undefined) }),
		}),
		delete: () => ({ where: () => Promise.resolve(undefined) }),
		batch: (statements: unknown[]) =>
			Promise.all(statements as Promise<unknown>[]),
	};
}

function tournamentCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	return appRouter.createCaller({
		session: { user: { id: userId } },
		db: createMockDb(rowsByTable),
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).tournament;
}

function callerWithDb(userId: string, db: unknown) {
	return appRouter.createCaller({
		session: { user: { id: userId } },
		db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).tournament;
}

/** Captures every `insert(table).values(v)` call, tagged with the table name. */
function createCallerCapturingInserts(
	userId: string,
	rowsByTable: Map<unknown, Rows>
) {
	const inserted: { table: string; values: Record<string, unknown> }[] = [];
	const baseDb = createMockDb(rowsByTable);
	const db = {
		...baseDb,
		insert: (table: unknown) => ({
			values: (v: Record<string, unknown>) => {
				inserted.push({ table: getTableName(table as never), values: v });
				return Promise.resolve(undefined);
			},
		}),
	};
	return { caller: callerWithDb(userId, db), inserted };
}

/** Captures every `update(table).set(v).where(...)` call's payload. */
function createCallerCapturingUpdates(
	userId: string,
	rowsByTable: Map<unknown, Rows>
) {
	const updated: Record<string, unknown>[] = [];
	const baseDb = createMockDb(rowsByTable);
	const db = {
		...baseDb,
		update: () => ({
			set: (v: Record<string, unknown>) => {
				updated.push(v);
				return { where: () => Promise.resolve(undefined) };
			},
		}),
	};
	return { caller: callerWithDb(userId, db), updated };
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

describe("tournament router", () => {
	it("appRouter has tournament namespace", () => {
		expect(appRouter.tournament).toBeDefined();
	});

	it("has listByRoom procedure", () => {
		expect(appRouter.tournament.listByRoom).toBeDefined();
	});

	it("has getById procedure", () => {
		expect(appRouter.tournament.getById).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.tournament.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.tournament.update).toBeDefined();
	});

	it("has archive procedure", () => {
		expect(appRouter.tournament.archive).toBeDefined();
	});

	it("has restore procedure", () => {
		expect(appRouter.tournament.restore).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.tournament.delete).toBeDefined();
	});

	it("has addTag procedure", () => {
		expect(appRouter.tournament.addTag).toBeDefined();
	});

	it("has removeTag procedure", () => {
		expect(appRouter.tournament.removeTag).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.tournament).sort()).toEqual(
			[
				"addTag",
				"archive",
				"create",
				"createWithLevels",
				"delete",
				"getById",
				"listByRoom",
				"removeTag",
				"restore",
				"update",
				"updateWithLevels",
			].sort()
		);
	});

	it("listByRoom / getById are protected queries", () => {
		expectProtected(appRouter.tournament.listByRoom);
		expectType(appRouter.tournament.listByRoom, "query");
		expectProtected(appRouter.tournament.getById);
		expectType(appRouter.tournament.getById, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of [
			"create",
			"update",
			"archive",
			"restore",
			"delete",
			"addTag",
			"removeTag",
			"createWithLevels",
			"updateWithLevels",
		] as const) {
			const proc = appRouter.tournament[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("tournament.listByRoom input validation", () => {
	it("accepts roomId only", () => {
		expectAccepts(appRouter.tournament.listByRoom, { roomId: "s1" });
	});

	it("accepts includeArchived flag", () => {
		expectAccepts(appRouter.tournament.listByRoom, {
			roomId: "s1",
			includeArchived: true,
		});
	});

	it("rejects missing roomId", () => {
		expectRejects(appRouter.tournament.listByRoom, {});
	});
});

describe("tournament.create input validation", () => {
	it("accepts minimal payload with default variant", () => {
		const schema = getInputSchema(appRouter.tournament.create);
		const parsed = schema.safeParse({
			roomId: "s1",
			name: "Main Event",
		}) as unknown as { success: true; data: { variant: string } };
		expect(parsed.success).toBe(true);
		expect(parsed.data.variant).toBe("NLH");
	});

	it("accepts full numeric configuration", () => {
		expectAccepts(appRouter.tournament.create, {
			roomId: "s1",
			name: "ME",
			buyIn: 100_000,
			entryFee: 10_000,
			startingStack: 30_000,
			bountyAmount: 20_000,
			tableSize: 9,
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.tournament.create, {
			roomId: "s1",
			name: "",
		});
	});

	it("rejects non-integer buyIn", () => {
		expectRejects(appRouter.tournament.create, {
			roomId: "s1",
			name: "ME",
			buyIn: 100.5,
		});
	});

	it("rejects missing roomId", () => {
		expectRejects(appRouter.tournament.create, { name: "ME" });
	});

	it("accepts a variantId string", () => {
		expectAccepts(appRouter.tournament.create, {
			roomId: "s1",
			name: "ME",
			variantId: "gv-1",
		});
	});

	it("accepts a payload without variantId (variantId stays optional)", () => {
		const schema = getInputSchema(appRouter.tournament.create);
		const parsed = schema.safeParse({
			roomId: "s1",
			name: "ME",
		}) as unknown as { success: true; data: { variantId?: string } };
		expect(parsed.success).toBe(true);
		expect(parsed.data.variantId).toBeUndefined();
	});

	it("rejects a non-string variantId", () => {
		expectRejects(appRouter.tournament.create, {
			roomId: "s1",
			name: "ME",
			variantId: 123,
		});
	});
});

describe("tournament.update input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.tournament.update, { id: "tn1" });
	});

	it("accepts nullable numeric fields set to null", () => {
		expectAccepts(appRouter.tournament.update, {
			id: "tn1",
			buyIn: null,
			entryFee: null,
			startingStack: null,
			bountyAmount: null,
			tableSize: null,
			currencyId: null,
			memo: null,
		});
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.tournament.update, { id: "tn1", name: "" });
	});

	it("rejects non-integer tableSize", () => {
		expectRejects(appRouter.tournament.update, {
			id: "tn1",
			tableSize: 9.5,
		});
	});

	it("accepts a variantId string", () => {
		expectAccepts(appRouter.tournament.update, {
			id: "tn1",
			variantId: "gv-1",
		});
	});

	it("accepts variantId: null", () => {
		expectAccepts(appRouter.tournament.update, { id: "tn1", variantId: null });
	});

	it("accepts a payload without variantId (untouched)", () => {
		const schema = getInputSchema(appRouter.tournament.update);
		const parsed = schema.safeParse({ id: "tn1" }) as unknown as {
			success: true;
			data: { variantId?: string | null };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.variantId).toBeUndefined();
	});

	it("rejects a non-string, non-null variantId", () => {
		expectRejects(appRouter.tournament.update, { id: "tn1", variantId: 123 });
	});
});

describe("tournament.createWithLevels input validation", () => {
	it("accepts minimal payload (no levels)", () => {
		expectAccepts(appRouter.tournament.createWithLevels, {
			roomId: "s1",
			name: "Series",
		});
	});

	it("accepts a full level + chip purchases structure", () => {
		expectAccepts(appRouter.tournament.createWithLevels, {
			roomId: "s1",
			name: "Series",
			tags: ["weekly"],
			chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000 }],
			blindLevels: [
				{ isBreak: false, blind1: 100, blind2: 200, minutes: 20 },
				{ isBreak: true, minutes: 10 },
			],
		});
	});

	it("rejects a chipPurchase with non-integer cost", () => {
		expectRejects(appRouter.tournament.createWithLevels, {
			roomId: "s1",
			name: "Series",
			chipPurchases: [{ name: "Rebuy", cost: 100.5, chips: 10_000 }],
		});
	});

	it("rejects a blindLevel missing isBreak", () => {
		expectRejects(appRouter.tournament.createWithLevels, {
			roomId: "s1",
			name: "Series",
			blindLevels: [{ blind1: 100 }],
		});
	});

	it("accepts minimal payload with default variant NLH", () => {
		const schema = getInputSchema(appRouter.tournament.createWithLevels);
		const parsed = schema.safeParse({
			roomId: "s1",
			name: "Series",
		}) as unknown as { success: true; data: { variant: string } };
		expect(parsed.success).toBe(true);
		expect(parsed.data.variant).toBe("NLH");
	});

	it("accepts a variantId string", () => {
		expectAccepts(appRouter.tournament.createWithLevels, {
			roomId: "s1",
			name: "Series",
			variantId: "gv-1",
		});
	});

	it("rejects a non-string variantId", () => {
		expectRejects(appRouter.tournament.createWithLevels, {
			roomId: "s1",
			name: "Series",
			variantId: 123,
		});
	});
});

describe("tournament.updateWithLevels input validation", () => {
	it("accepts id + required blindLevels array", () => {
		expectAccepts(appRouter.tournament.updateWithLevels, {
			id: "tn1",
			blindLevels: [{ isBreak: false, blind1: 100, blind2: 200 }],
		});
	});

	it("rejects missing blindLevels (required field)", () => {
		expectRejects(appRouter.tournament.updateWithLevels, { id: "tn1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournament.updateWithLevels, {
			blindLevels: [],
		});
	});

	it("accepts a variantId string", () => {
		expectAccepts(appRouter.tournament.updateWithLevels, {
			id: "tn1",
			blindLevels: [],
			variantId: "gv-1",
		});
	});

	it("accepts variantId: null", () => {
		expectAccepts(appRouter.tournament.updateWithLevels, {
			id: "tn1",
			blindLevels: [],
			variantId: null,
		});
	});

	it("rejects a non-string, non-null variantId", () => {
		expectRejects(appRouter.tournament.updateWithLevels, {
			id: "tn1",
			blindLevels: [],
			variantId: 123,
		});
	});
});

describe("tournament.addTag input validation", () => {
	it("accepts a valid tag payload", () => {
		expectAccepts(appRouter.tournament.addTag, {
			tournamentId: "tn1",
			name: "weekly",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.tournament.addTag, {
			tournamentId: "tn1",
			name: "",
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.tournament.addTag, { name: "weekly" });
	});
});

describe("tournament.removeTag input validation", () => {
	it("accepts valid id", () => {
		expectAccepts(appRouter.tournament.removeTag, { id: "tag1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournament.removeTag, {});
	});
});

describe("tournament.{archive,restore,delete,getById} input validation", () => {
	it("each accepts {id}", () => {
		expectAccepts(appRouter.tournament.archive, { id: "tn1" });
		expectAccepts(appRouter.tournament.restore, { id: "tn1" });
		expectAccepts(appRouter.tournament.delete, { id: "tn1" });
		expectAccepts(appRouter.tournament.getById, { id: "tn1" });
	});

	it("each rejects missing id", () => {
		expectRejects(appRouter.tournament.archive, {});
		expectRejects(appRouter.tournament.restore, {});
		expectRejects(appRouter.tournament.delete, {});
		expectRejects(appRouter.tournament.getById, {});
	});
});

describe("tournament currency ownership (SA2-180)", () => {
	const ownedRoom = { id: "room-1", userId: CUR_OWNER };
	const ownedTournament = { id: "tn-1", roomId: "room-1" };

	function createRows(currencyRows: Rows) {
		return new Map<unknown, Rows>([
			[room, [ownedRoom]],
			[tournament, [ownedTournament]],
			[currency, currencyRows],
		]);
	}

	it("create accepts a currency owned by the caller", async () => {
		const caller = tournamentCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OWNER }])
		);
		await expect(
			caller.create({ roomId: "room-1", name: "T", currencyId: "cur-1" })
		).resolves.toBeDefined();
	});

	it("create rejects a currency owned by another user with FORBIDDEN", async () => {
		const caller = tournamentCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OTHER }])
		);
		await expectTrpcCode(
			caller.create({ roomId: "room-1", name: "T", currencyId: "cur-1" }),
			"FORBIDDEN"
		);
	});

	it("create skips currency validation when currencyId is omitted", async () => {
		const caller = tournamentCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OTHER }])
		);
		await expect(
			caller.create({ roomId: "room-1", name: "T" })
		).resolves.toBeDefined();
	});

	it("update rejects a foreign currency with FORBIDDEN", async () => {
		const caller = tournamentCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OTHER }])
		);
		await expectTrpcCode(
			caller.update({ id: "tn-1", currencyId: "cur-1" }),
			"FORBIDDEN"
		);
	});

	it("update allows clearing the currency with null", async () => {
		const caller = tournamentCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OTHER }])
		);
		await expect(
			caller.update({ id: "tn-1", currencyId: null })
		).resolves.toBeDefined();
	});

	it("createWithLevels rejects a foreign currency with FORBIDDEN", async () => {
		const caller = tournamentCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OTHER }])
		);
		await expectTrpcCode(
			caller.createWithLevels({
				roomId: "room-1",
				name: "T",
				currencyId: "cur-1",
				blindLevels: [],
			}),
			"FORBIDDEN"
		);
	});

	it("updateWithLevels rejects a foreign currency with FORBIDDEN", async () => {
		const caller = tournamentCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OTHER }])
		);
		await expectTrpcCode(
			caller.updateWithLevels({
				id: "tn-1",
				currencyId: "cur-1",
				blindLevels: [],
			}),
			"FORBIDDEN"
		);
	});

	it("createWithLevels accepts a currency owned by the caller", async () => {
		const caller = tournamentCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OWNER }])
		);
		await expect(
			caller.createWithLevels({
				roomId: "room-1",
				name: "T",
				currencyId: "cur-1",
				blindLevels: [],
			})
		).resolves.toBeDefined();
	});
});

describe("tournament.create resolves variantId (user-defined game variants)", () => {
	const ownedRoom = { id: "room-1", userId: CUR_OWNER };

	function createRows(variantRows: Rows) {
		return new Map<unknown, Rows>([
			[room, [ownedRoom]],
			[tournament, []],
			[currency, []],
			[gameVariant, variantRows],
		]);
	}

	function tournamentInsert(
		inserted: { table: string; values: Record<string, unknown> }[]
	) {
		return inserted.find((i) => i.table === "tournament")?.values;
	}

	it("writes the resolved variant name and id, overriding the free-text variant input", async () => {
		const { caller, inserted } = createCallerCapturingInserts(
			CUR_OWNER,
			createRows([{ id: "gv-1", userId: CUR_OWNER, name: "PLO5" }])
		);

		await caller.create({
			roomId: "room-1",
			name: "T",
			variant: "this-text-is-ignored",
			variantId: "gv-1",
		});

		expect(tournamentInsert(inserted)).toMatchObject({
			variant: "PLO5",
			variantId: "gv-1",
		});
	});

	it("falls back to the free-text variant and a null variantId when variantId is omitted", async () => {
		const { caller, inserted } = createCallerCapturingInserts(
			CUR_OWNER,
			createRows([])
		);

		await caller.create({ roomId: "room-1", name: "T", variant: "PLO" });

		expect(tournamentInsert(inserted)).toMatchObject({
			variant: "PLO",
			variantId: null,
		});
	});

	it("throws NOT_FOUND when variantId does not exist", async () => {
		const caller = tournamentCaller(CUR_OWNER, createRows([]));
		await expectTrpcCode(
			caller.create({ roomId: "room-1", name: "T", variantId: "missing" }),
			"NOT_FOUND"
		);
	});
});

describe("tournament.update resolves variantId (user-defined game variants)", () => {
	function updateRows(rows: Rows, variantRows: Rows = []) {
		return new Map<unknown, Rows>([
			[room, [{ id: "room-1", userId: CUR_OWNER }]],
			[tournament, rows],
			[currency, []],
			[gameVariant, variantRows],
		]);
	}

	it("resolves a string variantId and writes both variantId and variant", async () => {
		const { caller, updated } = createCallerCapturingUpdates(
			CUR_OWNER,
			updateRows(
				[{ id: "tn-1", roomId: "room-1" }],
				[{ id: "gv-1", userId: CUR_OWNER, name: "PLO8" }]
			)
		);

		await caller.update({ id: "tn-1", variantId: "gv-1" });

		expect(updated).toHaveLength(1);
		expect(updated[0]).toMatchObject({ variantId: "gv-1", variant: "PLO8" });
	});

	it("resolved variantId overrides a same-call free-text variant edit", async () => {
		const { caller, updated } = createCallerCapturingUpdates(
			CUR_OWNER,
			updateRows(
				[{ id: "tn-1", roomId: "room-1" }],
				[{ id: "gv-1", userId: CUR_OWNER, name: "PLO8" }]
			)
		);

		await caller.update({
			id: "tn-1",
			variant: "this-text-is-ignored",
			variantId: "gv-1",
		});

		expect(updated).toHaveLength(1);
		expect(updated[0]).toMatchObject({ variantId: "gv-1", variant: "PLO8" });
	});

	it("clears the link and leaves the variant text untouched when variantId is null", async () => {
		const { caller, updated } = createCallerCapturingUpdates(
			CUR_OWNER,
			updateRows([{ id: "tn-1", roomId: "room-1", variant: "PLO8" }])
		);

		await caller.update({ id: "tn-1", variantId: null });

		expect(updated).toHaveLength(1);
		expect(updated[0]).toMatchObject({ variantId: null });
		expect(updated[0]).not.toHaveProperty("variant");
	});

	it("leaves the variant link untouched when variantId is omitted", async () => {
		const { caller, updated } = createCallerCapturingUpdates(
			CUR_OWNER,
			updateRows([{ id: "tn-1", roomId: "room-1" }])
		);

		await caller.update({ id: "tn-1", name: "Renamed" });

		expect(updated).toHaveLength(1);
		expect(updated[0]).not.toHaveProperty("variantId");
		expect(updated[0]).not.toHaveProperty("variant");
	});

	it("throws NOT_FOUND when variantId does not resolve to a variant owned by the caller", async () => {
		const caller = tournamentCaller(
			CUR_OWNER,
			updateRows([{ id: "tn-1", roomId: "room-1" }])
		);
		await expectTrpcCode(
			caller.update({ id: "tn-1", variantId: "gv-1" }),
			"NOT_FOUND"
		);
	});
});

describe("tournament.createWithLevels resolves variantId (user-defined game variants)", () => {
	const ownedRoom = { id: "room-1", userId: CUR_OWNER };

	function createRows(variantRows: Rows) {
		return new Map<unknown, Rows>([
			[room, [ownedRoom]],
			[tournament, []],
			[currency, []],
			[gameVariant, variantRows],
		]);
	}

	function tournamentInsert(
		inserted: { table: string; values: Record<string, unknown> }[]
	) {
		return inserted.find((i) => i.table === "tournament")?.values;
	}

	it("writes the resolved variant name and id, overriding the free-text variant input", async () => {
		const { caller, inserted } = createCallerCapturingInserts(
			CUR_OWNER,
			createRows([{ id: "gv-1", userId: CUR_OWNER, name: "PLO5" }])
		);

		await caller.createWithLevels({
			roomId: "room-1",
			name: "T",
			variant: "this-text-is-ignored",
			variantId: "gv-1",
			blindLevels: [],
		});

		expect(tournamentInsert(inserted)).toMatchObject({
			variant: "PLO5",
			variantId: "gv-1",
		});
	});

	it("falls back to the free-text variant and a null variantId when variantId is omitted", async () => {
		const { caller, inserted } = createCallerCapturingInserts(
			CUR_OWNER,
			createRows([])
		);

		await caller.createWithLevels({
			roomId: "room-1",
			name: "T",
			variant: "PLO",
			blindLevels: [],
		});

		expect(tournamentInsert(inserted)).toMatchObject({
			variant: "PLO",
			variantId: null,
		});
	});

	it("throws NOT_FOUND when variantId does not exist", async () => {
		const caller = tournamentCaller(CUR_OWNER, createRows([]));
		await expectTrpcCode(
			caller.createWithLevels({
				roomId: "room-1",
				name: "T",
				variantId: "missing",
				blindLevels: [],
			}),
			"NOT_FOUND"
		);
	});
});

describe("tournament.updateWithLevels resolves variantId (user-defined game variants)", () => {
	function updateRows(rows: Rows, variantRows: Rows = []) {
		return new Map<unknown, Rows>([
			[room, [{ id: "room-1", userId: CUR_OWNER }]],
			[tournament, rows],
			[currency, []],
			[gameVariant, variantRows],
		]);
	}

	it("resolves a string variantId and writes both variantId and variant", async () => {
		const { caller, updated } = createCallerCapturingUpdates(
			CUR_OWNER,
			updateRows(
				[{ id: "tn-1", roomId: "room-1" }],
				[{ id: "gv-1", userId: CUR_OWNER, name: "PLO8" }]
			)
		);

		await caller.updateWithLevels({
			id: "tn-1",
			variantId: "gv-1",
			blindLevels: [],
		});

		expect(updated).toHaveLength(1);
		expect(updated[0]).toMatchObject({ variantId: "gv-1", variant: "PLO8" });
	});

	it("clears the link and leaves the variant text untouched when variantId is null", async () => {
		const { caller, updated } = createCallerCapturingUpdates(
			CUR_OWNER,
			updateRows([{ id: "tn-1", roomId: "room-1", variant: "PLO8" }])
		);

		await caller.updateWithLevels({
			id: "tn-1",
			variantId: null,
			blindLevels: [],
		});

		expect(updated).toHaveLength(1);
		expect(updated[0]).toMatchObject({ variantId: null });
		expect(updated[0]).not.toHaveProperty("variant");
	});

	it("leaves the variant link untouched when variantId is omitted", async () => {
		const { caller, updated } = createCallerCapturingUpdates(
			CUR_OWNER,
			updateRows([{ id: "tn-1", roomId: "room-1" }])
		);

		await caller.updateWithLevels({
			id: "tn-1",
			name: "Renamed",
			blindLevels: [],
		});

		expect(updated).toHaveLength(1);
		expect(updated[0]).not.toHaveProperty("variantId");
		expect(updated[0]).not.toHaveProperty("variant");
	});

	it("throws NOT_FOUND when variantId does not resolve to a variant owned by the caller", async () => {
		const caller = tournamentCaller(
			CUR_OWNER,
			updateRows([{ id: "tn-1", roomId: "room-1" }])
		);
		await expectTrpcCode(
			caller.updateWithLevels({
				id: "tn-1",
				variantId: "gv-1",
				blindLevels: [],
			}),
			"NOT_FOUND"
		);
	});
});
