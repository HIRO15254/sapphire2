import { describe, it } from "vitest";
import { appRouter } from "../routers";
import { expectAccepts, expectRejects } from "./test-utils";

describe("room.create input validation", () => {
	it("accepts name + coordinates", () => {
		expectAccepts(appRouter.room.create, {
			latitude: 35.6812,
			longitude: 139.7671,
			name: "Casino Tokyo",
		});
	});

	it("rejects a single coordinate without its pair", () => {
		expectRejects(appRouter.room.create, { latitude: 35.6, name: "x" });
		expectRejects(appRouter.room.create, { longitude: 139.7, name: "x" });
	});
});

describe("room.update input validation", () => {
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
