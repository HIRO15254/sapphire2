import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("liveTournamentSession router", () => {
	it("appRouter has liveTournamentSession namespace", () => {
		expect(appRouter.liveTournamentSession).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.liveTournamentSession.list).toBeDefined();
	});

	it("has getById procedure", () => {
		expect(appRouter.liveTournamentSession.getById).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.liveTournamentSession.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.liveTournamentSession.update).toBeDefined();
	});

	it("has discard procedure", () => {
		expect(appRouter.liveTournamentSession.discard).toBeDefined();
	});

	it("update accepts tournamentId input", () => {
		const inputSchema =
			appRouter.liveTournamentSession.update._def.inputs[0] ??
			appRouter.liveTournamentSession.update._def.inputs;
		const shape =
			(inputSchema as { shape?: Record<string, unknown> })?.shape ??
			(
				inputSchema as {
					_def?: { shape?: () => Record<string, unknown> };
				}
			)?._def?.shape?.();
		expect(shape).toBeDefined();
		expect(shape?.tournamentId).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.liveTournamentSession).sort()).toEqual(
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
		expectProtected(appRouter.liveTournamentSession.list);
		expectType(appRouter.liveTournamentSession.list, "query");
		expectProtected(appRouter.liveTournamentSession.getById);
		expectType(appRouter.liveTournamentSession.getById, "query");
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
			const proc = appRouter.liveTournamentSession[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("liveTournamentSession.list input validation", () => {
	it("accepts all valid statuses", () => {
		for (const status of ["active", "paused", "completed"] as const) {
			expectAccepts(appRouter.liveTournamentSession.list, { status });
		}
	});

	it("rejects unknown status", () => {
		expectRejects(appRouter.liveTournamentSession.list, {
			status: "archived",
		});
	});

	it("rejects limit > 100", () => {
		expectRejects(appRouter.liveTournamentSession.list, { limit: 101 });
	});

	it("rejects limit < 1", () => {
		expectRejects(appRouter.liveTournamentSession.list, { limit: 0 });
	});
});

describe("liveTournamentSession.create input validation", () => {
	it("accepts empty object (all fields optional)", () => {
		expectAccepts(appRouter.liveTournamentSession.create, {});
	});

	it("accepts full payload", () => {
		expectAccepts(appRouter.liveTournamentSession.create, {
			storeId: "s1",
			tournamentId: "tn1",
			currencyId: "c1",
			buyIn: 10_000,
			entryFee: 1000,
			memo: "WSOP",
			timerStartedAt: 1_700_000_000,
		});
	});

	it("rejects negative buyIn", () => {
		expectRejects(appRouter.liveTournamentSession.create, { buyIn: -1 });
	});

	it("rejects non-integer entryFee", () => {
		expectRejects(appRouter.liveTournamentSession.create, { entryFee: 10.5 });
	});

	it("rejects non-integer timerStartedAt", () => {
		expectRejects(appRouter.liveTournamentSession.create, {
			timerStartedAt: 1.5,
		});
	});
});

describe("liveTournamentSession.complete input validation (discriminated union)", () => {
	it("accepts full-result branch (beforeDeadline: false) with all required fields", () => {
		expectAccepts(appRouter.liveTournamentSession.complete, {
			id: "s1",
			beforeDeadline: false,
			placement: 1,
			totalEntries: 30,
			prizeMoney: 1000,
			bountyPrizes: 200,
		});
	});

	it("accepts early-quit branch (beforeDeadline: true) without placement", () => {
		expectAccepts(appRouter.liveTournamentSession.complete, {
			id: "s1",
			beforeDeadline: true,
			prizeMoney: 0,
			bountyPrizes: 0,
		});
	});

	it("rejects beforeDeadline=false without placement", () => {
		expectRejects(appRouter.liveTournamentSession.complete, {
			id: "s1",
			beforeDeadline: false,
			totalEntries: 30,
			prizeMoney: 500,
			bountyPrizes: 0,
		});
	});

	it("rejects placement < 1", () => {
		expectRejects(appRouter.liveTournamentSession.complete, {
			id: "s1",
			beforeDeadline: false,
			placement: 0,
			totalEntries: 10,
			prizeMoney: 0,
			bountyPrizes: 0,
		});
	});

	it("rejects totalEntries < 1", () => {
		expectRejects(appRouter.liveTournamentSession.complete, {
			id: "s1",
			beforeDeadline: false,
			placement: 1,
			totalEntries: 0,
			prizeMoney: 0,
			bountyPrizes: 0,
		});
	});

	it("rejects negative prizeMoney", () => {
		expectRejects(appRouter.liveTournamentSession.complete, {
			id: "s1",
			beforeDeadline: true,
			prizeMoney: -1,
			bountyPrizes: 0,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveTournamentSession.complete, {
			beforeDeadline: true,
			prizeMoney: 0,
			bountyPrizes: 0,
		});
	});
});

describe("liveTournamentSession.updateHeroSeat input validation", () => {
	it("accepts seat at boundaries 0 and 8", () => {
		expectAccepts(appRouter.liveTournamentSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 0,
		});
		expectAccepts(appRouter.liveTournamentSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 8,
		});
	});

	it("accepts heroSeatPosition: null", () => {
		expectAccepts(appRouter.liveTournamentSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: null,
		});
	});

	it("rejects seat > 8", () => {
		expectRejects(appRouter.liveTournamentSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 9,
		});
	});
});

describe("liveTournamentSession.{reopen,discard,getById} input validation", () => {
	it("reopen accepts {id}", () => {
		expectAccepts(appRouter.liveTournamentSession.reopen, { id: "s1" });
	});

	it("discard accepts {id}", () => {
		expectAccepts(appRouter.liveTournamentSession.discard, { id: "s1" });
	});

	it("getById accepts {id}", () => {
		expectAccepts(appRouter.liveTournamentSession.getById, { id: "s1" });
	});

	it("reopen / discard / getById reject missing id", () => {
		expectRejects(appRouter.liveTournamentSession.reopen, {});
		expectRejects(appRouter.liveTournamentSession.discard, {});
		expectRejects(appRouter.liveTournamentSession.getById, {});
	});
});
