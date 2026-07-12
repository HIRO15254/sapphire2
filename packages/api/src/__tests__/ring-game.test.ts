import { currency } from "@sapphire2/db/schema/currency";
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
	it("accepts minimal valid payload (roomId + name), variant defaults to 'NL Hold'em'", () => {
		const schema = getInputSchema(appRouter.ringGame.create);
		const parsed = schema.safeParse({
			roomId: "s1",
			name: "1/2 NLH",
		}) as unknown as { success: true; data: { variant: string } };
		expect(parsed.success).toBe(true);
		expect(parsed.data.variant).toBe("NL Hold'em");
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

describe("ringGame mixGames input", () => {
	const validMix = [
		{ name: "Limit", variants: ["lhe", "o8"], blind1: 400, blind2: 800 },
		{ name: "Big Bet", variants: ["nlh", "plo"], blind1: 100, blind2: 200 },
	];

	it("create accepts a mix definition with named game groups", () => {
		expectAccepts(appRouter.ringGame.create, {
			roomId: "room-1",
			name: "8-Game",
			variant: "mix",
			mixGames: validMix,
		});
	});

	it("create rejects a mix whose only group holds a single game", () => {
		expectRejects(appRouter.ringGame.create, {
			roomId: "room-1",
			name: "Solo",
			variant: "mix",
			mixGames: [{ variants: ["nlh"] }],
		});
	});

	it("create rejects the same game appearing in two groups", () => {
		expectRejects(appRouter.ringGame.create, {
			roomId: "room-1",
			name: "Dup",
			variant: "mix",
			mixGames: [{ variants: ["nlh", "plo"] }, { variants: ["plo"] }],
		});
	});

	it("create rejects more than 12 groups", () => {
		expectRejects(appRouter.ringGame.create, {
			roomId: "room-1",
			name: "Too many",
			variant: "mix",
			mixGames: Array.from({ length: 13 }, (_, i) => ({
				variants: [`v${i}`],
			})),
		});
	});

	it("update accepts an explicit null to clear the mix definition", () => {
		expectAccepts(appRouter.ringGame.update, { id: "rg-1", mixGames: null });
	});

	it("update accepts omitted mixGames (leave unchanged)", () => {
		expectAccepts(appRouter.ringGame.update, { id: "rg-1", name: "Renamed" });
	});
});
