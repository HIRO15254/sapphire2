import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
	getInputSchema,
} from "./test-utils";

describe("sessionTablePlayer router structure", () => {
	it("appRouter has sessionTablePlayer namespace", () => {
		expect(appRouter.sessionTablePlayer).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.sessionTablePlayer).sort()).toEqual(
			["add", "addNew", "addTemporary", "list", "remove", "updateSeat"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.sessionTablePlayer.list);
		expectType(appRouter.sessionTablePlayer.list, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of [
			"add",
			"addNew",
			"addTemporary",
			"remove",
			"updateSeat",
		] as const) {
			const proc = appRouter.sessionTablePlayer[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("sessionTablePlayer.list input validation", () => {
	it("accepts empty object (activeOnly defaults to false)", () => {
		const schema = getInputSchema(appRouter.sessionTablePlayer.list);
		const parsed = schema.safeParse({}) as unknown as {
			success: true;
			data: { activeOnly: boolean };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.activeOnly).toBe(false);
	});

	it("accepts liveCashGameSessionId with explicit activeOnly=true", () => {
		expectAccepts(appRouter.sessionTablePlayer.list, {
			liveCashGameSessionId: "lcg1",
			activeOnly: true,
		});
	});

	it("accepts liveTournamentSessionId", () => {
		expectAccepts(appRouter.sessionTablePlayer.list, {
			liveTournamentSessionId: "lt1",
		});
	});

	it("rejects non-boolean activeOnly", () => {
		expectRejects(appRouter.sessionTablePlayer.list, {
			activeOnly: "yes",
		});
	});
});

describe("sessionTablePlayer.add input validation", () => {
	it("accepts playerId + session id", () => {
		expectAccepts(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
		});
	});

	it("accepts seat position in range [0, 8]", () => {
		expectAccepts(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 0,
		});
		expectAccepts(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 8,
		});
	});

	it("rejects seat position out of range", () => {
		expectRejects(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 9,
		});
		expectRejects(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: -1,
		});
	});

	it("rejects non-integer seat position", () => {
		expectRejects(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 1.5,
		});
	});

	it("rejects empty playerId", () => {
		expectRejects(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "",
		});
	});

	it("rejects missing playerId", () => {
		expectRejects(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
		});
	});
});

describe("sessionTablePlayer.addNew input validation", () => {
	it("accepts minimal valid payload", () => {
		expectAccepts(appRouter.sessionTablePlayer.addNew, {
			liveCashGameSessionId: "lcg1",
			playerName: "Guest",
		});
	});

	it("accepts playerMemo and playerTagIds", () => {
		expectAccepts(appRouter.sessionTablePlayer.addNew, {
			liveTournamentSessionId: "lt1",
			playerName: "Guest",
			playerMemo: "met at table",
			playerTagIds: ["t1", "t2"],
		});
	});

	it("rejects empty playerName", () => {
		expectRejects(appRouter.sessionTablePlayer.addNew, {
			liveCashGameSessionId: "lcg1",
			playerName: "",
		});
	});

	it("rejects seat position > 8", () => {
		expectRejects(appRouter.sessionTablePlayer.addNew, {
			liveCashGameSessionId: "lcg1",
			playerName: "Guest",
			seatPosition: 9,
		});
	});
});

describe("sessionTablePlayer.updateSeat input validation", () => {
	it("accepts seatPosition = null (leave seat)", () => {
		expectAccepts(appRouter.sessionTablePlayer.updateSeat, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: null,
		});
	});

	it("accepts valid seat positions (0 and 8 boundaries)", () => {
		expectAccepts(appRouter.sessionTablePlayer.updateSeat, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 0,
		});
		expectAccepts(appRouter.sessionTablePlayer.updateSeat, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 8,
		});
	});

	it("rejects seat position out of [0, 8]", () => {
		expectRejects(appRouter.sessionTablePlayer.updateSeat, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 9,
		});
	});

	it("rejects missing playerId", () => {
		expectRejects(appRouter.sessionTablePlayer.updateSeat, {
			liveCashGameSessionId: "lcg1",
			seatPosition: 1,
		});
	});
});

describe("sessionTablePlayer.remove input validation", () => {
	it("accepts valid payload", () => {
		expectAccepts(appRouter.sessionTablePlayer.remove, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
		});
	});

	it("rejects empty playerId", () => {
		expectRejects(appRouter.sessionTablePlayer.remove, {
			liveCashGameSessionId: "lcg1",
			playerId: "",
		});
	});
});

describe("sessionTablePlayer.addTemporary input validation", () => {
	it("accepts session id only (seat optional)", () => {
		expectAccepts(appRouter.sessionTablePlayer.addTemporary, {
			liveCashGameSessionId: "lcg1",
		});
	});

	it("accepts seat position", () => {
		expectAccepts(appRouter.sessionTablePlayer.addTemporary, {
			liveCashGameSessionId: "lcg1",
			seatPosition: 3,
		});
	});

	it("rejects seat position > 8", () => {
		expectRejects(appRouter.sessionTablePlayer.addTemporary, {
			liveCashGameSessionId: "lcg1",
			seatPosition: 9,
		});
	});
});
