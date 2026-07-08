import { currency } from "@sapphire2/db/schema/currency";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { TRPCError } from "@trpc/server";
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
	};
}

function ringGameCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	return appRouter.createCaller({
		session: { user: { id: userId } },
		db: createMockDb(rowsByTable),
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;
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

describe("ringGame router", () => {
	it("appRouter has ringGame namespace", () => {
		expect(appRouter.ringGame).toBeDefined();
	});

	it("has listByRoom procedure", () => {
		expect(appRouter.ringGame.listByRoom).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.ringGame.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.ringGame.update).toBeDefined();
	});

	it("has archive procedure", () => {
		expect(appRouter.ringGame.archive).toBeDefined();
	});

	it("has restore procedure", () => {
		expect(appRouter.ringGame.restore).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.ringGame.delete).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.ringGame).sort()).toEqual(
			["archive", "create", "delete", "listByRoom", "restore", "update"].sort()
		);
	});

	it("listByRoom is a protected query", () => {
		expectProtected(appRouter.ringGame.listByRoom);
		expectType(appRouter.ringGame.listByRoom, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of [
			"create",
			"update",
			"archive",
			"restore",
			"delete",
		] as const) {
			const proc = appRouter.ringGame[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("ringGame.listByRoom input validation", () => {
	it("accepts roomId only", () => {
		expectAccepts(appRouter.ringGame.listByRoom, { roomId: "s1" });
	});

	it("accepts includeArchived: true/false", () => {
		expectAccepts(appRouter.ringGame.listByRoom, {
			roomId: "s1",
			includeArchived: true,
		});
		expectAccepts(appRouter.ringGame.listByRoom, {
			roomId: "s1",
			includeArchived: false,
		});
	});

	it("rejects missing roomId", () => {
		expectRejects(appRouter.ringGame.listByRoom, {});
	});

	it("rejects non-boolean includeArchived", () => {
		expectRejects(appRouter.ringGame.listByRoom, {
			roomId: "s1",
			includeArchived: "yes",
		});
	});
});

describe("ringGame.create input validation", () => {
	it("accepts minimal valid payload (roomId + name), variant defaults to NLH", () => {
		const schema = getInputSchema(appRouter.ringGame.create);
		const parsed = schema.safeParse({
			roomId: "s1",
			name: "1/2 NLH",
		}) as unknown as { success: true; data: { variant: string } };
		expect(parsed.success).toBe(true);
		expect(parsed.data.variant).toBe("NLH");
	});

	it("accepts all anteType values", () => {
		for (const anteType of ["none", "all", "bb"] as const) {
			expectAccepts(appRouter.ringGame.create, {
				roomId: "s1",
				name: "game",
				anteType,
			});
		}
	});

	it("rejects unknown anteType", () => {
		expectRejects(appRouter.ringGame.create, {
			roomId: "s1",
			name: "game",
			anteType: "double",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.ringGame.create, { roomId: "s1", name: "" });
	});

	it("rejects non-integer blind1", () => {
		expectRejects(appRouter.ringGame.create, {
			roomId: "s1",
			name: "g",
			blind1: 1.5,
		});
	});

	it("accepts a variantId string", () => {
		expectAccepts(appRouter.ringGame.create, {
			roomId: "s1",
			name: "game",
			variantId: "gv-1",
		});
	});

	it("accepts a payload without variantId (variantId stays optional)", () => {
		const schema = getInputSchema(appRouter.ringGame.create);
		const parsed = schema.safeParse({
			roomId: "s1",
			name: "game",
		}) as unknown as { success: true; data: { variantId?: string } };
		expect(parsed.success).toBe(true);
		expect(parsed.data.variantId).toBeUndefined();
	});

	it("rejects a non-string variantId", () => {
		expectRejects(appRouter.ringGame.create, {
			roomId: "s1",
			name: "game",
			variantId: 123,
		});
	});
});

describe("ringGame.update input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.ringGame.update, { id: "rg1" });
	});

	it("accepts nullable fields set to null", () => {
		expectAccepts(appRouter.ringGame.update, {
			id: "rg1",
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			anteType: null,
			minBuyIn: null,
			maxBuyIn: null,
			tableSize: null,
			currencyId: null,
			memo: null,
		});
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.ringGame.update, { id: "rg1", name: "" });
	});

	it("rejects unknown anteType", () => {
		expectRejects(appRouter.ringGame.update, {
			id: "rg1",
			anteType: "straddle",
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.ringGame.update, { name: "x" });
	});

	it("accepts a variantId string", () => {
		expectAccepts(appRouter.ringGame.update, { id: "rg1", variantId: "gv-1" });
	});

	it("accepts variantId: null", () => {
		expectAccepts(appRouter.ringGame.update, { id: "rg1", variantId: null });
	});

	it("accepts a payload without variantId (untouched)", () => {
		const schema = getInputSchema(appRouter.ringGame.update);
		const parsed = schema.safeParse({ id: "rg1" }) as unknown as {
			success: true;
			data: { variantId?: string | null };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.variantId).toBeUndefined();
	});

	it("rejects a non-string, non-null variantId", () => {
		expectRejects(appRouter.ringGame.update, { id: "rg1", variantId: 123 });
	});
});

describe("ringGame.{archive,restore,delete} input validation", () => {
	it("archive accepts {id}", () => {
		expectAccepts(appRouter.ringGame.archive, { id: "rg1" });
	});

	it("restore accepts {id}", () => {
		expectAccepts(appRouter.ringGame.restore, { id: "rg1" });
	});

	it("delete accepts {id}", () => {
		expectAccepts(appRouter.ringGame.delete, { id: "rg1" });
	});

	it("archive / restore / delete reject missing id", () => {
		expectRejects(appRouter.ringGame.archive, {});
		expectRejects(appRouter.ringGame.restore, {});
		expectRejects(appRouter.ringGame.delete, {});
	});
});

describe("ringGame currency ownership (SA2-180)", () => {
	const ownedRoom = { id: "room-1", userId: CUR_OWNER };
	const ownedRingGame = { id: "rg-1", roomId: "room-1", userId: CUR_OWNER };

	function createRows(currencyRows: Rows) {
		return new Map<unknown, Rows>([
			[room, [ownedRoom]],
			[ringGame, [ownedRingGame]],
			[currency, currencyRows],
		]);
	}

	it("create accepts a currency owned by the caller", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OWNER }])
		);
		await expect(
			caller.create({ roomId: "room-1", name: "RG", currencyId: "cur-1" })
		).resolves.toBeDefined();
	});

	it("create rejects a currency owned by another user with FORBIDDEN", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OTHER }])
		);
		await expectTrpcCode(
			caller.create({ roomId: "room-1", name: "RG", currencyId: "cur-1" }),
			"FORBIDDEN"
		);
	});

	it("create skips currency validation when currencyId is omitted", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OTHER }])
		);
		await expect(
			caller.create({ roomId: "room-1", name: "RG" })
		).resolves.toBeDefined();
	});

	it("update rejects a foreign currency with FORBIDDEN", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OTHER }])
		);
		await expectTrpcCode(
			caller.update({ id: "rg-1", currencyId: "cur-1" }),
			"FORBIDDEN"
		);
	});

	it("update accepts a currency owned by the caller", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OWNER }])
		);
		await expect(
			caller.update({ id: "rg-1", currencyId: "cur-1" })
		).resolves.toBeDefined();
	});

	it("update allows clearing the currency with null", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OTHER }])
		);
		await expect(
			caller.update({ id: "rg-1", currencyId: null })
		).resolves.toBeDefined();
	});
});

describe("ringGame.create sets userId to the caller (SA2-181)", () => {
	it("stamps the created ring game with the caller's userId", async () => {
		const rowsByTable = new Map<unknown, Rows>([
			[room, [{ id: "room-1", userId: CUR_OWNER }]],
			[ringGame, []],
			[currency, []],
		]);
		const inserted: Record<string, unknown>[] = [];
		const baseDb = createMockDb(rowsByTable);
		const db = {
			...baseDb,
			insert: () => ({
				values: (v: Record<string, unknown>) => {
					inserted.push(v);
					return Promise.resolve(undefined);
				},
			}),
		};
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;

		await caller.create({ roomId: "room-1", name: "RG" });

		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({ userId: CUR_OWNER, roomId: "room-1" });
	});
});

describe("ringGame.create resolves variantId (user-defined game variants)", () => {
	const ownedRoom = { id: "room-1", userId: CUR_OWNER };

	function createCallerCapturingInserts(rowsByTable: Map<unknown, Rows>) {
		const inserted: Record<string, unknown>[] = [];
		const baseDb = createMockDb(rowsByTable);
		const db = {
			...baseDb,
			insert: () => ({
				values: (v: Record<string, unknown>) => {
					inserted.push(v);
					return Promise.resolve(undefined);
				},
			}),
		};
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;
		return { caller, inserted };
	}

	it("writes the resolved variant name and id, overriding the free-text variant input", async () => {
		const rowsByTable = new Map<unknown, Rows>([
			[room, [ownedRoom]],
			[ringGame, []],
			[currency, []],
			[gameVariant, [{ id: "gv-1", userId: CUR_OWNER, name: "PLO5" }]],
		]);
		const { caller, inserted } = createCallerCapturingInserts(rowsByTable);

		await caller.create({
			roomId: "room-1",
			name: "RG",
			variant: "this-text-is-ignored",
			variantId: "gv-1",
		});

		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({ variant: "PLO5", variantId: "gv-1" });
	});

	it("falls back to the free-text variant and a null variantId when variantId is omitted", async () => {
		const rowsByTable = new Map<unknown, Rows>([
			[room, [ownedRoom]],
			[ringGame, []],
			[currency, []],
			[gameVariant, []],
		]);
		const { caller, inserted } = createCallerCapturingInserts(rowsByTable);

		await caller.create({ roomId: "room-1", name: "RG", variant: "PLO" });

		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({ variant: "PLO", variantId: null });
	});

	it("treats an empty-string variantId as omitted (falls back to free text, no lookup)", async () => {
		const rowsByTable = new Map<unknown, Rows>([
			[room, [ownedRoom]],
			[ringGame, []],
			[currency, []],
			[gameVariant, []],
		]);
		const { caller, inserted } = createCallerCapturingInserts(rowsByTable);

		await caller.create({
			roomId: "room-1",
			name: "RG",
			variant: "PLO",
			variantId: "",
		});

		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({ variant: "PLO", variantId: null });
	});

	// The router scopes the lookup to `and(eq(id), eq(userId))`, so a real D1
	// query filters out a foreign owner's row the same way it filters out a
	// truly missing id — both come back as "no row" and surface as NOT_FOUND.
	// This lightweight mock returns whatever rows are configured for the table
	// regardless of the WHERE clause, so an empty `gameVariant` config is how
	// both scenarios are represented here.
	it("throws NOT_FOUND when variantId does not exist", async () => {
		const rowsByTable = new Map<unknown, Rows>([
			[room, [ownedRoom]],
			[ringGame, []],
			[currency, []],
			[gameVariant, []],
		]);
		const caller = ringGameCaller(CUR_OWNER, rowsByTable);
		await expectTrpcCode(
			caller.create({ roomId: "room-1", name: "RG", variantId: "missing" }),
			"NOT_FOUND"
		);
	});
});

describe("ringGame.update resolves variantId (user-defined game variants)", () => {
	function updateRows(rg: Rows, variants: Rows = []) {
		return new Map<unknown, Rows>([
			[room, []],
			[ringGame, rg],
			[currency, []],
			[gameVariant, variants],
		]);
	}

	function createCallerCapturingUpdates(rowsByTable: Map<unknown, Rows>) {
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
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;
		return { caller, updated };
	}

	it("resolves a string variantId and writes both variantId and variant", async () => {
		const rowsByTable = updateRows(
			[{ id: "rg-1", roomId: null, userId: CUR_OWNER }],
			[{ id: "gv-1", userId: CUR_OWNER, name: "PLO8" }]
		);
		const { caller, updated } = createCallerCapturingUpdates(rowsByTable);

		await caller.update({ id: "rg-1", variantId: "gv-1" });

		expect(updated).toHaveLength(1);
		expect(updated[0]).toMatchObject({ variantId: "gv-1", variant: "PLO8" });
	});

	it("resolved variantId overrides a same-call free-text variant edit", async () => {
		const rowsByTable = updateRows(
			[{ id: "rg-1", roomId: null, userId: CUR_OWNER }],
			[{ id: "gv-1", userId: CUR_OWNER, name: "PLO8" }]
		);
		const { caller, updated } = createCallerCapturingUpdates(rowsByTable);

		await caller.update({
			id: "rg-1",
			variant: "this-text-is-ignored",
			variantId: "gv-1",
		});

		expect(updated).toHaveLength(1);
		expect(updated[0]).toMatchObject({ variantId: "gv-1", variant: "PLO8" });
	});

	it("clears the link and leaves the variant text untouched when variantId is null", async () => {
		const rowsByTable = updateRows([
			{ id: "rg-1", roomId: null, userId: CUR_OWNER, variant: "PLO8" },
		]);
		const { caller, updated } = createCallerCapturingUpdates(rowsByTable);

		await caller.update({ id: "rg-1", variantId: null });

		expect(updated).toHaveLength(1);
		expect(updated[0]).toMatchObject({ variantId: null });
		expect(updated[0]).not.toHaveProperty("variant");
	});

	it("leaves the variant link untouched when variantId is omitted", async () => {
		const rowsByTable = updateRows([
			{ id: "rg-1", roomId: null, userId: CUR_OWNER },
		]);
		const { caller, updated } = createCallerCapturingUpdates(rowsByTable);

		await caller.update({ id: "rg-1", name: "Renamed" });

		expect(updated).toHaveLength(1);
		expect(updated[0]).not.toHaveProperty("variantId");
		expect(updated[0]).not.toHaveProperty("variant");
	});

	// See the equivalent comment in the create describe block: this mock can't
	// enforce the router's `and(eq(id), eq(userId))` WHERE, so a foreign-owned
	// id is represented the same way a truly missing id is — an empty
	// `gameVariant` config — matching what a real filtered D1 query returns.
	it("throws NOT_FOUND when variantId does not resolve to a variant owned by the caller", async () => {
		const rowsByTable = updateRows([
			{ id: "rg-1", roomId: null, userId: CUR_OWNER },
		]);
		const caller = ringGameCaller(CUR_OWNER, rowsByTable);
		await expectTrpcCode(
			caller.update({ id: "rg-1", variantId: "gv-1" }),
			"NOT_FOUND"
		);
	});

	it("throws NOT_FOUND for an empty-string variantId (treated as a real lookup, unlike create)", async () => {
		const rowsByTable = updateRows([
			{ id: "rg-1", roomId: null, userId: CUR_OWNER },
		]);
		const caller = ringGameCaller(CUR_OWNER, rowsByTable);
		await expectTrpcCode(
			caller.update({ id: "rg-1", variantId: "" }),
			"NOT_FOUND"
		);
	});
});

describe("validateRingGameOwnership via mutations (SA2-181)", () => {
	function ringGameRows(rg: Rows) {
		return new Map<unknown, Rows>([
			[room, []],
			[ringGame, rg],
			[currency, []],
		]);
	}

	for (const op of ["update", "archive", "restore", "delete"] as const) {
		it(`${op} resolves for a ring game owned by the caller (userId match)`, async () => {
			const caller = ringGameCaller(
				CUR_OWNER,
				ringGameRows([{ id: "rg-1", roomId: null, userId: CUR_OWNER }])
			);
			await expect(caller[op]({ id: "rg-1" })).resolves.toBeDefined();
		});

		it(`${op} throws FORBIDDEN for a ring game owned by another user`, async () => {
			const caller = ringGameCaller(
				CUR_OWNER,
				ringGameRows([{ id: "rg-1", roomId: "room-1", userId: CUR_OTHER }])
			);
			await expectTrpcCode(caller[op]({ id: "rg-1" }), "FORBIDDEN");
		});

		it(`${op} throws FORBIDDEN for a legacy row with null userId`, async () => {
			const caller = ringGameCaller(
				CUR_OWNER,
				ringGameRows([{ id: "rg-1", roomId: null, userId: null }])
			);
			await expectTrpcCode(caller[op]({ id: "rg-1" }), "FORBIDDEN");
		});

		it(`${op} throws NOT_FOUND when the ring game does not exist`, async () => {
			const caller = ringGameCaller(CUR_OWNER, ringGameRows([]));
			await expectTrpcCode(caller[op]({ id: "missing" }), "NOT_FOUND");
		});
	}
});
