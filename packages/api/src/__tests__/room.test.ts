import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

describe("room router", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.room).sort()).toEqual(
			["create", "delete", "getById", "list", "toggleFavorite", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.room, {
			create: "mutation",
			delete: "mutation",
			getById: "query",
			list: "query",
			toggleFavorite: "mutation",
			update: "mutation",
		});
	});
});

describe("room.create input validation", () => {
	it("rejects empty name", () => {
		expectRejects(appRouter.room.create, { name: "" });
	});

	it("accepts name + coordinates", () => {
		expectAccepts(appRouter.room.create, {
			name: "Casino Tokyo",
			latitude: 35.6812,
			longitude: 139.7671,
		});
	});

	it("rejects out-of-range coordinates", () => {
		expectRejects(appRouter.room.create, {
			name: "x",
			latitude: 91,
			longitude: 0,
		});
		expectRejects(appRouter.room.create, {
			name: "x",
			latitude: 0,
			longitude: -181,
		});
	});

	it("rejects a single coordinate without its pair", () => {
		expectRejects(appRouter.room.create, { name: "x", latitude: 35.6 });
		expectRejects(appRouter.room.create, { name: "x", longitude: 139.7 });
	});
});

describe("room.update input validation", () => {
	it("accepts memo cleared to null", () => {
		expectAccepts(appRouter.room.update, { id: "r1", memo: null });
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.room.update, { id: "r1", name: "" });
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

	it.each([
		{ latitude: 90.1, longitude: 0 },
		{ latitude: -90.1, longitude: 0 },
		{ latitude: 0, longitude: 180.1 },
		{ latitude: 0, longitude: -180.1 },
	])("rejects out-of-range coordinates %o", (coordinates) => {
		expectRejects(appRouter.room.update, { id: "r1", ...coordinates });
	});

	it("rejects a single coordinate without its pair", () => {
		expectRejects(appRouter.room.update, { id: "r1", latitude: 35.6 });
		expectRejects(appRouter.room.update, { id: "r1", longitude: 139.7 });
	});

	it("rejects one coordinate cleared while the other is set", () => {
		expectRejects(appRouter.room.update, {
			id: "r1",
			latitude: 35.6,
			longitude: null,
		});
	});
});
