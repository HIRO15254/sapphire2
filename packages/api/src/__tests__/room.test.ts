import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("room router", () => {
	it("appRouter has room namespace", () => {
		expect(appRouter.room).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.room.list).toBeDefined();
	});

	it("has getById procedure", () => {
		expect(appRouter.room.getById).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.room.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.room.update).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.room.delete).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.room).sort()).toEqual(
			["create", "delete", "getById", "list", "toggleFavorite", "update"].sort()
		);
	});

	it("list / getById are protected queries", () => {
		expectProtected(appRouter.room.list);
		expectType(appRouter.room.list, "query");
		expectProtected(appRouter.room.getById);
		expectType(appRouter.room.getById, "query");
	});

	it("create / update / delete / toggleFavorite are protected mutations", () => {
		for (const proc of [
			appRouter.room.create,
			appRouter.room.update,
			appRouter.room.delete,
			appRouter.room.toggleFavorite,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("room.getById input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.room.getById, { id: "r1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.room.getById, {});
	});
});

describe("room.create input validation", () => {
	it("accepts minimal payload (name only)", () => {
		expectAccepts(appRouter.room.create, { name: "Casino Tokyo" });
	});

	it("accepts name + memo", () => {
		expectAccepts(appRouter.room.create, {
			name: "Casino Tokyo",
			memo: "weekly visits",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.room.create, { name: "" });
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.room.create, {});
	});

	it("rejects non-string memo", () => {
		expectRejects(appRouter.room.create, {
			name: "x",
			memo: 123,
		});
	});

	it("accepts name + coordinates", () => {
		expectAccepts(appRouter.room.create, {
			name: "Casino Tokyo",
			latitude: 35.6812,
			longitude: 139.7671,
		});
	});

	it("rejects out-of-range coordinates", () => {
		expectRejects(appRouter.room.create, { name: "x", latitude: 91 });
		expectRejects(appRouter.room.create, { name: "x", longitude: -181 });
	});
});

describe("room.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.room.update, { id: "r1" });
	});

	it("accepts name change", () => {
		expectAccepts(appRouter.room.update, { id: "r1", name: "Renamed" });
	});

	it("accepts memo change", () => {
		expectAccepts(appRouter.room.update, { id: "r1", memo: "new memo" });
	});

	it("accepts memo cleared to null", () => {
		expectAccepts(appRouter.room.update, { id: "r1", memo: null });
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.room.update, { id: "r1", name: "" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.room.update, { name: "x" });
	});

	it("accepts latitude + longitude", () => {
		expectAccepts(appRouter.room.update, {
			id: "r1",
			latitude: 35.6812,
			longitude: 139.7671,
		});
	});

	it("accepts latitude/longitude cleared to null", () => {
		expectAccepts(appRouter.room.update, {
			id: "r1",
			latitude: null,
			longitude: null,
		});
	});

	it("accepts boundary coordinates", () => {
		expectAccepts(appRouter.room.update, {
			id: "r1",
			latitude: -90,
			longitude: -180,
		});
		expectAccepts(appRouter.room.update, {
			id: "r1",
			latitude: 90,
			longitude: 180,
		});
	});

	it("rejects latitude above 90", () => {
		expectRejects(appRouter.room.update, { id: "r1", latitude: 90.1 });
	});

	it("rejects latitude below -90", () => {
		expectRejects(appRouter.room.update, { id: "r1", latitude: -90.1 });
	});

	it("rejects longitude above 180", () => {
		expectRejects(appRouter.room.update, { id: "r1", longitude: 180.1 });
	});

	it("rejects longitude below -180", () => {
		expectRejects(appRouter.room.update, { id: "r1", longitude: -180.1 });
	});

	it("rejects non-numeric latitude", () => {
		expectRejects(appRouter.room.update, { id: "r1", latitude: "35.6" });
	});

	it("rejects non-numeric longitude", () => {
		expectRejects(appRouter.room.update, { id: "r1", longitude: "139.7" });
	});
});

describe("room.delete input validation", () => {
	it("accepts valid id", () => {
		expectAccepts(appRouter.room.delete, { id: "r1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.room.delete, {});
	});
});

describe("room.toggleFavorite input validation", () => {
	it("accepts valid id", () => {
		expectAccepts(appRouter.room.toggleFavorite, { id: "r1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.room.toggleFavorite, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.room.toggleFavorite, { id: 123 });
	});
});
