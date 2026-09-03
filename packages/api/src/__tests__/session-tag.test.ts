import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { createCaller } from "./caller";
import {
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

describe("sessionTag router structure", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.sessionTag).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.sessionTag, {
			create: "mutation",
			delete: "mutation",
			list: "query",
			update: "mutation",
		});
	});
});

describe("sessionTag procedure behavior", () => {
	it("sessionTag.list returns all tags filtered by userId", async () => {
		const rows = [
			{ id: "st-1", name: "bankroll", userId: "user-1" },
			{ id: "st-2", name: "live", userId: "user-1" },
		];
		const { caller, selectWhereParams } = createCaller({
			select: { session_tag: rows },
		});

		const result = await caller.sessionTag.list();

		expect(result).toEqual(rows);
		expect(selectWhereParams).toContainEqual(["user-1"]);
	});

	it("sessionTag.create returns tag with id, userId, name", async () => {
		const created = { id: "st-new", name: "bankroll", userId: "user-1" };
		const { caller, inserted } = createCaller({
			select: { session_tag: [created] },
		});

		const result = await caller.sessionTag.create({ name: "bankroll" });

		expect(result).toEqual(created);
		expect(Object.keys(inserted.session_tag[0] as object).sort()).toEqual(
			["id", "name", "userId"].sort()
		);
		expect(inserted.session_tag[0]).toMatchObject({
			name: "bankroll",
			userId: "user-1",
		});
	});

	it("sessionTag.update returns updated tag and validates ownership", async () => {
		const owned = createCaller({
			select: { session_tag: [{ id: "st-1", name: "old", userId: "user-1" }] },
		});

		const result = await owned.caller.sessionTag.update({
			id: "st-1",
			name: "renamed",
		});

		expect(result).toMatchObject({ id: "st-1", userId: "user-1" });
		expect(owned.updated.session_tag[0]).toEqual({ name: "renamed" });

		const unowned = createCaller({
			select: {
				session_tag: [{ id: "st-1", name: "old", userId: "other-user" }],
			},
		});

		await expect(
			unowned.caller.sessionTag.update({ id: "st-1", name: "renamed" })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

describe("sessionTag.create input validation", () => {
	it("accepts a non-empty name", () => {
		expectAccepts(appRouter.sessionTag.create, { name: "bankroll" });
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.sessionTag.create, { name: "" });
	});
});

describe("sessionTag.update input validation", () => {
	it("accepts id + name", () => {
		expectAccepts(appRouter.sessionTag.update, {
			id: "st1",
			name: "renamed",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.sessionTag.update, { id: "st1", name: "" });
	});

	it("rejects missing name (unlike similar tag routers, update requires name)", () => {
		expectRejects(appRouter.sessionTag.update, { id: "st1" });
	});
});
