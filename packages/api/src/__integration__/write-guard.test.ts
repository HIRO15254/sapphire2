import { room } from "@sapphire2/db/schema/room";
import { eq, type SQL, sql } from "drizzle-orm";
import { describe, expect } from "vitest";
import { CONCURRENT_CHANGE_MESSAGE } from "../concurrent-change";
import {
	changedRowsGuardStatement,
	guardStatement,
	runGuardedBatch,
} from "../lib/write-guard";
import { type ApiFixture, test } from "./test-fixture";

const ROOM_ID = "room-1";

async function seedRoom(api: ApiFixture) {
	await api.db.insert(room).values({
		id: ROOM_ID,
		userId: "alice",
		name: "Before",
		updatedAt: new Date("2026-09-05T00:00:00.000Z"),
	});
}

function rename(api: ApiFixture, name: string, id = ROOM_ID) {
	return api.db.update(room).set({ name }).where(eq(room.id, id));
}

async function roomName(api: ApiFixture) {
	const [row] = await api.db
		.select({ name: room.name })
		.from(room)
		.where(eq(room.id, ROOM_ID));
	return row?.name;
}

describe("write guard", () => {
	test("a false or NULL precondition rolls the whole batch back as CONFLICT", async ({
		api,
	}) => {
		await seedRoom(api);
		const failing: SQL[] = [sql`0`, sql`NULL`];
		for (const condition of failing) {
			await expect(
				runGuardedBatch(api.db, [
					rename(api, "After"),
					guardStatement(api.db, "test", condition),
				])
			).rejects.toMatchObject({
				code: "CONFLICT",
				message: CONCURRENT_CHANGE_MESSAGE,
			});
			expect(await roomName(api)).toBe("Before");
		}
		await runGuardedBatch(api.db, [
			guardStatement(api.db, "test", sql`1`),
			rename(api, "After"),
		]);
		expect(await roomName(api)).toBe("After");
	});

	test("the changed-rows guard fails the batch when the guarded write matched nothing", async ({
		api,
	}) => {
		await seedRoom(api);
		await expect(
			runGuardedBatch(api.db, [
				rename(api, "After"),
				rename(api, "Ghost", "missing"),
				changedRowsGuardStatement(api.db, "test"),
			])
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await roomName(api)).toBe("Before");
		await runGuardedBatch(api.db, [
			rename(api, "After"),
			changedRowsGuardStatement(api.db, "test"),
		]);
		expect(await roomName(api)).toBe("After");
	});
});
