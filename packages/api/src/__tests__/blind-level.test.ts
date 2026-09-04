import { room } from "@sapphire2/db/schema/room";
import { blindLevel, tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

type Rows = Record<string, unknown>[];

import { createCaller } from "./caller";
import {
	createReorderMockDb,
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

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

function makeCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	const { db, updateWhereParams, batchCalls } =
		createReorderMockDb(rowsByTable);
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).blindLevel;
	return { caller, updateWhereParams, batchCalls };
}

function makeCallerWithSetCapture(
	userId: string,
	rowsByTable: Map<unknown, Rows>
) {
	const { db, updateWhereParams, batchCalls } =
		createReorderMockDb(rowsByTable);
	const updateSetValues: unknown[] = [];
	const trackedDb = {
		...db,
		update: (_table: unknown) => ({
			set: (values: unknown) => {
				updateSetValues.push(values);
				return db.update().set();
			},
		}),
	};
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db: trackedDb,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).blindLevel;
	return { caller, updateWhereParams, batchCalls, updateSetValues };
}

const CALLER = "user-1";
const OTHER = "user-2";

describe("blindLevel router", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.blindLevel).sort()).toEqual(
			["create", "delete", "listByTournament", "reorder", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.blindLevel, {
			create: "mutation",
			delete: "mutation",
			listByTournament: "query",
			reorder: "mutation",
			update: "mutation",
		});
	});
});

describe("blindLevel.update input validation", () => {
	it("accepts nullable blind/ante/minutes fields set to null", () => {
		expectAccepts(appRouter.blindLevel.update, {
			id: "bl1",
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			minutes: null,
		});
	});
});

describe("blindLevel.reorder tournament scoping (SA2-176)", () => {
	function ownedRows() {
		return new Map<unknown, Rows>([
			[tournament, [{ id: "tn1", roomId: "room1" }]],
			[room, [{ id: "room1", userId: CALLER }]],
			[blindLevel, [{ id: "bl1", level: 1 }]],
		]);
	}

	it("scopes each level UPDATE to both the level id and the owned tournament", async () => {
		const { caller, updateWhereParams, batchCalls } = makeCaller(
			CALLER,
			ownedRows()
		);
		await caller.reorder({ tournamentId: "tn1", levelIds: ["bl1", "bl2"] });
		expect(batchCalls).toHaveLength(1);
		expect(updateWhereParams).toHaveLength(2);
		expect(updateWhereParams[0]).toContain("bl1");
		expect(updateWhereParams[0]).toContain("tn1");
		expect(updateWhereParams[1]).toContain("bl2");
		expect(updateWhereParams[1]).toContain("tn1");
	});

	it("reorder sets level field to index + 1 for each reordered entry", async () => {
		const { caller, updateSetValues } = makeCallerWithSetCapture(
			CALLER,
			ownedRows()
		);
		await caller.reorder({
			tournamentId: "tn1",
			levelIds: ["bl2", "bl1", "bl3"],
		});
		expect(updateSetValues).toEqual([{ level: 1 }, { level: 2 }, { level: 3 }]);
	});

	it("runs no UPDATE when levelIds is empty", async () => {
		const { caller, updateWhereParams } = makeCaller(CALLER, ownedRows());
		await caller.reorder({ tournamentId: "tn1", levelIds: [] });
		expect(updateWhereParams).toHaveLength(0);
	});

	it("throws FORBIDDEN and runs no UPDATE when the tournament is owned by another user", async () => {
		const rows = new Map<unknown, Rows>([
			[tournament, [{ id: "tn1", roomId: "room1" }]],
			[room, [{ id: "room1", userId: OTHER }]],
			[blindLevel, []],
		]);
		const { caller, updateWhereParams } = makeCaller(CALLER, rows);
		await expectTrpcCode(
			caller.reorder({ tournamentId: "tn1", levelIds: ["bl1"] }),
			"FORBIDDEN"
		);
		expect(updateWhereParams).toHaveLength(0);
	});
});

describe("blindLevel.update ownership success", () => {
	it("successfully updates a blind level owned by the user", async () => {
		const { caller } = makeCaller(
			CALLER,
			new Map<unknown, Rows>([
				[tournament, [{ id: "tn1", roomId: "room1" }]],
				[room, [{ id: "room1", userId: CALLER }]],
				[blindLevel, [{ id: "bl1", tournamentId: "tn1", level: 1 }]],
			])
		);
		const result = await caller.update({ id: "bl1", level: 2 });
		expect(result).toMatchObject({ id: "bl1", tournamentId: "tn1" });
	});
});

describe("blindLevel ownership failures hide entity existence", () => {
	it("returns FORBIDDEN when the tournament does not exist", async () => {
		const { caller } = makeCaller(
			CALLER,
			new Map<unknown, Rows>([
				[tournament, []],
				[room, []],
				[blindLevel, []],
			])
		);
		await expectTrpcCode(
			caller.listByTournament({ tournamentId: "missing" }),
			"FORBIDDEN"
		);
	});

	it("returns FORBIDDEN when the tournament room does not exist", async () => {
		const { caller } = makeCaller(
			CALLER,
			new Map<unknown, Rows>([
				[tournament, [{ id: "tn1", roomId: "missing" }]],
				[room, []],
				[blindLevel, []],
			])
		);
		await expectTrpcCode(
			caller.listByTournament({ tournamentId: "tn1" }),
			"FORBIDDEN"
		);
	});

	it("returns FORBIDDEN when the blind level does not exist", async () => {
		const { caller } = makeCaller(
			CALLER,
			new Map<unknown, Rows>([[blindLevel, []]])
		);
		await expectTrpcCode(
			caller.update({ id: "missing", level: 2 }),
			"FORBIDDEN"
		);
	});
});

describe("blindLevel games input", () => {
	it("create accepts per-level game groups", () => {
		expectAccepts(appRouter.blindLevel.create, {
			tournamentId: "t-1",
			level: 1,
			isBreak: false,
			blind1: 100,
			blind2: 200,
			games: [
				{ name: "Limit", variants: ["lhe", "o8"], blind1: 400, blind2: 800 },
			],
		});
	});

	it("create rejects an empty games array (null means no groups)", () => {
		expectRejects(appRouter.blindLevel.create, {
			tournamentId: "t-1",
			level: 1,
			isBreak: false,
			games: [],
		});
	});

	it("update accepts an explicit null to clear the groups", () => {
		expectAccepts(appRouter.blindLevel.update, { id: "bl-1", games: null });
	});
});

function ownedTournamentSelect(blindLevelRows: Rows = []) {
	return {
		tournament: [{ id: "tn1", roomId: "room1" }],
		room: [{ id: "room1", userId: CALLER }],
		blind_level: blindLevelRows,
	};
}

describe("blindLevel.create field defaults and pass-through", () => {
	it("writes null defaults for optional fields when only tournamentId and level are given", async () => {
		const { caller, inserted } = createCaller({
			select: ownedTournamentSelect(),
		});

		await caller.blindLevel.create({ tournamentId: "tn1", level: 1 });

		expect(inserted.blind_level[0]).toMatchObject({
			tournamentId: "tn1",
			level: 1,
			isBreak: false,
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			minutes: null,
			games: null,
		});
	});

	it("writes every provided field", async () => {
		const { caller, inserted } = createCaller({
			select: ownedTournamentSelect(),
		});

		await caller.blindLevel.create({
			tournamentId: "tn1",
			level: 2,
			isBreak: true,
			blind1: 100,
			blind2: 200,
			blind3: 400,
			ante: 25,
			minutes: 20,
			games: [{ name: "Limit", variants: ["lhe"], blind1: 400, blind2: 800 }],
		});

		expect(inserted.blind_level[0]).toMatchObject({
			tournamentId: "tn1",
			level: 2,
			isBreak: true,
			blind1: 100,
			blind2: 200,
			blind3: 400,
			ante: 25,
			minutes: 20,
			games: [{ name: "Limit", variants: ["lhe"], blind1: 400, blind2: 800 }],
		});
	});
});

describe("blindLevel.update field pass-through", () => {
	it("writes every provided field on the owned blind level", async () => {
		const { caller, updated } = createCaller({
			select: ownedTournamentSelect([
				{ id: "bl1", tournamentId: "tn1", level: 1 },
			]),
		});

		await caller.blindLevel.update({
			id: "bl1",
			isBreak: true,
			blind1: 100,
			blind2: 200,
			blind3: 0,
			ante: 5,
			minutes: 20,
			games: [{ name: "Limit", variants: ["lhe"], blind1: 400, blind2: 800 }],
		});

		expect(updated.blind_level[0]).toMatchObject({
			isBreak: true,
			blind1: 100,
			blind2: 200,
			blind3: 0,
			ante: 5,
			minutes: 20,
			games: [{ name: "Limit", variants: ["lhe"], blind1: 400, blind2: 800 }],
		});
	});
});

describe("blindLevel.delete success", () => {
	it("deletes the owned blind level", async () => {
		const { caller, deleteWhereParams } = createCaller({
			select: ownedTournamentSelect([{ id: "bl1", tournamentId: "tn1" }]),
		});

		await expect(caller.blindLevel.delete({ id: "bl1" })).resolves.toEqual({
			success: true,
		});
		expect(deleteWhereParams[0]).toContain("bl1");
	});
});

describe("blindLevel numeric boundaries", () => {
	const validCreate = { tournamentId: "tn1", level: 1 };

	it.each([
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"minutes",
	] as const)("%s rejects negative and fractional values and accepts zero on create and update", (field) => {
		expectRejects(appRouter.blindLevel.create, {
			...validCreate,
			[field]: -1,
		});
		expectRejects(appRouter.blindLevel.create, {
			...validCreate,
			[field]: 1.5,
		});
		expectAccepts(appRouter.blindLevel.create, {
			...validCreate,
			[field]: 0,
		});
		expectRejects(appRouter.blindLevel.update, { id: "bl1", [field]: -1 });
		expectRejects(appRouter.blindLevel.update, { id: "bl1", [field]: 1.5 });
		expectAccepts(appRouter.blindLevel.update, { id: "bl1", [field]: 0 });
	});

	it("level is a 1-based integer on create and update", () => {
		for (const level of [-1, 0, 1.5]) {
			expectRejects(appRouter.blindLevel.create, {
				tournamentId: "tn1",
				level,
			});
			expectRejects(appRouter.blindLevel.update, { id: "bl1", level });
		}
		expectAccepts(appRouter.blindLevel.create, {
			tournamentId: "tn1",
			level: 1,
		});
		expectAccepts(appRouter.blindLevel.update, { id: "bl1", level: 1 });
	});
});
