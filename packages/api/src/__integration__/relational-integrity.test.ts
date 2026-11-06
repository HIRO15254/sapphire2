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
					"INSERT INTO oauth_application (id, name, client_id, redirect_urls, type) VALUES (?, 'Test client', 'client-key', 'https://example.test/callback', 'public')"
				)
				.bind(id)
				.run();
		await insertClient("client");
		await expect(insertClient("duplicate-client")).rejects.toThrow(
			"UNIQUE constraint failed: oauth_application.client_id"
		);
		const insertToken = (id: string, access: string, refresh: string) =>
			api.d1
				.prepare(
					"INSERT INTO oauth_access_token (id, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, client_id, user_id, scopes) VALUES (?, ?, ?, 1000, 2000, 'client-key', 'alice', 'openid')"
				)
				.bind(id, access, refresh)
				.run();
		await insertToken("token", "access-key", "refresh-key");
		await expect(
			insertToken("duplicate-access", "access-key", "other-refresh")
		).rejects.toThrow(
			"UNIQUE constraint failed: oauth_access_token.access_token"
		);
		await expect(
			insertToken("duplicate-refresh", "other-access", "refresh-key")
		).rejects.toThrow(
			"UNIQUE constraint failed: oauth_access_token.refresh_token"
		);
		expect(
			(await api.db.select().from(user)).map(({ id }) => id).sort()
		).toEqual(["alice", "bob"]);
		expect(
			(await api.d1.prepare("SELECT id FROM oauth_application").all()).results
		).toEqual([{ id: "client" }]);
		expect(
			(
				await api.d1
					.prepare(
						"SELECT id, access_token, refresh_token FROM oauth_access_token"
					)
					.all()
			).results
		).toEqual([
			{ id: "token", access_token: "access-key", refresh_token: "refresh-key" },
		]);
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
			await api.alice.asset.create({ name: "Owned wallet", kind: "currency" })
		);
		const category = requireCreatedRow(
			await api.alice.ledgerCategory.create({ name: "Deposit" })
		);
		await api.db.insert(entry).values({
			id: "owned-entry",
			userId: "alice",
			kind: "cash",
			status: "open",
			source: "live",
			playedOn: "2026-09-05",
			updatedAt: day,
		});
		await api.db.insert(playSession).values({
			id: "owned-play",
			userId: "alice",
			entryId: "owned-entry",
			kind: "cash",
			seq: 1,
			localDate: "2026-09-05",
			status: "active",
			updatedAt: day,
		});
		await api.db.insert(playEvent).values({
			id: "owned-event",
			userId: "alice",
			entryId: "owned-entry",
			playSessionId: "owned-play",
			type: "session_start",
			schemaVersion: 1,
			payload: "{}",
			occurredAt: day,
			sortOrder: 0,
			updatedAt: day,
		});
		await api.alice.ledger.createAdjustment({
			assetId: wallet.id,
			quantity: 100,
			categoryId: category.id,
			occurredAt: day.getTime() / 1000,
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
