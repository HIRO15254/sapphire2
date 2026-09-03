import { room } from "@sapphire2/db/schema/room";
import {
	tournament,
	tournamentChipPurchase,
} from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

type Rows = Record<string, unknown>[];

import {
	createChainableMockDb,
	createReorderMockDb,
	createSequencedMockDb,
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

function callerFor(db: unknown) {
	return appRouter.createCaller({
		session: { user: { id: CALLER } },
		db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0])
		.tournamentChipPurchase;
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

function makeCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	const { db, updateWhereParams, batchCalls } =
		createReorderMockDb(rowsByTable);
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db,
	} as unknown as Parameters<
		typeof appRouter.createCaller
	>[0]).tournamentChipPurchase;
	return { caller, updateWhereParams, batchCalls };
}

const CALLER = "user-1";
const OTHER = "user-2";

describe("tournamentChipPurchase router structure", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.tournamentChipPurchase).sort()).toEqual(
			["create", "delete", "listByTournament", "reorder", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.tournamentChipPurchase, {
			create: "mutation",
			delete: "mutation",
			listByTournament: "query",
			reorder: "mutation",
			update: "mutation",
		});
	});
});

describe("tournamentChipPurchase.create input validation", () => {
	it("rejects empty name", () => {
		expectRejects(appRouter.tournamentChipPurchase.create, {
			tournamentId: "tn1",
			name: "",
			cost: 100,
			chips: 10_000,
		});
	});
});

describe("tournamentChipPurchase.update input validation", () => {
	it("rejects empty name", () => {
		expectRejects(appRouter.tournamentChipPurchase.update, {
			id: "cp1",
			name: "",
		});
	});
});

describe("tournamentChipPurchase.reorder tournament scoping (SA2-123)", () => {
	function ownedRows() {
		return new Map<unknown, Rows>([
			[tournament, [{ id: "tn1", roomId: "room1" }]],
			[room, [{ id: "room1", userId: CALLER }]],
			[tournamentChipPurchase, [{ id: "cp1", sortOrder: 0 }]],
		]);
	}

	it("scopes each UPDATE to both the row id and the owned tournament", async () => {
		const { caller, updateWhereParams, batchCalls } = makeCaller(
			CALLER,
			ownedRows()
		);
		await caller.reorder({ tournamentId: "tn1", ids: ["cp1", "cp2"] });
		expect(batchCalls).toHaveLength(1);
		expect(updateWhereParams).toHaveLength(2);
		expect(updateWhereParams[0]).toContain("cp1");
		expect(updateWhereParams[0]).toContain("tn1");
		expect(updateWhereParams[1]).toContain("cp2");
		expect(updateWhereParams[1]).toContain("tn1");
	});

	it("runs no UPDATE when ids is empty", async () => {
		const { caller, updateWhereParams } = makeCaller(CALLER, ownedRows());
		await caller.reorder({ tournamentId: "tn1", ids: [] });
		expect(updateWhereParams).toHaveLength(0);
	});

	it("throws FORBIDDEN and runs no UPDATE when the tournament is owned by another user", async () => {
		const rows = new Map<unknown, Rows>([
			[tournament, [{ id: "tn1", roomId: "room1" }]],
			[room, [{ id: "room1", userId: OTHER }]],
			[tournamentChipPurchase, []],
		]);
		const { caller, updateWhereParams } = makeCaller(CALLER, rows);
		await expectTrpcCode(
			caller.reorder({ tournamentId: "tn1", ids: ["cp1"] }),
			"FORBIDDEN"
		);
		expect(updateWhereParams).toHaveLength(0);
	});
});

describe("tournamentChipPurchase ownership failures hide entity existence", () => {
	it("returns FORBIDDEN when the tournament does not exist", async () => {
		const { caller } = makeCaller(
			CALLER,
			new Map<unknown, Rows>([
				[tournament, []],
				[room, []],
				[tournamentChipPurchase, []],
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
				[tournamentChipPurchase, []],
			])
		);
		await expectTrpcCode(
			caller.listByTournament({ tournamentId: "tn1" }),
			"FORBIDDEN"
		);
	});

	it("returns FORBIDDEN when the chip purchase does not exist", async () => {
		const { caller } = makeCaller(
			CALLER,
			new Map<unknown, Rows>([[tournamentChipPurchase, []]])
		);
		await expectTrpcCode(
			caller.update({ id: "missing", name: "Rebuy" }),
			"FORBIDDEN"
		);
	});
});

describe("tournamentChipPurchase numeric boundaries", () => {
	const validCreate = {
		tournamentId: "tn1",
		name: "Rebuy",
		cost: 1,
		chips: 1,
	};

	it.each([
		"cost",
		"chips",
	] as const)("%s rejects negative and fractional values and accepts zero on create and update", (field) => {
		expectRejects(appRouter.tournamentChipPurchase.create, {
			...validCreate,
			[field]: -1,
		});
		expectRejects(appRouter.tournamentChipPurchase.create, {
			...validCreate,
			[field]: 12.5,
		});
		expectAccepts(appRouter.tournamentChipPurchase.create, {
			...validCreate,
			[field]: 0,
		});
		expectRejects(appRouter.tournamentChipPurchase.update, {
			id: "cp1",
			[field]: -1,
		});
		expectRejects(appRouter.tournamentChipPurchase.update, {
			id: "cp1",
			[field]: 1.5,
		});
		expectAccepts(appRouter.tournamentChipPurchase.update, {
			id: "cp1",
			[field]: 0,
		});
	});
});

describe("tournamentChipPurchase.create mutation", () => {
	it("create returns the created chip purchase with all provided fields", async () => {
		const created = {
			id: "cp-new",
			tournamentId: "tn1",
			name: "Rebuy",
			cost: 100,
			chips: 10_000,
			sortOrder: 0,
		};
		const db = createSequencedMockDb([
			[{ id: "tn1", roomId: "room1" }],
			[{ id: "room1", userId: CALLER }],
			[],
			[created],
		]);

		const result = await callerFor(db).create({
			tournamentId: "tn1",
			name: "Rebuy",
			cost: 100,
			chips: 10_000,
		});

		expect(result).toEqual(created);
		expect(db._insertChain.values).toHaveBeenCalledWith(
			expect.objectContaining({
				tournamentId: "tn1",
				name: "Rebuy",
				cost: 100,
				chips: 10_000,
				sortOrder: 0,
			})
		);
	});
});

describe("tournamentChipPurchase.update partial field application", () => {
	function ownedChipPurchaseRows(currentRow: Rows[number]) {
		return {
			tournament_chip_purchase: [currentRow],
			tournament: [{ id: "tn1", roomId: "room1" }],
			room: [{ id: "room1", userId: CALLER }],
		};
	}

	it.each([
		{
			label: "name only",
			update: { name: "Super Rebuy" },
			expectedSet: { name: "Super Rebuy" },
		},
		{
			label: "cost only",
			update: { cost: 200 },
			expectedSet: { cost: 200 },
		},
		{
			label: "chips only",
			update: { chips: 20_000 },
			expectedSet: { chips: 20_000 },
		},
		{
			label: "name and cost",
			update: { name: "Super Rebuy", cost: 150 },
			expectedSet: { name: "Super Rebuy", cost: 150 },
		},
	])("sets only the provided fields ($label) and returns the record", async ({
		update,
		expectedSet,
	}) => {
		const currentRow = {
			id: "cp1",
			tournamentId: "tn1",
			name: "Rebuy",
			cost: 100,
			chips: 10_000,
		};
		const mock = createChainableMockDb({
			select: ownedChipPurchaseRows(currentRow),
		});

		const result = await callerFor(mock.db).update({ id: "cp1", ...update });

		expect(mock.updated.tournament_chip_purchase).toEqual([expectedSet]);
		expect(result).toEqual(currentRow);
	});
});

describe("tournamentChipPurchase.delete mutation", () => {
	it("delete removes the chip purchase and returns success", async () => {
		const db = createSequencedMockDb([
			[{ id: "cp1", tournamentId: "tn1" }],
			[{ id: "tn1", roomId: "room1" }],
			[{ id: "room1", userId: CALLER }],
		]);

		const result = await callerFor(db).delete({ id: "cp1" });

		expect(result).toEqual({ success: true });
		expect(db._deleteChain.where).toHaveBeenCalledTimes(1);
	});
});

describe("tournamentChipPurchase.reorder sortOrder assignment", () => {
	it("reorder sets the correct sortOrder for each chip purchase", async () => {
		const mock = createChainableMockDb({
			select: {
				tournament: [{ id: "tn1", roomId: "room1" }],
				room: [{ id: "room1", userId: CALLER }],
			},
		});

		await callerFor(mock.db).reorder({
			tournamentId: "tn1",
			ids: ["cp1", "cp2"],
		});

		expect(mock.updated.tournament_chip_purchase).toEqual([
			{ sortOrder: 0 },
			{ sortOrder: 1 },
		]);
	});
});
