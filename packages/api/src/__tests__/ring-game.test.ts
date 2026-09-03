import { currency } from "@sapphire2/db/schema/currency";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
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

function withNormalizedMixMemberships(
	rowsByTable: Map<unknown, Rows>
): Map<unknown, Rows> {
	if (rowsByTable.has(gameMixVariant)) {
		return rowsByTable;
	}
	const memberships = (rowsByTable.get(gameMix) ?? []).flatMap((mix) => {
		const games = Array.isArray(mix.games) ? mix.games : [];
		return games.map((variantId, position) => ({
			mixId: mix.id,
			position,
			userId: mix.userId,
			variantId,
		}));
	});
	return new Map([...rowsByTable, [gameMixVariant, memberships]]);
}

function createMockDb(rowsByTable: Map<unknown, Rows>) {
	const normalizedRowsByTable = withNormalizedMixMemberships(rowsByTable);
	const makeChain = (rows: Rows) => {
		const chain = Promise.resolve(rows) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.from = (table: unknown) =>
			makeChain(normalizedRowsByTable.get(table) ?? []);
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

const dialect = new SQLiteSyncDialect();

function createListByRoomFilterDb(
	ownedRoom: Record<string, unknown>,
	games: Rows
) {
	return {
		select: () => ({
			from: (table: unknown) => {
				if (table === room) {
					return { where: () => Promise.resolve([ownedRoom]) };
				}
				return {
					where: (cond: unknown) => {
						const { sql } = dialect.sqlToQuery(cond as never);
						const archivedOnly = sql.includes("is not null");
						return Promise.resolve(
							games.filter((g) =>
								archivedOnly ? g.archivedAt !== null : g.archivedAt === null
							)
						);
					},
				};
			},
		}),
		insert: () => ({ values: () => Promise.resolve(undefined) }),
		update: () => ({
			set: () => ({ where: () => Promise.resolve(undefined) }),
		}),
		delete: () => ({ where: () => Promise.resolve(undefined) }),
	};
}

describe("ringGame router", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.ringGame).sort()).toEqual(
			["archive", "create", "delete", "listByRoom", "restore", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.ringGame, {
			archive: "mutation",
			create: "mutation",
			delete: "mutation",
			listByRoom: "query",
			restore: "mutation",
			update: "mutation",
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

	it.each([
		"none",
		"all",
		"bb",
	] as const)("create accepts anteType %s", (anteType) => {
		expectAccepts(appRouter.ringGame.create, {
			roomId: "s1",
			name: "game",
			anteType,
		});
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

	it.each([
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"minBuyIn",
		"maxBuyIn",
	] as const)("rejects negative and fractional %s and accepts zero", (field) => {
		expectRejects(appRouter.ringGame.create, {
			roomId: "s1",
			name: "g",
			[field]: -1,
		});
		expectRejects(appRouter.ringGame.create, {
			roomId: "s1",
			name: "g",
			[field]: 1.5,
		});
		expectAccepts(appRouter.ringGame.create, {
			roomId: "s1",
			name: "g",
			[field]: 0,
		});
	});

	it("restricts tableSize to the supported 2..10 player range", () => {
		expectRejects(appRouter.ringGame.create, {
			roomId: "s1",
			name: "g",
			tableSize: 1,
		});
		expectAccepts(appRouter.ringGame.create, {
			roomId: "s1",
			name: "g",
			tableSize: 2,
		});
		expectAccepts(appRouter.ringGame.create, {
			roomId: "s1",
			name: "g",
			tableSize: 10,
		});
		expectRejects(appRouter.ringGame.create, {
			roomId: "s1",
			name: "g",
			tableSize: 11,
		});
	});
});

describe("ringGame.update input validation", () => {
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

	it.each([
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"minBuyIn",
		"maxBuyIn",
	] as const)("rejects negative and fractional %s and accepts zero", (field) => {
		expectRejects(appRouter.ringGame.update, {
			id: "rg1",
			[field]: -1,
		});
		expectRejects(appRouter.ringGame.update, {
			id: "rg1",
			[field]: 1.5,
		});
		expectAccepts(appRouter.ringGame.update, {
			id: "rg1",
			[field]: 0,
		});
	});

	it("restricts tableSize to 2..10 while preserving null clearing", () => {
		expectRejects(appRouter.ringGame.update, { id: "rg1", tableSize: 1 });
		expectAccepts(appRouter.ringGame.update, { id: "rg1", tableSize: 2 });
		expectAccepts(appRouter.ringGame.update, {
			id: "rg1",
			tableSize: 10,
		});
		expectRejects(appRouter.ringGame.update, {
			id: "rg1",
			tableSize: 11,
		});
		expectAccepts(appRouter.ringGame.update, {
			id: "rg1",
			tableSize: null,
		});
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

	it("returns the same FORBIDDEN code for missing and foreign rooms", async () => {
		const missingRoomCaller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, []],
				[ringGame, []],
				[currency, []],
			])
		);
		const foreignRoomCaller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OTHER }]],
				[ringGame, []],
				[currency, []],
			])
		);

		await expectTrpcCode(
			missingRoomCaller.create({ roomId: "room-1", name: "RG" }),
			"FORBIDDEN"
		);
		await expectTrpcCode(
			foreignRoomCaller.create({ roomId: "room-1", name: "RG" }),
			"FORBIDDEN"
		);
	});
	it("create accepts a currency owned by the caller", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OWNER }])
		);
		await expect(
			caller.create({ roomId: "room-1", name: "RG", currencyId: "cur-1" })
		).resolves.toEqual(ownedRingGame);
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
		).resolves.toEqual(ownedRingGame);
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
		).resolves.toEqual(ownedRingGame);
	});

	it("update allows clearing the currency with null", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			createRows([{ id: "cur-1", userId: CUR_OTHER }])
		);
		await expect(
			caller.update({ id: "rg-1", currencyId: null })
		).resolves.toEqual(ownedRingGame);
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
			const owned = { id: "rg-1", roomId: null, userId: CUR_OWNER };
			const caller = ringGameCaller(CUR_OWNER, ringGameRows([owned]));
			await expect(caller[op]({ id: "rg-1" })).resolves.toEqual(
				op === "delete" ? { success: true } : owned
			);
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

		it(`${op} throws FORBIDDEN when the ring game does not exist`, async () => {
			const caller = ringGameCaller(CUR_OWNER, ringGameRows([]));
			await expectTrpcCode(caller[op]({ id: "missing" }), "FORBIDDEN");
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
});

describe("ringGame variant / mixGames persistence invariant", () => {
	const validMix = [
		{ name: "Big Bet", variants: ["NL Hold'em", "Pot Limit Omaha"] },
	];
	const canonicalGroups = [
		{
			id: "group-limit",
			userId: CUR_OWNER,
			builtinKey: "limit",
			label: "Limit",
		},
		{
			id: "group-stud",
			userId: CUR_OWNER,
			builtinKey: "stud",
			label: "Stud",
		},
		{
			id: "group-bigbet",
			userId: CUR_OWNER,
			builtinKey: "bigbet",
			label: "Big Bet",
		},
	];
	const groupedVariants = [
		{
			id: "variant-nlh",
			userId: CUR_OWNER,
			label: "NL Hold'em",
			groupId: "group-bigbet",
		},
		{
			id: "variant-lhe",
			userId: CUR_OWNER,
			label: "Limit Hold'em",
			groupId: "group-limit",
		},
		{
			id: "variant-plo",
			userId: CUR_OWNER,
			label: "Pot Limit Omaha",
			groupId: "group-bigbet",
		},
		{
			id: "variant-razz",
			userId: CUR_OWNER,
			label: "Razz",
			groupId: "group-stud",
		},
	];
	const groupedMixMaster = {
		id: "mix-grouped",
		userId: CUR_OWNER,
		label: "Grouped Mix",
		games: ["variant-nlh", "variant-lhe", "variant-plo", "variant-razz"],
	};
	const canonicalGroupedMix = [
		{ name: "Limit", variants: ["Limit Hold'em"] },
		{ name: "Stud", variants: ["Razz"] },
		{
			name: "Big Bet",
			variants: ["NL Hold'em", "Pot Limit Omaha"],
		},
	] satisfies [
		{ name: string; variants: string[] },
		{ name: string; variants: string[] },
		{ name: string; variants: string[] },
	];

	it("create rejects mixGames for a plain variant", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
				[gameMix, []],
			])
		);

		await expectTrpcCode(
			caller.create({
				roomId: "room-1",
				name: "Contradictory",
				variant: "NL Hold'em",
				mixGames: validMix,
			}),
			"BAD_REQUEST"
		);
	});

	it("create rejects a mixed variant without a mixGames definition", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
			])
		);

		await expectTrpcCode(
			caller.create({
				roomId: "room-1",
				name: "Missing definition",
				variant: "mix",
			}),
			"BAD_REQUEST"
		);
	});

	it("create accepts mixGames for a named mix owned by the caller", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
				[
					gameMix,
					[
						{
							id: "mix-1",
							userId: CUR_OWNER,
							label: "8-Game",
							games: ["variant-1", "variant-2"],
						},
					],
				],
				[
					gameVariant,
					[
						{
							id: "variant-1",
							userId: CUR_OWNER,
							label: "NL Hold'em",
							groupId: "group-bigbet",
						},
						{
							id: "variant-2",
							userId: CUR_OWNER,
							label: "Pot Limit Omaha",
							groupId: "group-bigbet",
						},
					],
				],
				[
					gameGroup,
					[
						{
							id: "group-bigbet",
							userId: CUR_OWNER,
							builtinKey: "bigbet",
							label: "Big Bet",
						},
					],
				],
			])
		);

		await expect(
			caller.create({
				roomId: "room-1",
				name: "8-Game",
				variant: "8-Game",
				mixGames: validMix,
			})
		).resolves.toBeUndefined();
	});

	it("create accepts named-mix buckets in canonical group order while preserving master order within each group", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
				[gameMix, [groupedMixMaster]],
				[gameVariant, groupedVariants],
				[gameGroup, canonicalGroups],
			])
		);

		await expect(
			caller.create({
				roomId: "room-1",
				name: "Grouped Mix",
				variant: "Grouped Mix",
				mixGames: canonicalGroupedMix,
			})
		).resolves.toBeUndefined();
	});

	it("create rejects a named-mix payload that merges variants from different master groups", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
				[gameMix, [groupedMixMaster]],
				[gameVariant, groupedVariants],
				[gameGroup, canonicalGroups],
			])
		);

		await expectTrpcCode(
			caller.create({
				roomId: "room-1",
				name: "Merged groups",
				variant: "Grouped Mix",
				mixGames: [
					{ variants: ["Limit Hold'em", "Razz"] },
					{ variants: ["NL Hold'em", "Pot Limit Omaha"] },
				],
			}),
			"BAD_REQUEST"
		);
	});

	it("create rejects a named-mix payload that splits one master group into multiple buckets", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
				[gameMix, [groupedMixMaster]],
				[gameVariant, groupedVariants],
				[gameGroup, canonicalGroups],
			])
		);

		await expectTrpcCode(
			caller.create({
				roomId: "room-1",
				name: "Split group",
				variant: "Grouped Mix",
				mixGames: [
					{ variants: ["Limit Hold'em"] },
					{ variants: ["Razz"] },
					{ variants: ["NL Hold'em"] },
					{ variants: ["Pot Limit Omaha"] },
				],
			}),
			"BAD_REQUEST"
		);
	});

	it("create rejects a named-mix payload that reorders variants within a group", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
				[gameMix, [groupedMixMaster]],
				[gameVariant, groupedVariants],
				[gameGroup, canonicalGroups],
			])
		);

		await expectTrpcCode(
			caller.create({
				roomId: "room-1",
				name: "Reordered variants",
				variant: "Grouped Mix",
				mixGames: [
					{ variants: ["Limit Hold'em"] },
					{ variants: ["Razz"] },
					{ variants: ["Pot Limit Omaha", "NL Hold'em"] },
				],
			}),
			"BAD_REQUEST"
		);
	});

	it("create rejects a named-mix payload whose buckets are not in canonical group order", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
				[gameMix, [groupedMixMaster]],
				[gameVariant, groupedVariants],
				[gameGroup, canonicalGroups],
			])
		);

		await expectTrpcCode(
			caller.create({
				roomId: "room-1",
				name: "Reordered buckets",
				variant: "Grouped Mix",
				mixGames: [
					canonicalGroupedMix[2],
					canonicalGroupedMix[0],
					canonicalGroupedMix[1],
				],
			}),
			"BAD_REQUEST"
		);
	});

	it("create drops flat blind and ante fields from a mixed-game rule", async () => {
		const inserted: Record<string, unknown>[] = [];
		const rowsByTable = new Map<unknown, Rows>([
			[room, [{ id: "room-1", userId: CUR_OWNER }]],
			[ringGame, []],
			[
				gameVariant,
				[
					{ id: "variant-1", userId: CUR_OWNER, label: "NL Hold'em" },
					{
						id: "variant-2",
						userId: CUR_OWNER,
						label: "Pot Limit Omaha",
					},
				],
			],
		]);
		const baseDb = createMockDb(rowsByTable);
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db: {
				...baseDb,
				insert: () => ({
					values: (value: Record<string, unknown>) => {
						inserted.push(value);
						return Promise.resolve(undefined);
					},
				}),
			},
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;

		await caller.create({
			roomId: "room-1",
			name: "Mixed",
			variant: "mix",
			mixGames: validMix,
			blind1: 10,
			blind2: 20,
			blind3: 40,
			ante: 5,
			anteType: "all",
		});

		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			anteType: null,
		});
	});

	it("create rejects a named mix owned only by another user", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
				[gameMix, [{ id: "mix-1", userId: CUR_OTHER, label: "8-Game" }]],
			])
		);

		await expectTrpcCode(
			caller.create({
				roomId: "room-1",
				name: "Foreign mix",
				variant: "8-Game",
				mixGames: validMix,
			}),
			"BAD_REQUEST"
		);
	});

	it("create rejects a named mix payload whose games do not match its master", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
				[
					gameMix,
					[
						{
							id: "mix-1",
							userId: CUR_OWNER,
							label: "8-Game",
							games: ["variant-1", "variant-2"],
						},
					],
				],
				[
					gameVariant,
					[
						{ id: "variant-1", userId: CUR_OWNER, label: "NL Hold'em" },
						{ id: "variant-2", userId: CUR_OWNER, label: "Razz" },
					],
				],
			])
		);

		await expectTrpcCode(
			caller.create({
				roomId: "room-1",
				name: "Wrong 8-Game",
				variant: "8-Game",
				mixGames: validMix,
			}),
			"BAD_REQUEST"
		);
	});

	it("create rejects a named mix whose master references a missing variant row", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
				[
					gameMix,
					[
						{
							id: "mix-1",
							userId: CUR_OWNER,
							label: "8-Game",
							games: ["variant-1", "missing-variant"],
						},
					],
				],
				[
					gameVariant,
					[{ id: "variant-1", userId: CUR_OWNER, label: "NL Hold'em" }],
				],
			])
		);

		await expectTrpcCode(
			caller.create({
				roomId: "room-1",
				name: "Broken 8-Game",
				variant: "8-Game",
				mixGames: validMix,
			}),
			"BAD_REQUEST"
		);
	});

	it("create rejects a named mix whose variants resolve to a group not owned by the caller", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
				[
					gameMix,
					[
						{
							id: "mix-1",
							userId: CUR_OWNER,
							label: "8-Game",
							games: ["variant-1", "variant-2"],
						},
					],
				],
				[
					gameVariant,
					[
						{
							id: "variant-1",
							userId: CUR_OWNER,
							label: "NL Hold'em",
							groupId: "foreign-group",
						},
						{
							id: "variant-2",
							userId: CUR_OWNER,
							label: "Pot Limit Omaha",
							groupId: "foreign-group",
						},
					],
				],
				[
					gameGroup,
					[
						{
							id: "foreign-group",
							userId: CUR_OTHER,
							builtinKey: "bigbet",
							label: "Big Bet",
						},
					],
				],
			])
		);

		await expectTrpcCode(
			caller.create({
				roomId: "room-1",
				name: "Foreign group",
				variant: "8-Game",
				mixGames: validMix,
			}),
			"BAD_REQUEST"
		);
	});

	it("create rejects a legacy mix containing a game variant not owned by the caller", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
				[
					gameVariant,
					[
						{ id: "variant-1", userId: CUR_OWNER, label: "NL Hold'em" },
						{
							id: "variant-2",
							userId: CUR_OTHER,
							label: "Pot Limit Omaha",
						},
					],
				],
			])
		);

		await expectTrpcCode(
			caller.create({
				roomId: "room-1",
				name: "Foreign game",
				variant: "mix",
				mixGames: validMix,
			}),
			"BAD_REQUEST"
		);
	});

	it("update clears frozen mixGames when variant changes to a plain game", async () => {
		const updates: Record<string, unknown>[] = [];
		const rowsByTable = new Map<unknown, Rows>([
			[
				ringGame,
				[
					{
						id: "rg-1",
						userId: CUR_OWNER,
						variant: "8-Game",
						mixGames: validMix,
					},
				],
			],
			[gameMix, []],
		]);
		const baseDb = createMockDb(rowsByTable);
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db: {
				...baseDb,
				update: () => ({
					set: (value: Record<string, unknown>) => {
						updates.push(value);
						return { where: () => Promise.resolve(undefined) };
					},
				}),
			},
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;

		await caller.update({ id: "rg-1", variant: "NL Hold'em" });

		expect(updates).toHaveLength(1);
		expect(updates[0]).toMatchObject({
			variant: "NL Hold'em",
			mixGames: null,
		});
	});

	it("update rejects changing to a different named mix without its definition", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[
					ringGame,
					[
						{
							id: "rg-1",
							userId: CUR_OWNER,
							variant: "8-Game",
							mixGames: validMix,
						},
					],
				],
				[gameMix, [{ id: "mix-2", userId: CUR_OWNER, label: "HORSE" }]],
			])
		);

		await expectTrpcCode(
			caller.update({ id: "rg-1", variant: "HORSE" }),
			"BAD_REQUEST"
		);
	});

	it("update rejects clearing mixGames while keeping a mixed variant", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[
					ringGame,
					[
						{
							id: "rg-1",
							userId: CUR_OWNER,
							variant: "8-Game",
							mixGames: validMix,
						},
					],
				],
			])
		);

		await expectTrpcCode(
			caller.update({ id: "rg-1", mixGames: null }),
			"BAD_REQUEST"
		);
	});

	it("update clears stale flat blinds when a plain game changes to a mix", async () => {
		const updates: Record<string, unknown>[] = [];
		const rowsByTable = new Map<unknown, Rows>([
			[
				ringGame,
				[
					{
						id: "rg-1",
						userId: CUR_OWNER,
						variant: "NL Hold'em",
						mixGames: null,
						blind1: 10,
						blind2: 20,
						ante: 5,
						anteType: "all",
					},
				],
			],
			[
				gameVariant,
				[
					{ id: "variant-1", userId: CUR_OWNER, label: "NL Hold'em" },
					{
						id: "variant-2",
						userId: CUR_OWNER,
						label: "Pot Limit Omaha",
					},
				],
			],
		]);
		const baseDb = createMockDb(rowsByTable);
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db: {
				...baseDb,
				update: () => ({
					set: (value: Record<string, unknown>) => {
						updates.push(value);
						return { where: () => Promise.resolve(undefined) };
					},
				}),
			},
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;

		await caller.update({
			id: "rg-1",
			variant: "mix",
			mixGames: validMix,
		});

		expect(updates[0]).toMatchObject({
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			anteType: null,
		});
	});

	it("update validates an active named mix even when the payload has the same frozen label set", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[
					ringGame,
					[
						{
							id: "rg-1",
							userId: CUR_OWNER,
							variant: "Grouped Mix",
							mixGames: canonicalGroupedMix,
						},
					],
				],
				[gameMix, [groupedMixMaster]],
				[gameVariant, groupedVariants],
				[gameGroup, canonicalGroups],
			])
		);

		await expectTrpcCode(
			caller.update({
				id: "rg-1",
				mixGames: [
					canonicalGroupedMix[0],
					canonicalGroupedMix[1],
					{
						...canonicalGroupedMix[2],
						variants: ["Pot Limit Omaha", "NL Hold'em"],
					},
				],
			}),
			"BAD_REQUEST"
		);
	});

	it("update preserves a frozen named mix after its master is deleted", async () => {
		const frozen = {
			id: "rg-1",
			userId: CUR_OWNER,
			variant: "Deleted Mix",
			mixGames: validMix,
		};
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[ringGame, [frozen]],
				[gameMix, []],
			])
		);

		await expect(
			caller.update({
				id: "rg-1",
				name: "Renamed rule",
				variant: "Deleted Mix",
				mixGames: validMix,
			})
		).resolves.toEqual(frozen);
	});

	it("update lets a renamed-master snapshot change bucket amounts without changing its frozen structure", async () => {
		const frozen = {
			id: "rg-1",
			userId: CUR_OWNER,
			variant: "Old Mix Label",
			mixGames: canonicalGroupedMix,
		};
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[ringGame, [frozen]],
				[gameMix, [{ ...groupedMixMaster, label: "New Mix Label" }]],
			])
		);

		await expect(
			caller.update({
				id: "rg-1",
				mixGames: canonicalGroupedMix.map((group, index) => ({
					...group,
					blind1: 100 * (index + 1),
					blind2: 200 * (index + 1),
				})),
			})
		).resolves.toEqual(frozen);
	});

	it("update rejects regrouping an orphaned frozen named mix after its master is deleted", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[
					ringGame,
					[
						{
							id: "rg-1",
							userId: CUR_OWNER,
							variant: "Deleted Mix",
							mixGames: canonicalGroupedMix,
						},
					],
				],
				[gameMix, []],
			])
		);

		await expectTrpcCode(
			caller.update({
				id: "rg-1",
				mixGames: [
					{
						variants: ["Limit Hold'em", "Razz"],
					},
					{
						variants: ["NL Hold'em", "Pot Limit Omaha"],
					},
				],
			}),
			"BAD_REQUEST"
		);
	});

	it("update rejects reordering an orphaned frozen named mix after its master is renamed", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[
					ringGame,
					[
						{
							id: "rg-1",
							userId: CUR_OWNER,
							variant: "Old Mix Label",
							mixGames: canonicalGroupedMix,
						},
					],
				],
				[
					gameMix,
					[
						{
							...groupedMixMaster,
							label: "New Mix Label",
						},
					],
				],
			])
		);

		await expectTrpcCode(
			caller.update({
				id: "rg-1",
				mixGames: [
					canonicalGroupedMix[0],
					canonicalGroupedMix[1],
					{
						...canonicalGroupedMix[2],
						variants: ["Pot Limit Omaha", "NL Hold'em"],
					},
				],
			}),
			"BAD_REQUEST"
		);
	});

	it("update rejects adding an unavailable game to a frozen deleted named mix", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[
					ringGame,
					[
						{
							id: "rg-1",
							userId: CUR_OWNER,
							variant: "Deleted Mix",
							mixGames: validMix,
						},
					],
				],
				[gameMix, []],
			])
		);

		await expectTrpcCode(
			caller.update({
				id: "rg-1",
				mixGames: [...validMix, { name: "Stud", variants: ["Razz"] }],
			}),
			"BAD_REQUEST"
		);
	});

	it("update lets a legacy mix retain deleted games while adding an owned variant", async () => {
		const legacy = {
			id: "rg-1",
			userId: CUR_OWNER,
			variant: "mix",
			mixGames: validMix,
		};
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[ringGame, [legacy]],
				[gameVariant, [{ id: "variant-3", userId: CUR_OWNER, label: "Razz" }]],
			])
		);

		await expect(
			caller.update({
				id: "rg-1",
				mixGames: [...validMix, { name: "Stud", variants: ["Razz"] }],
			})
		).resolves.toEqual(legacy);
	});
});

describe("ringGame.listByRoom", () => {
	it("returns ring games for a room", async () => {
		const games = [
			{ id: "rg-1", roomId: "room-1", userId: CUR_OWNER, archivedAt: null },
			{ id: "rg-2", roomId: "room-1", userId: CUR_OWNER, archivedAt: null },
		];
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, games],
			])
		);

		await expect(caller.listByRoom({ roomId: "room-1" })).resolves.toEqual(
			games
		);
	});

	it("returns an empty array when the room has no ring games", async () => {
		const caller = ringGameCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[room, [{ id: "room-1", userId: CUR_OWNER }]],
				[ringGame, []],
			])
		);

		await expect(caller.listByRoom({ roomId: "room-1" })).resolves.toEqual([]);
	});

	it("respects includeArchived flag to filter archived games", async () => {
		const games = [
			{ id: "rg-1", roomId: "room-1", userId: CUR_OWNER, archivedAt: null },
			{
				id: "rg-2",
				roomId: "room-1",
				userId: CUR_OWNER,
				archivedAt: new Date("2026-01-01T00:00:00Z"),
			},
		];
		const db = createListByRoomFilterDb(
			{ id: "room-1", userId: CUR_OWNER },
			games
		);
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;

		await expect(caller.listByRoom({ roomId: "room-1" })).resolves.toEqual([
			games[0],
		]);
		await expect(
			caller.listByRoom({ roomId: "room-1", includeArchived: true })
		).resolves.toEqual([games[1]]);
	});
});

describe("ringGame.create persists optional fields via ?? null", () => {
	function createCaptureDb(rowsByTable: Map<unknown, Rows>) {
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
		return { db, inserted };
	}

	it.each([
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"minBuyIn",
		"maxBuyIn",
	] as const)("persists %s as the provided value or null when omitted", async (field) => {
		const rowsByTable = new Map<unknown, Rows>([
			[room, [{ id: "room-1", userId: CUR_OWNER }]],
			[ringGame, []],
			[currency, []],
		]);
		const { db, inserted } = createCaptureDb(rowsByTable);
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;

		await caller.create({ roomId: "room-1", name: "RG", [field]: 0 });
		await caller.create({ roomId: "room-1", name: "RG" });

		expect(inserted[0]).toMatchObject({ [field]: 0 });
		expect(inserted[1]).toMatchObject({ [field]: null });
	});

	it("persists memo as the provided value or null when omitted", async () => {
		const rowsByTable = new Map<unknown, Rows>([
			[room, [{ id: "room-1", userId: CUR_OWNER }]],
			[ringGame, []],
			[currency, []],
		]);
		const { db, inserted } = createCaptureDb(rowsByTable);
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;

		await caller.create({ roomId: "room-1", name: "RG", memo: "note" });
		await caller.create({ roomId: "room-1", name: "RG" });

		expect(inserted[0]).toMatchObject({ memo: "note" });
		expect(inserted[1]).toMatchObject({ memo: null });
	});
});

describe("ringGame.update writes only the provided field", () => {
	const fieldValues = {
		name: "Renamed",
		blind1: 50,
		blind2: 100,
		blind3: 200,
		ante: 10,
		anteType: "bb",
		minBuyIn: 100,
		maxBuyIn: 500,
		tableSize: 6,
		currencyId: "cur-1",
		memo: "note",
	} as const;

	it.each(
		Object.keys(fieldValues) as (keyof typeof fieldValues)[]
	)("update with only %s set writes just that field", async (field) => {
		const updates: Record<string, unknown>[] = [];
		const rowsByTable = new Map<unknown, Rows>([
			[
				ringGame,
				[
					{
						id: "rg-1",
						userId: CUR_OWNER,
						variant: "NL Hold'em",
						mixGames: null,
					},
				],
			],
			[currency, [{ id: "cur-1", userId: CUR_OWNER }]],
		]);
		const baseDb = createMockDb(rowsByTable);
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db: {
				...baseDb,
				update: () => ({
					set: (value: Record<string, unknown>) => {
						updates.push(value);
						return { where: () => Promise.resolve(undefined) };
					},
				}),
			},
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;

		await caller.update({ id: "rg-1", [field]: fieldValues[field] });

		expect(updates[0]).toEqual({
			updatedAt: expect.any(Date),
			[field]: fieldValues[field],
		});
	});
});

describe("ringGame.archive and restore set explicit fields", () => {
	function createUpdateCaptureDb(rowsByTable: Map<unknown, Rows>) {
		const updates: Record<string, unknown>[] = [];
		const baseDb = createMockDb(rowsByTable);
		const db = {
			...baseDb,
			update: () => ({
				set: (value: Record<string, unknown>) => {
					updates.push(value);
					return { where: () => Promise.resolve(undefined) };
				},
			}),
		};
		return { db, updates };
	}

	it("archive sets archivedAt to current date and does not unset it on re-archive", async () => {
		const rowsByTable = new Map<unknown, Rows>([
			[ringGame, [{ id: "rg-1", roomId: null, userId: CUR_OWNER }]],
		]);
		const { db, updates } = createUpdateCaptureDb(rowsByTable);
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;

		await caller.archive({ id: "rg-1" });
		await caller.archive({ id: "rg-1" });

		expect(updates).toHaveLength(2);
		for (const update of updates) {
			expect(update).toEqual({
				archivedAt: expect.any(Date),
				updatedAt: expect.any(Date),
			});
		}
	});

	it("restore clears archivedAt to null and updates updatedAt", async () => {
		const rowsByTable = new Map<unknown, Rows>([
			[ringGame, [{ id: "rg-1", roomId: null, userId: CUR_OWNER }]],
		]);
		const { db, updates } = createUpdateCaptureDb(rowsByTable);
		const caller = appRouter.createCaller({
			session: { user: { id: CUR_OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).ringGame;

		await caller.restore({ id: "rg-1" });

		expect(updates[0]).toEqual({
			archivedAt: null,
			updatedAt: expect.any(Date),
		});
	});
});
