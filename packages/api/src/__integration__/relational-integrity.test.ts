import { user } from "@sapphire2/db/schema/auth";
import { entry, playEvent, playSession } from "@sapphire2/db/schema/entry";
import { ledgerCategory, ledgerLine } from "@sapphire2/db/schema/ledger";
import { player, playerTagLink } from "@sapphire2/db/schema/player";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

const day = new Date("2026-09-05T00:00:00.000Z");

describe("installed D1 referential integrity", () => {
	test("rejects duplicate account emails and OAuth client, access and refresh tokens without replacing existing rows", async ({
		api,
	}) => {
		await expect(
			api.d1
				.prepare(
					"INSERT INTO user (id, name, email, updated_at) VALUES ('duplicate-user', 'Duplicate', 'alice@example.test', 0)"
				)
				.run()
		).rejects.toThrow("UNIQUE constraint failed: user.email");
		const insertClient = (id: string) =>
			api.d1
				.prepare(
					`INSERT INTO oauth_client (id, client_id, redirect_uris) VALUES (?, 'client-key', '["https://example.test/callback"]')`
				)
				.bind(id)
				.run();
		await insertClient("client");
		await expect(insertClient("duplicate-client")).rejects.toThrow(
			"UNIQUE constraint failed: oauth_client.client_id"
		);
		const insertToken = (table: string, id: string, token: string) =>
			api.d1
				.prepare(
					`INSERT INTO ${table} (id, token, client_id, user_id, scopes) VALUES (?, ?, 'client-key', 'alice', '["openid"]')`
				)
				.bind(id, token)
				.run();
		for (const table of ["oauth_access_token", "oauth_refresh_token"]) {
			await insertToken(table, "token", "token-key");
			await expect(
				insertToken(table, "duplicate-token", "token-key")
			).rejects.toThrow(`UNIQUE constraint failed: ${table}.token`);
		}
		expect(
			(await api.db.select().from(user)).map(({ id }) => id).sort()
		).toEqual(["alice", "bob"]);
		expect(
			(await api.d1.prepare("SELECT id FROM oauth_client").all()).results
		).toEqual([{ id: "client" }]);
		for (const table of ["oauth_access_token", "oauth_refresh_token"]) {
			expect(
				(await api.d1.prepare(`SELECT id, token FROM ${table}`).all()).results
			).toEqual([{ id: "token", token: "token-key" }]);
		}
	});

	test("rejects dangling foreign keys instead of persisting orphan players or tag links", async ({
		api,
	}) => {
		await expect(
			api.d1
				.prepare(
					"INSERT INTO player (id, user_id, name, updated_at) VALUES ('orphan', 'absent-user', 'Orphan', 0)"
				)
				.run()
		).rejects.toThrow("FOREIGN KEY constraint failed");
		const saved = requireCreatedRow(
			await api.alice.player.create({ name: "Valid parent" })
		);
		await expect(
			api.d1
				.prepare(
					"INSERT INTO player_tag_link (user_id, player_id, tag_id, position) VALUES ('alice', ?, 'absent-tag', 0)"
				)
				.bind(saved.id)
				.run()
		).rejects.toThrow("FOREIGN KEY constraint failed");
		expect(await api.db.select().from(player)).toHaveLength(1);
		expect(await api.db.select().from(playerTagLink)).toEqual([]);
	});

	test("deleting one account cascades its entries, events, ledger and player links while preserving the other account", async ({
		api,
	}) => {
		const tag = requireCreatedRow(
			await api.alice.playerTag.create({ name: "Owned" })
		);
		await api.alice.player.create({ name: "Owned player", tagIds: [tag.id] });
		const bobPlayer = requireCreatedRow(
			await api.bob.player.create({ name: "Bob stays" })
		);
		const wallet = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "Owned wallet" })
		);
		const category = requireCreatedRow(
			await api.alice.ledgerCategory.create({ name: "Deposit" })
		);
		await api.db.insert(entry).values({
			id: "owned-entry",
			kind: "cash",
			playedOn: "2026-09-05",
			source: "live",
			status: "open",
			updatedAt: day,
			userId: "alice",
		});
		await api.db.insert(playSession).values({
			entryId: "owned-entry",
			id: "owned-play",
			kind: "cash",
			localDate: "2026-09-05",
			seq: 1,
			status: "active",
			updatedAt: day,
			userId: "alice",
		});
		await api.db.insert(playEvent).values({
			entryId: "owned-entry",
			id: "owned-event",
			occurredAt: day,
			payload: "{}",
			playSessionId: "owned-play",
			schemaVersion: 1,
			sortOrder: 0,
			type: "session_start",
			updatedAt: day,
			userId: "alice",
		});
		await api.alice.ledger.createAdjustment({
			assetId: wallet.id,
			categoryId: category.id,
			occurredAt: day.getTime() / 1000,
			quantity: 100,
		});
		await api.db.delete(user).where(eq(user.id, "alice"));
		expect(await api.db.select().from(entry)).toEqual([]);
		expect(await api.db.select().from(playSession)).toEqual([]);
		expect(await api.db.select().from(playEvent)).toEqual([]);
		expect(await api.db.select().from(ledgerLine)).toEqual([]);
		expect(await api.db.select().from(ledgerCategory)).toEqual([]);
		expect(await api.db.select().from(playerTagLink)).toEqual([]);
		expect(await api.bob.player.list()).toEqual([
			expect.objectContaining({ id: bobPlayer.id, name: "Bob stays" }),
		]);
	});
});
