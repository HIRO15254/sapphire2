import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("blindLevel router", () => {
	it("appRouter has blindLevel namespace", () => {
		expect(appRouter.blindLevel).toBeDefined();
	});

	it("has listByTournament procedure", () => {
		expect(appRouter.blindLevel.listByTournament).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.blindLevel.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.blindLevel.update).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.blindLevel.delete).toBeDefined();
	});

	it("has reorder procedure", () => {
		expect(appRouter.blindLevel.reorder).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.blindLevel).sort()).toEqual(
			["create", "delete", "listByTournament", "reorder", "update"].sort()
		);
	});

	it("listByTournament is a protected query", () => {
		expectProtected(appRouter.blindLevel.listByTournament);
		expectType(appRouter.blindLevel.listByTournament, "query");
	});

	it("create / update / delete / reorder are protected mutations", () => {
		for (const proc of [
			appRouter.blindLevel.create,
			appRouter.blindLevel.update,
			appRouter.blindLevel.delete,
			appRouter.blindLevel.reorder,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("blindLevel.listByTournament input validation", () => {
	it("accepts a tournamentId", () => {
		expectAccepts(appRouter.blindLevel.listByTournament, {
			tournamentId: "tn1",
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.blindLevel.listByTournament, {});
	});
});

describe("blindLevel.create input validation", () => {
	it("accepts minimal valid payload (tournamentId + level)", () => {
		expectAccepts(appRouter.blindLevel.create, {
			tournamentId: "tn1",
			level: 1,
		});
	});

	it("accepts full payload with all optional fields", () => {
		expectAccepts(appRouter.blindLevel.create, {
			tournamentId: "tn1",
			level: 2,
			isBreak: false,
			blind1: 100,
			blind2: 200,
			blind3: 25,
			ante: 25,
			minutes: 20,
		});
	});

	it("rejects non-integer level", () => {
		expectRejects(appRouter.blindLevel.create, {
			tournamentId: "tn1",
			level: 1.5,
		});
	});

	it("rejects non-integer blind1", () => {
		expectRejects(appRouter.blindLevel.create, {
			tournamentId: "tn1",
			level: 1,
			blind1: 1.5,
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.blindLevel.create, { level: 1 });
	});

	it("rejects missing level", () => {
		expectRejects(appRouter.blindLevel.create, { tournamentId: "tn1" });
	});
});

describe("blindLevel.update input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.blindLevel.update, { id: "bl1" });
	});

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

	it("accepts full field update", () => {
		expectAccepts(appRouter.blindLevel.update, {
			id: "bl1",
			level: 5,
			isBreak: true,
			blind1: 500,
			blind2: 1000,
			minutes: 15,
		});
	});

	it("rejects non-integer level", () => {
		expectRejects(appRouter.blindLevel.update, { id: "bl1", level: 1.5 });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.blindLevel.update, { level: 1 });
	});
});

describe("blindLevel.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.blindLevel.delete, { id: "bl1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.blindLevel.delete, {});
	});
});

describe("blindLevel.reorder input validation", () => {
	it("accepts tournamentId + array of levelIds (empty allowed)", () => {
		expectAccepts(appRouter.blindLevel.reorder, {
			tournamentId: "tn1",
			levelIds: [],
		});
		expectAccepts(appRouter.blindLevel.reorder, {
			tournamentId: "tn1",
			levelIds: ["bl1", "bl2", "bl3"],
		});
	});

	it("rejects missing levelIds", () => {
		expectRejects(appRouter.blindLevel.reorder, { tournamentId: "tn1" });
	});

	it("rejects non-string entries in levelIds", () => {
		expectRejects(appRouter.blindLevel.reorder, {
			tournamentId: "tn1",
			levelIds: ["bl1", 2],
		});
	});
});
