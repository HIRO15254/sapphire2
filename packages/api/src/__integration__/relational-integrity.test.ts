import { user } from "@sapphire2/db/schema/auth";
import { currency, currencyTransaction } from "@sapphire2/db/schema/currency";
import { player, playerToPlayerTag } from "@sapphire2/db/schema/player";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
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
					"INSERT INTO player_to_player_tag (player_id, player_tag_id, position) VALUES (?, 'absent-tag', 0)"
				)
				.bind(saved.id)
				.run()
		).rejects.toThrow("FOREIGN KEY constraint failed");
		expect(await api.db.select().from(player)).toHaveLength(1);
		expect(await api.db.select().from(playerToPlayerTag)).toEqual([]);
	});

	test("preserves recorded session snapshots while deleted room, currency and ring-game links become null", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Local chips" })
		);
		await api.db.insert(room).values({
			id: "old-room",
			userId: "alice",
			name: "Old room",
			updatedAt: day,
		});
		await api.db.insert(ringGame).values({
			id: "old-game",
			userId: "alice",
			roomId: "old-room",
			currencyId: wallet.id,
			name: "Old game",
			updatedAt: day,
		});
		await api.db.insert(gameSession).values({
			id: "history",
			userId: "alice",
			kind: "cash_game",
			status: "completed",
			source: "manual",
			sessionDate: day,
			roomId: "old-room",
			currencyId: wallet.id,
			updatedAt: day,
		});
		await api.db.insert(sessionCashDetail).values({
			sessionId: "history",
			ringGameId: "old-game",
			ruleName: "Recorded game",
			buyIn: 100,
			cashOut: 150,
		});
		await api.db.delete(room).where(eq(room.id, "old-room"));
		await api.db.delete(currency).where(eq(currency.id, wallet.id));
		expect(await api.db.select().from(gameSession)).toEqual([
			expect.objectContaining({
				id: "history",
				roomId: null,
				currencyId: null,
			}),
		]);
		expect(await api.db.select().from(sessionCashDetail)).toEqual([
			expect.objectContaining({
				sessionId: "history",
				ringGameId: null,
				ruleName: "Recorded game",
				buyIn: 100,
				cashOut: 150,
			}),
		]);
	});

	test("deleting one account cascades its sessions, events and player links while preserving the other account", async ({
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
			await api.alice.currency.create({ name: "Owned wallet" })
		);
		const kind = requireCreatedRow(
			await api.alice.transactionType.create({ name: "Adjustment" })
		);
		await api.db.insert(gameSession).values({
			id: "owned-session",
			userId: "alice",
			kind: "cash_game",
			status: "completed",
			source: "manual",
			sessionDate: day,
			updatedAt: day,
		});
		await api.db
			.insert(sessionCashDetail)
			.values({ sessionId: "owned-session" });
		await api.db.insert(sessionEvent).values({
			id: "owned-event",
			sessionId: "owned-session",
			eventType: "session_start",
			payload: "{}",
			occurredAt: day,
			sortOrder: 0,
		});
		await api.alice.currencyTransaction.create({
			currencyId: wallet.id,
			transactionTypeId: kind.id,
			amount: 100,
			transactedAt: "2026-09-05",
		});
		await api.db.delete(user).where(eq(user.id, "alice"));
		expect(await api.db.select().from(gameSession)).toEqual([]);
		expect(await api.db.select().from(sessionCashDetail)).toEqual([]);
		expect(await api.db.select().from(sessionEvent)).toEqual([]);
		expect(await api.db.select().from(currencyTransaction)).toEqual([]);
		expect(await api.db.select().from(playerToPlayerTag)).toEqual([]);
		expect(await api.bob.player.list()).toEqual([
			expect.objectContaining({ id: bobPlayer.id, name: "Bob stays" }),
		]);
	});

	test("manual sessions must be completed and concurrent unfinished live sessions are unique per owner", async ({
		api,
	}) => {
		await expect(
			api.d1
				.prepare(
					"INSERT INTO game_session (id, user_id, kind, status, source, session_date, updated_at) VALUES ('invalid-manual', 'alice', 'cash_game', 'active', 'manual', 0, 0)"
				)
				.run()
		).rejects.toThrow("CHECK constraint failed");
		const create = (id: string, userId: string) =>
			api.db.insert(gameSession).values({
				id,
				userId,
				kind: "cash_game",
				status: "active",
				source: "live",
				sessionDate: day,
				updatedAt: day,
			});
		const results = await Promise.allSettled([
			create("race-a", "alice"),
			create("race-b", "alice"),
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
				.from(gameSession)
				.where(eq(gameSession.userId, "alice"))
		).toHaveLength(1);
		await create("bob-active", "bob");
		await api.db
			.update(gameSession)
			.set({ status: "completed" })
			.where(eq(gameSession.userId, "alice"));
		await create("alice-next", "alice");
		expect(await api.db.select().from(gameSession)).toHaveLength(3);
	});
});
