import { TAG_COLOR_NAMES } from "@sapphire2/db/constants/player-tag-colors";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { createCaller } from "./caller";
import {
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
	getInputSchema,
} from "./test-utils";

const writers = [
	["create", appRouter.playerTag.create, {}],
	["update", appRouter.playerTag.update, { id: "pt1" }],
] as const;

describe("playerTag router structure", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.playerTag).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.playerTag, {
			create: "mutation",
			delete: "mutation",
			list: "query",
			update: "mutation",
		});
	});
});

describe("playerTag procedure behavior", () => {
	it("playerTag.list returns all tags filtered by userId", async () => {
		const rows = [
			{ color: "blue", id: "pt-1", name: "friends", userId: "user-1" },
			{ color: "red", id: "pt-2", name: "rivals", userId: "user-1" },
		];
		const { caller, selectWhereParams } = createCaller({
			select: { player_tag: rows },
		});

		const result = await caller.playerTag.list();

		expect(result).toEqual(rows);
		expect(selectWhereParams).toContainEqual(["user-1"]);
	});

	it("playerTag.create returns tag with all fields set", async () => {
		const created = {
			color: "blue",
			id: "pt-new",
			name: "friends",
			updatedAt: new Date("2026-01-01T00:00:00Z"),
			userId: "user-1",
		};
		const { caller, inserted } = createCaller({
			select: { player_tag: [created] },
		});

		const result = await caller.playerTag.create({
			color: "blue",
			name: "friends",
		});

		expect(result).toEqual(created);
		expect(Object.keys(inserted.player_tag[0] as object).sort()).toEqual(
			["color", "id", "name", "updatedAt", "userId"].sort()
		);
		expect(inserted.player_tag[0]).toMatchObject({
			color: "blue",
			name: "friends",
			userId: "user-1",
		});
		expect(
			(inserted.player_tag[0] as { updatedAt: unknown }).updatedAt
		).toBeInstanceOf(Date);
	});

	it("playerTag.update returns updated tag and validates ownership", async () => {
		const owned = createCaller({
			select: {
				player_tag: [
					{ color: "blue", id: "pt-1", name: "old", userId: "user-1" },
				],
			},
		});

		const result = await owned.caller.playerTag.update({
			id: "pt-1",
			name: "new-name",
		});

		expect(result).toMatchObject({ id: "pt-1", userId: "user-1" });
		expect(owned.updated.player_tag[0]).toEqual({ name: "new-name" });

		const unowned = createCaller({
			select: {
				player_tag: [
					{ color: "blue", id: "pt-1", name: "old", userId: "other-user" },
				],
			},
		});

		await expect(
			unowned.caller.playerTag.update({ color: "red", id: "pt-1" })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

describe("playerTag.update color pass-through", () => {
	it("writes the color field on the owned tag", async () => {
		const { caller, updated } = createCaller({
			select: {
				player_tag: [
					{ color: "blue", id: "pt-1", name: "old", userId: "user-1" },
				],
			},
		});

		await caller.playerTag.update({ id: "pt-1", color: "red" });

		expect(updated.player_tag[0]).toMatchObject({ color: "red" });
	});
});

describe("playerTag.create input validation", () => {
	it("defaults color to gray when only a name is given", () => {
		const schema = getInputSchema(appRouter.playerTag.create);
		const parsed = schema.safeParse({ name: "friends" }) as unknown as {
			success: true;
			data: { color: string };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.color).toBe("gray");
	});

	it("accepts every known tag color", () => {
		for (const color of TAG_COLOR_NAMES) {
			expectAccepts(appRouter.playerTag.create, { name: "tag", color });
		}
	});
});

describe("playerTag name and color validation", () => {
	it.each(writers)("%s rejects an unknown color", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "tag", color: "neon_pink" });
	});

	it.each(writers)("%s rejects an empty name", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "" });
	});

	it.each(
		writers
	)("%s accepts a name at exactly 50 characters", (_name, procedure, base) => {
		expectAccepts(procedure, { ...base, name: "a".repeat(50) });
	});

	it.each(
		writers
	)("%s rejects a name exceeding 50 characters", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "a".repeat(51) });
	});
});
