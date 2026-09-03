import { currency } from "@sapphire2/db/schema/currency";
import { room } from "@sapphire2/db/schema/room";
import {
	blindLevel,
	tournament,
	tournamentChipPurchase,
} from "@sapphire2/db/schema/tournament";
import { tournamentTag } from "@sapphire2/db/schema/tournament-tag";
import { TRPCError } from "@trpc/server";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
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

const dialect = new SQLiteSyncDialect();

function createListByRoomDb(
	tournaments: Rows,
	levels: Rows,
	tags: Rows,
	chipPurchases: Rows
) {
	const childChunkSizes = new Map<unknown, number[]>();
	const rowsByTable = new Map<unknown, Rows>([
		[room, [{ id: "room-1", userId: "user-1" }]],
		[tournament, tournaments],
		[blindLevel, levels],
		[tournamentTag, tags],
		[tournamentChipPurchase, chipPurchases],
	]);

	function makeChain(table: unknown) {
		let selected = rowsByTable.get(table) ?? [];
		const chain = Promise.resolve().then(() => selected) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.where = (condition: unknown) => {
			if (
				table === blindLevel ||
				table === tournamentTag ||
				table === tournamentChipPurchase
			) {
				const params = dialect.sqlToQuery(condition as never)
					.params as string[];
				const sizes = childChunkSizes.get(table) ?? [];
				sizes.push(params.length);
				childChunkSizes.set(table, sizes);
				selected = selected.filter((row) =>
					params.includes(String(row.tournamentId))
				);
			}
			return chain;
		};
		chain.orderBy = () => chain;
		return chain;
	}

	return {
		childChunkSizes,
		db: {
			select: () => ({ from: (table: unknown) => makeChain(table) }),
		},
	};
}

const CUR_OWNER = "user-1";
const CUR_OTHER = "user-2";

describe("tournament router", () => {
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

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.tournament, {
			addTag: "mutation",
			archive: "mutation",
			create: "mutation",
			createWithLevels: "mutation",
			delete: "mutation",
			getById: "query",
			listByRoom: "query",
			removeTag: "mutation",
			restore: "mutation",
			update: "mutation",
			updateWithLevels: "mutation",
		});
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
		expect(parsed.data.variant).toBe("NL Hold'em");
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.tournament.create, {
			roomId: "s1",
			name: "",
		});
	});
});

describe("tournament.update input validation", () => {
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
});

describe("tournament.createWithLevels input validation", () => {
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

	it.each([
		[
			"createWithLevels",
			appRouter.tournament.createWithLevels,
			{ roomId: "s1", name: "Series" },
		],
		[
			"updateWithLevels",
			appRouter.tournament.updateWithLevels,
			{ id: "tn1", blindLevels: [] },
		],
	] as const)("rejects a chip purchase with an empty name on %s", (_name, procedure, base) => {
		expectRejects(procedure, {
			...base,
			chipPurchases: [{ name: "", cost: 100, chips: 10_000 }],
		});
	});
});

describe("tournament.addTag input validation", () => {
	it("rejects empty name", () => {
		expectRejects(appRouter.tournament.addTag, {
			tournamentId: "tn1",
			name: "",
		});
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
		).resolves.toEqual(ownedTournament);
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
		).resolves.toEqual(ownedTournament);
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
		).resolves.toEqual(ownedTournament);
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
		).resolves.toEqual(ownedTournament);
	});
});

describe("tournament createWithLevels per-level games", () => {
	it("accepts blind levels carrying game groups", () => {
		expectAccepts(appRouter.tournament.createWithLevels, {
			roomId: "room-1",
			name: "HORSE Nightly",
			variant: "mix",
			blindLevels: [
				{
					isBreak: false,
					blind1: 100,
					blind2: 200,
					minutes: 20,
					games: [
						{ name: "Flop", variants: ["lhe", "o8"], blind1: 300, blind2: 600 },
						{ name: "Stud", variants: ["razz"], blind1: 300, blind2: 600 },
					],
				},
			],
		});
	});

	it("updateWithLevels rejects more than 12 groups on one level", () => {
		expectRejects(appRouter.tournament.updateWithLevels, {
			id: "t-1",
			blindLevels: [
				{
					isBreak: false,
					games: Array.from({ length: 13 }, (_, i) => ({
						variants: [`v${i}`],
					})),
				},
			],
		});
	});
});

describe("tournament listByRoom hydration", () => {
	it("hydrates all child collections with bounded batched lookups", async () => {
		const tournaments = Array.from({ length: 101 }, (_, index) => ({
			id: `t-${index}`,
			roomId: "room-1",
			name: `Tournament ${index}`,
		}));
		const levels = tournaments.map((t) => ({
			tournamentId: t.id,
			id: `level-${t.id}`,
		}));
		const tags = tournaments.map((t) => ({
			tournamentId: t.id,
			id: `tag-${t.id}`,
			name: "weekly",
		}));
		const chipPurchases = tournaments.map((t) => ({
			tournamentId: t.id,
			id: `chip-${t.id}`,
			name: "Rebuy",
			cost: 100,
			chips: 10_000,
			sortOrder: 0,
		}));
		const { db, childChunkSizes } = createListByRoomDb(
			tournaments,
			levels,
			tags,
			chipPurchases
		);
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).tournament;

		const result = await caller.listByRoom({ roomId: "room-1" });

		expect(result).toHaveLength(101);
		expect(result[0]).toMatchObject({
			id: "t-0",
			blindLevelCount: 1,
			tags: [{ id: "tag-t-0", name: "weekly" }],
			chipPurchases: [
				{
					id: "chip-t-0",
					name: "Rebuy",
					cost: 100,
					chips: 10_000,
					sortOrder: 0,
				},
			],
		});
		expect(result.at(100)?.blindLevelCount).toBe(1);
		expect(childChunkSizes.get(blindLevel)).toEqual([100, 1]);
		expect(childChunkSizes.get(tournamentTag)).toEqual([100, 1]);
		expect(childChunkSizes.get(tournamentChipPurchase)).toEqual([100, 1]);
	});

	it("returns an empty result without issuing child lookups for no tournaments", async () => {
		const { db, childChunkSizes } = createListByRoomDb([], [], [], []);
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).tournament;

		expect(await caller.listByRoom({ roomId: "room-1" })).toEqual([]);
		expect(childChunkSizes.size).toBe(0);
	});
});

describe("tournament ownership errors", () => {
	it("uses FORBIDDEN for missing room and tournament resources", async () => {
		await expectTrpcCode(
			tournamentCaller(CUR_OWNER, new Map()).listByRoom({ roomId: "missing" }),
			"FORBIDDEN"
		);
		await expectTrpcCode(
			tournamentCaller(CUR_OWNER, new Map()).getById({ id: "missing" }),
			"FORBIDDEN"
		);
	});

	it("uses FORBIDDEN for foreign room and tournament resources", async () => {
		await expectTrpcCode(
			tournamentCaller(
				CUR_OWNER,
				new Map<unknown, Rows>([[room, [{ id: "room-1", userId: CUR_OTHER }]]])
			).listByRoom({ roomId: "room-1" }),
			"FORBIDDEN"
		);
		await expectTrpcCode(
			tournamentCaller(
				CUR_OWNER,
				new Map<unknown, Rows>([
					[tournament, [{ id: "t-1", roomId: "room-1" }]],
					[room, [{ id: "room-1", userId: CUR_OTHER }]],
				])
			).getById({ id: "t-1" }),
			"FORBIDDEN"
		);
	});

	it("uses FORBIDDEN for missing and foreign tags", async () => {
		await expectTrpcCode(
			tournamentCaller(CUR_OWNER, new Map()).removeTag({ id: "missing" }),
			"FORBIDDEN"
		);
		await expectTrpcCode(
			tournamentCaller(
				CUR_OWNER,
				new Map<unknown, Rows>([
					[tournamentTag, [{ id: "tag-1", tournamentId: "t-1" }]],
					[tournament, [{ id: "t-1", roomId: "room-1" }]],
					[room, [{ id: "room-1", userId: CUR_OTHER }]],
				])
			).removeTag({ id: "tag-1" }),
			"FORBIDDEN"
		);
	});
});

describe("tournament numeric boundaries", () => {
	const schemas = [
		[appRouter.tournament.create, { roomId: "s1", name: "ME" }],
		[
			appRouter.tournament.createWithLevels,
			{ roomId: "s1", name: "ME", blindLevels: [] },
		],
		[appRouter.tournament.update, { id: "tn1" }],
		[appRouter.tournament.updateWithLevels, { id: "tn1", blindLevels: [] }],
	] as const;
	const levelSchemas = [
		[
			appRouter.tournament.createWithLevels,
			{ roomId: "s1", name: "ME", blindLevels: [] },
		],
		[appRouter.tournament.updateWithLevels, { id: "tn1", blindLevels: [] }],
	] as const;

	it.each([
		"buyIn",
		"entryFee",
		"startingStack",
		"bountyAmount",
	] as const)("%s rejects negative and fractional values and accepts zero across create and update schemas", (field) => {
		for (const [procedure, base] of schemas) {
			expectRejects(procedure, { ...base, [field]: -1 });
			expectRejects(procedure, { ...base, [field]: 100.5 });
			expectAccepts(procedure, { ...base, [field]: 0 });
		}
	});

	it("restricts tableSize to 2..10 across create and update schemas", () => {
		for (const [procedure, base] of schemas) {
			for (const tableSize of [-1, 0, 1, 11, 9.5]) {
				expectRejects(procedure, { ...base, tableSize });
			}
			expectAccepts(procedure, { ...base, tableSize: 2 });
			expectAccepts(procedure, { ...base, tableSize: 10 });
		}
	});

	it.each([
		"cost",
		"chips",
	] as const)("chip purchase %s rejects negative and fractional values and accepts zero on createWithLevels and updateWithLevels", (field) => {
		for (const [procedure, base] of levelSchemas) {
			for (const value of [-1, 100.5]) {
				expectRejects(procedure, {
					...base,
					chipPurchases: [
						{ name: "Rebuy", cost: 100, chips: 10_000, [field]: value },
					],
				});
			}
			expectAccepts(procedure, {
				...base,
				chipPurchases: [
					{ name: "Rebuy", cost: 100, chips: 10_000, [field]: 0 },
				],
			});
		}
	});
});
