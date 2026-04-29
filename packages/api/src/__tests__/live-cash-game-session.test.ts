import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
	getInputSchema,
} from "./test-utils";

describe("liveCashGameSession router", () => {
	it("appRouter has liveCashGameSession namespace", () => {
		expect(appRouter.liveCashGameSession).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.liveCashGameSession.list).toBeDefined();
	});

	it("has getById procedure", () => {
		expect(appRouter.liveCashGameSession.getById).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.liveCashGameSession.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.liveCashGameSession.update).toBeDefined();
	});

	it("has discard procedure", () => {
		expect(appRouter.liveCashGameSession.discard).toBeDefined();
	});

	it("update accepts ringGameId input", () => {
		const inputSchema =
			appRouter.liveCashGameSession.update._def.inputs[0] ??
			appRouter.liveCashGameSession.update._def.inputs;
		const shape =
			(inputSchema as { shape?: Record<string, unknown> })?.shape ??
			(
				inputSchema as {
					_def?: { shape?: () => Record<string, unknown> };
				}
			)?._def?.shape?.();
		expect(shape).toBeDefined();
		expect(shape?.ringGameId).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.liveCashGameSession).sort()).toEqual(
			[
				"complete",
				"create",
				"discard",
				"getById",
				"list",
				"reopen",
				"update",
				"updateHeroSeat",
			].sort()
		);
	});

	it("list / getById are protected queries", () => {
		expectProtected(appRouter.liveCashGameSession.list);
		expectType(appRouter.liveCashGameSession.list, "query");
		expectProtected(appRouter.liveCashGameSession.getById);
		expectType(appRouter.liveCashGameSession.getById, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of [
			"create",
			"update",
			"complete",
			"reopen",
			"discard",
			"updateHeroSeat",
		] as const) {
			const proc = appRouter.liveCashGameSession[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("liveCashGameSession.list input validation", () => {
	it("accepts empty object (limit defaults to 20)", () => {
		const schema = getInputSchema(appRouter.liveCashGameSession.list);
		const parsed = schema.safeParse({}) as unknown as {
			success: true;
			data: { limit: number };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.limit).toBe(20);
	});

	it("accepts all valid status values", () => {
		for (const status of ["active", "paused", "completed"] as const) {
			expectAccepts(appRouter.liveCashGameSession.list, { status });
		}
	});

	it("rejects unknown status", () => {
		expectRejects(appRouter.liveCashGameSession.list, { status: "ended" });
	});

	it("accepts limit at boundaries (1 and 100)", () => {
		expectAccepts(appRouter.liveCashGameSession.list, { limit: 1 });
		expectAccepts(appRouter.liveCashGameSession.list, { limit: 100 });
	});

	it("rejects limit above 100", () => {
		expectRejects(appRouter.liveCashGameSession.list, { limit: 101 });
	});

	it("rejects limit below 1", () => {
		expectRejects(appRouter.liveCashGameSession.list, { limit: 0 });
	});

	it("rejects non-integer limit", () => {
		expectRejects(appRouter.liveCashGameSession.list, { limit: 10.5 });
	});
});

describe("liveCashGameSession.create input validation", () => {
	it("accepts minimal payload (initialBuyIn only)", () => {
		expectAccepts(appRouter.liveCashGameSession.create, {
			initialBuyIn: 0,
		});
	});

	it("accepts all optional link fields", () => {
		expectAccepts(appRouter.liveCashGameSession.create, {
			storeId: "s1",
			ringGameId: "rg1",
			currencyId: "c1",
			memo: "session memo",
			initialBuyIn: 1000,
		});
	});

	it("rejects negative initialBuyIn", () => {
		expectRejects(appRouter.liveCashGameSession.create, {
			initialBuyIn: -1,
		});
	});

	it("rejects missing initialBuyIn", () => {
		expectRejects(appRouter.liveCashGameSession.create, { memo: "x" });
	});
});

describe("liveCashGameSession.update input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.liveCashGameSession.update, { id: "s1" });
	});

	it("accepts explicit null clears for link fields", () => {
		expectAccepts(appRouter.liveCashGameSession.update, {
			id: "s1",
			storeId: null,
			currencyId: null,
			ringGameId: null,
			memo: null,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveCashGameSession.update, { memo: "x" });
	});
});

describe("liveCashGameSession.complete input validation", () => {
	it("accepts a valid finalStack of 0 (all-in loss)", () => {
		expectAccepts(appRouter.liveCashGameSession.complete, {
			id: "s1",
			finalStack: 0,
		});
	});

	it("rejects negative finalStack", () => {
		expectRejects(appRouter.liveCashGameSession.complete, {
			id: "s1",
			finalStack: -1,
		});
	});

	it("rejects non-integer finalStack", () => {
		expectRejects(appRouter.liveCashGameSession.complete, {
			id: "s1",
			finalStack: 1.5,
		});
	});

	it("rejects missing finalStack", () => {
		expectRejects(appRouter.liveCashGameSession.complete, { id: "s1" });
	});
});

describe("liveCashGameSession.updateHeroSeat input validation", () => {
	it("accepts seat position at boundary 0 and 8", () => {
		expectAccepts(appRouter.liveCashGameSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 0,
		});
		expectAccepts(appRouter.liveCashGameSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 8,
		});
	});

	it("accepts heroSeatPosition: null (hero stands up)", () => {
		expectAccepts(appRouter.liveCashGameSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: null,
		});
	});

	it("rejects seat position outside [0, 8]", () => {
		expectRejects(appRouter.liveCashGameSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 9,
		});
		expectRejects(appRouter.liveCashGameSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: -1,
		});
	});
});

describe("liveCashGameSession.{reopen,discard,getById} input validation", () => {
	it("reopen accepts {id}", () => {
		expectAccepts(appRouter.liveCashGameSession.reopen, { id: "s1" });
	});

	it("reopen rejects missing id", () => {
		expectRejects(appRouter.liveCashGameSession.reopen, {});
	});

	it("discard accepts {id}", () => {
		expectAccepts(appRouter.liveCashGameSession.discard, { id: "s1" });
	});

	it("discard rejects missing id", () => {
		expectRejects(appRouter.liveCashGameSession.discard, {});
	});

	it("getById accepts {id}", () => {
		expectAccepts(appRouter.liveCashGameSession.getById, { id: "s1" });
	});

	it("getById rejects missing id", () => {
		expectRejects(appRouter.liveCashGameSession.getById, {});
	});
});
