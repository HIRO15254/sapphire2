import { user } from "@sapphire2/db/schema/auth";
import {
	entry,
	entryCash,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { ledgerCategory, ledgerLine } from "@sapphire2/db/schema/ledger";
import { player, playerTagLink } from "@sapphire2/db/schema/player";
import { room } from "@sapphire2/db/schema/room";
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

	test("preserves referenced entry and rule snapshots when room, asset and ring-game deletion is attempted", async ({
		api,
	}) => {
		const nlh = (await api.alice.gameVariant.list()).find(
			(row) => row.builtinKey === "nlh"
		);
		if (!nlh) {
			throw new Error("missing builtin nlh");
		}
		const wallet = requireCreatedRow(
			await api.alice.asset.create({ name: "Local chips", kind: "currency" })
		);
		await api.db.insert(room).values({
			id: "old-room",
			userId: "alice",
			name: "Old room",
			updatedAt: day,
		});
		const oldGame = requireCreatedRow(
			await api.alice.ringGame.create({
				roomId: "old-room",
				defaultAssetId: wallet.id,
				name: "Old game",
				rule: {
					game: { variantId: nlh.id },
					stakes: [{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2 }],
				},
			})
		);
		await api.db.insert(entry).values({
			id: "history",
			userId: "alice",
			kind: "cash",
			status: "settled",
			source: "manual",
			playedOn: "2026-09-05",
			roomId: "old-room",
			assetId: wallet.id,
			updatedAt: day,
		});
		await api.db.insert(entryCash).values({
			entryId: "history",
			userId: "alice",
			ringGameId: oldGame.id,
			cashRuleId: oldGame.ruleVersion.id,
		});
		await expect(
			api.d1.prepare("DELETE FROM room WHERE id = ?").bind("old-room").run()
		).rejects.toThrow("FOREIGN KEY constraint failed");
		await expect(
			api.d1.prepare("DELETE FROM asset WHERE id = ?").bind(wallet.id).run()
		).rejects.toThrow("FOREIGN KEY constraint failed");
		await expect(
			api.d1
				.prepare("DELETE FROM ring_game WHERE id = ?")
				.bind(oldGame.id)
				.run()
		).rejects.toThrow("FOREIGN KEY constraint failed");
		expect(await api.db.select().from(entry)).toEqual([
			expect.objectContaining({
				id: "history",
				roomId: "old-room",
				assetId: wallet.id,
			}),
		]);
		expect(await api.db.select().from(entryCash)).toEqual([
			expect.objectContaining({
				entryId: "history",
				ringGameId: oldGame.id,
				cashRuleId: oldGame.ruleVersion.id,
			}),
		]);
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

	test("manual entries must be settled and concurrent unfinished play sessions are unique per owner", async ({
		api,
	}) => {
		await expect(
			api.d1
				.prepare(
					"INSERT INTO entry (id, user_id, kind, status, source, played_on, updated_at) VALUES ('invalid-manual', 'alice', 'cash', 'open', 'manual', '2026-09-05', 0)"
				)
				.run()
		).rejects.toThrow("CHECK constraint failed");
		await api.db.insert(entry).values([
			{
				id: "alice-entry",
				userId: "alice",
				kind: "cash",
				status: "open",
				source: "live",
				playedOn: "2026-09-05",
				updatedAt: day,
			},
			{
				id: "bob-entry",
				userId: "bob",
				kind: "cash",
				status: "open",
				source: "live",
				playedOn: "2026-09-05",
				updatedAt: day,
			},
		]);
		const create = (id: string, userId: string, entryId: string, seq: number) =>
			api.db.insert(playSession).values({
				id,
				userId,
				entryId,
				kind: "cash",
				seq,
				localDate: "2026-09-05",
				status: "active",
				updatedAt: day,
			});
		const results = await Promise.allSettled([
			create("race-a", "alice", "alice-entry", 1),
			create("race-b", "alice", "alice-entry", 2),
		]);
		expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
			1
		);
		expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
			1
		);
		expect(
			await api.db
				.select()
				.from(playSession)
				.where(eq(playSession.userId, "alice"))
		).toHaveLength(1);
		await create("bob-active", "bob", "bob-entry", 1);
		await api.db
			.update(playSession)
			.set({ status: "ended", endState: "finished" })
			.where(eq(playSession.userId, "alice"));
		await create("alice-next", "alice", "alice-entry", 3);
		expect(await api.db.select().from(playSession)).toHaveLength(3);
	});
});
