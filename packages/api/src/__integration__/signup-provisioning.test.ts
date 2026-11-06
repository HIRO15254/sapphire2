import { createDb } from "@sapphire2/db";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { player } from "@sapphire2/db/schema/player";
import { eq } from "drizzle-orm";
import { expect } from "vitest";
import { buildAuthOptions } from "../../../../apps/server/src/auth-options";
import { test } from "./test-fixture";

test("signup provisioning rolls back both self player and game seeds on batch failure", async ({
	api,
}) => {
	const failingD1 = new Proxy(api.d1, {
		get(target, property) {
			if (property === "batch") {
				return (statements: Parameters<typeof target.batch>[0]) =>
					target.batch([
						...statements,
						target.prepare("INSERT INTO user (id) VALUES ('invalid')"),
					]);
			}
			const value = Reflect.get(target, property);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	const db = createDb(failingD1 as unknown as Parameters<typeof createDb>[0]);
	const options = buildAuthOptions(
		{
			BETTER_AUTH_SECRET: "a".repeat(32),
			BETTER_AUTH_URL: "http://localhost:8787",
			CORS_ORIGIN: "http://localhost:3001",
		},
		db
	);
	await expect(options.onUserCreated?.("alice")).rejects.toThrow();
	expect(
		await api.db.select().from(player).where(eq(player.userId, "alice"))
	).toEqual([]);
	expect(
		await api.db.select().from(gameGroup).where(eq(gameGroup.userId, "alice"))
	).toEqual([]);
});
