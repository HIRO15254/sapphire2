import { room } from "@sapphire2/db/schema/room";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	createChainableMockDb,
	DEFAULT_CALLER_USER_ID,
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

type Rows = Record<string, unknown>[];

const ROOM_TABLE = getTableName(room);
const CALLER = DEFAULT_CALLER_USER_ID;

function roomCaller(userId: string, select: Record<string, Rows>) {
	const mock = createChainableMockDb({ select });
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db: mock.db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).room;
	return { caller, ...mock };
}

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

describe("room.list", () => {
	it("returns rooms owned by the caller", async () => {
		const rows = [
			{ id: "r1", userId: CALLER, name: "Room1", isFavorite: false },
			{ id: "r2", userId: CALLER, name: "Room2", isFavorite: true },
		];
		const { caller, db } = roomCaller(CALLER, {});
		db.select = () => ({
			from: () => ({
				where: () => ({ orderBy: () => Promise.resolve(rows) }),
			}),
		});
		const result = (await caller.list()) as { id: string }[];
		expect(result.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
	});
});

describe("room.getById", () => {
	it("returns the owned room", async () => {
		const { caller } = roomCaller(CALLER, {
			[ROOM_TABLE]: [
				{
					id: "r1",
					userId: CALLER,
					name: "Test",
					memo: null,
					isFavorite: false,
					latitude: null,
					longitude: null,
				},
			],
		});
		await expect(caller.getById({ id: "r1" })).resolves.toMatchObject({
			id: "r1",
			userId: CALLER,
			name: "Test",
		});
	});
});

describe("room.create", () => {
	it("inserts a new room and returns it", async () => {
		const { caller, inserted } = roomCaller(CALLER, { [ROOM_TABLE]: [] });
		await caller.create({
			name: "New Room",
			latitude: 35.6,
			longitude: 139.7,
		});
		expect(inserted[ROOM_TABLE]).toHaveLength(1);
		expect(inserted[ROOM_TABLE]?.[0]).toMatchObject({
			userId: CALLER,
			name: "New Room",
			memo: null,
			latitude: 35.6,
			longitude: 139.7,
		});
	});
});

describe("room.update success", () => {
	it("applies changes to the owned room", async () => {
		const { caller, updated, updateWhereParams } = roomCaller(CALLER, {
			[ROOM_TABLE]: [{ id: "r1", userId: CALLER, name: "Old", memo: null }],
		});
		await caller.update({ id: "r1", name: "New", memo: "Updated" });
		expect(updateWhereParams).toHaveLength(1);
		expect(updateWhereParams[0]).toContain("r1");
		expect(updated[ROOM_TABLE]?.[0]).toMatchObject({
			name: "New",
			memo: "Updated",
		});
	});
});

describe("room.update coordinates", () => {
	it("applies latitude/longitude changes to the owned room", async () => {
		const { caller, updated } = roomCaller(CALLER, {
			[ROOM_TABLE]: [
				{ id: "r1", userId: CALLER, latitude: null, longitude: null },
			],
		});
		await caller.update({ id: "r1", latitude: 35.6, longitude: 139.7 });
		expect(updated[ROOM_TABLE]?.[0]).toMatchObject({
			latitude: 35.6,
			longitude: 139.7,
		});
	});
});

describe("room.delete success", () => {
	it("removes the owned room", async () => {
		const { caller, deleteWhereParams } = roomCaller(CALLER, {
			[ROOM_TABLE]: [{ id: "r1", userId: CALLER }],
		});
		await expect(caller.delete({ id: "r1" })).resolves.toEqual({
			success: true,
		});
		expect(deleteWhereParams).toHaveLength(1);
		expect(deleteWhereParams[0]).toContain("r1");
	});
});

describe("room.toggleFavorite success", () => {
	it("inverts the favorite flag on the owned room", async () => {
		const { caller, updated, updateWhereParams } = roomCaller(CALLER, {
			[ROOM_TABLE]: [{ id: "r1", userId: CALLER, isFavorite: false }],
		});
		await caller.toggleFavorite({ id: "r1" });
		expect(updateWhereParams).toHaveLength(1);
		expect(updateWhereParams[0]).toContain("r1");
		expect(updated[ROOM_TABLE]?.[0]).toMatchObject({ isFavorite: true });
	});
});
