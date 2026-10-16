import type { Database } from "@sapphire2/db";
import { user } from "@sapphire2/db/schema/auth";
import { currency, currencyTransaction } from "@sapphire2/db/schema/currency";
import {
	entry,
	entryCash,
	entryTournament,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { player, playerToPlayerTag } from "@sapphire2/db/schema/player";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

const day = new Date("2026-09-05T00:00:00.000Z");

async function seedLiveEntry(
	db: Database,
	id: string,
	userId: "alice" | "bob",
	kind: "cash" | "tournament" = "cash"
) {
	await db.insert(gameSession).values({
		id,
		userId,
		kind: kind === "cash" ? "cash_game" : "tournament",
		source: "live",
		status: "completed",
		sessionDate: day,
		updatedAt: day,
	});
	await db.insert(entry).values({
		id,
		userId,
		kind,
		source: "live",
		status: "open",
		playedOn: "2026-09-05",
		updatedAt: day,
	});
	await db.insert(playSession).values({
		id: `${id}-play`,
		entryId: id,
		userId,
		kind,
		seq: 1,
		localDate: "2026-09-05",
		status: "active",
		startedAt: day,
		updatedAt: day,
	});
	if (kind === "cash") {
		await db.insert(entryCash).values({ entryId: id, userId });
		await db.insert(sessionCashDetail).values({ sessionId: id, tableSize: 6 });
	} else {
		await db.insert(entryTournament).values({ entryId: id, userId });
		await db
			.insert(sessionTournamentDetail)
			.values({ sessionId: id, tableSize: 6 });
	}
	await db.insert(playEvent).values({
		id: `${id}-start`,
		entryId: id,
		playSessionId: `${id}-play`,
		userId,
		type: "session_start",
		payload: "{}",
		occurredAt: day,
		sortOrder: 0,
		updatedAt: day,
	});
}

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

	test("preserves recorded snapshots and rejects deletion of referenced masters", async ({
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
		await api.db.insert(entry).values({
			id: "history",
			userId: "alice",
			kind: "cash",
			source: "manual",
			status: "settled",
			roomId: "old-room",
			assetId: wallet.id,
			playedOn: "2026-09-05",
			updatedAt: day,
		});
		await api.db
			.insert(entryCash)
			.values({ entryId: "history", userId: "alice", ringGameId: "old-game" });
		await api.db.insert(sessionCashDetail).values({
			sessionId: "history",
			ringGameId: "old-game",
			ruleName: "Recorded game",
			buyIn: 100,
			cashOut: 150,
		});
		await expect(
			api.db.delete(room).where(eq(room.id, "old-room"))
		).rejects.toMatchObject({
			cause: {
				message: expect.stringContaining("FOREIGN KEY constraint failed"),
			},
		});
		await expect(
			api.db.delete(currency).where(eq(currency.id, wallet.id))
		).rejects.toMatchObject({
			cause: {
				message: expect.stringContaining("FOREIGN KEY constraint failed"),
			},
		});
		expect(await api.db.select().from(entry)).toEqual([
			expect.objectContaining({
				id: "history",
				roomId: "old-room",
				assetId: wallet.id,
			}),
		]);
		expect(await api.db.select().from(sessionCashDetail)).toEqual([
			expect.objectContaining({
				sessionId: "history",
				ringGameId: "old-game",
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
		await api.db.insert(entry).values({
			id: "owned-session",
			userId: "alice",
			kind: "cash",
			source: "live",
			status: "open",
			playedOn: "2026-09-05",
			updatedAt: day,
		});
		await api.db.insert(playSession).values({
			id: "owned-play",
			entryId: "owned-session",
			userId: "alice",
			kind: "cash",
			seq: 1,
			status: "active",
			localDate: "2026-09-05",
			updatedAt: day,
		});
		await api.db.insert(playEvent).values({
			id: "owned-event",
			entryId: "owned-session",
			playSessionId: "owned-play",
			userId: "alice",
			type: "session_start",
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
		expect(await api.db.select().from(playEvent)).toEqual([]);
		expect(await api.db.select().from(playSession)).toEqual([]);
		expect(await api.db.select().from(entry)).toEqual([]);
		expect(await api.db.select().from(currencyTransaction)).toEqual([]);
		expect(await api.db.select().from(playerToPlayerTag)).toEqual([]);
		expect(await api.bob.player.list()).toEqual([
			expect.objectContaining({ id: bobPlayer.id, name: "Bob stays" }),
		]);
	});

	test("manual entries must be settled and concurrent unfinished plays are unique per owner", async ({
		api,
	}) => {
		await expect(
			api.db.insert(entry).values({
				id: "invalid-manual",
				userId: "alice",
				kind: "cash",
				source: "manual",
				status: "open",
				playedOn: "2026-09-05",
				updatedAt: day,
			})
		).rejects.toMatchObject({
			cause: { message: expect.stringContaining("CHECK constraint failed") },
		});
		for (const [id, userId] of [
			["race-a", "alice"],
			["race-b", "alice"],
			["bob-active", "bob"],
			["alice-next", "alice"],
		] as const) {
			await api.db.insert(entry).values({
				id,
				userId,
				kind: "cash",
				source: "live",
				status: "open",
				playedOn: "2026-09-05",
				updatedAt: day,
			});
		}
		const create = (id: string, userId: string) =>
			api.db.insert(playSession).values({
				id,
				userId,
				entryId: id,
				kind: "cash",
				seq: 1,
				status: "active",
				localDate: "2026-09-05",
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
				.from(playSession)
				.where(eq(playSession.userId, "alice"))
		).toHaveLength(1);
		await create("bob-active", "bob");
		await api.db
			.update(playSession)
			.set({ status: "ended", endState: "cashed_out" })
			.where(eq(playSession.userId, "alice"));
		await create("alice-next", "alice");
		expect(await api.db.select().from(playSession)).toHaveLength(3);
	});
});

describe("authoritative live event routers", () => {
	test("preserves event API shape and rejects foreign resources, invalid ordering and lifecycle deletion before writes", async ({
		api,
	}) => {
		await seedLiveEntry(api.db, "live", "alice");
		await seedLiveEntry(api.db, "foreign", "bob");
		const created = await api.alice.sessionEvent.create({
			sessionId: "live",
			playSessionId: "live-play",
			eventType: "memo",
			occurredAt: day.getTime() / 1000 + 120,
			payload: { text: "original" },
		});
		expect(created).toMatchObject({
			sessionId: "live",
			eventType: "memo",
			payload: { text: "original" },
			sortOrder: 1,
		});
		expect(created).not.toHaveProperty("entryId");
		expect(
			(
				await api.alice.sessionEvent.update({
					id: created.id,
					payload: { text: "edited" },
				})
			).payload
		).toEqual({ text: "edited" });
		for (const id of ["absent", "foreign-start"]) {
			await expect(
				api.alice.sessionEvent.update({ id, payload: {} })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(api.alice.sessionEvent.delete({ id })).rejects.toMatchObject(
				{ code: "FORBIDDEN" }
			);
		}
		for (const sessionId of ["absent", "foreign"]) {
			await expect(
				api.alice.sessionEvent.list({ sessionId })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
		await expect(
			api.alice.sessionEvent.create({
				sessionId: "live",
				playSessionId: "foreign-play",
				eventType: "memo",
				payload: { text: "wrong play" },
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		for (const eventType of ["session_start", "session_resume"] as const) {
			await expect(
				api.alice.sessionEvent.create({
					sessionId: "live",
					eventType,
					payload: {},
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		}
		await expect(
			api.alice.sessionEvent.create({
				sessionId: "live",
				eventType: "update_stack",
				payload: { stackAmount: -1 },
			})
		).rejects.toThrow();
		await expect(
			api.alice.sessionEvent.create({
				sessionId: "live",
				eventType: "memo",
				occurredAt: day.getTime() / 1000 + 60,
				payload: { text: "too early" },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.alice.sessionEvent.update({
				id: created.id,
				occurredAt: day.getTime() / 1000 - 60,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.alice.sessionEvent.update({
				id: "live-start",
				occurredAt: day.getTime() / 1000 + 180,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.alice.sessionEvent.delete({ id: "live-start" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(
			(await api.alice.sessionEvent.list({ sessionId: "live" })).map(
				({ id }) => id
			)
		).toEqual(["live-start", created.id]);
		await api.alice.sessionEvent.delete({ id: created.id });
		expect(
			await api.db.select().from(playEvent).where(eq(playEvent.entryId, "live"))
		).toHaveLength(1);
	});

	test("chip purchase events canonicalize owned snapshots on create and update and reject foreign players and purchases", async ({
		api,
	}) => {
		await seedLiveEntry(api.db, "tourney", "alice", "tournament");
		await seedLiveEntry(api.db, "other", "bob", "tournament");
		await api.db.insert(sessionChipPurchase).values({
			id: "purchase",
			sessionId: "tourney",
			name: "Rebuy",
			cost: 100,
			chips: 10_000,
		});
		await api.db.insert(sessionChipPurchase).values({
			id: "other-purchase",
			sessionId: "other",
			name: "Foreign",
			cost: 1,
			chips: 1,
		});
		const forged = {
			sessionChipPurchaseId: "purchase",
			name: "Forged",
			cost: 999,
			chips: 1,
		};
		const created = await api.alice.sessionEvent.create({
			sessionId: "tourney",
			eventType: "purchase_chips",
			payload: forged,
		});
		const snapshot = {
			sessionChipPurchaseId: "purchase",
			name: "Rebuy",
			cost: 100,
			chips: 10_000,
		};
		expect(created.payload).toEqual(snapshot);
		expect(
			(await api.alice.sessionEvent.update({ id: created.id, payload: forged }))
				.payload
		).toEqual(snapshot);
		for (const sessionChipPurchaseId of ["absent", "other-purchase"]) {
			const payload = { ...forged, sessionChipPurchaseId };
			await expect(
				api.alice.sessionEvent.create({
					sessionId: "tourney",
					eventType: "purchase_chips",
					payload,
				})
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(
				api.alice.sessionEvent.update({ id: created.id, payload })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
		const foreign = requireCreatedRow(
			await api.bob.player.create({ name: "Foreign" })
		);
		const owned = requireCreatedRow(
			await api.alice.player.create({ name: "Owned" })
		);
		for (const eventType of ["player_join", "player_leave"] as const) {
			for (const playerId of ["absent", foreign.id]) {
				await expect(
					api.alice.sessionEvent.create({
						sessionId: "tourney",
						eventType,
						payload: { playerId },
					})
				).rejects.toMatchObject({ code: "FORBIDDEN" });
			}
			const joined = await api.alice.sessionEvent.create({
				sessionId: "tourney",
				eventType,
				payload: { playerId: owned.id },
			});
			expect(joined.payload).toMatchObject({ playerId: owned.id });
			await expect(
				api.alice.sessionEvent.update({
					id: joined.id,
					payload: { playerId: foreign.id },
				})
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			const hero = await api.alice.sessionEvent.create({
				sessionId: "tourney",
				eventType,
				payload: { isHero: true },
			});
			expect(hero.payload).toMatchObject({ isHero: true });
		}
		expect(
			(await api.alice.sessionEvent.list({ sessionId: "tourney" })).find(
				({ id }) => id === created.id
			)?.payload
		).toEqual(snapshot);
	});

	test("table players retain seat stints, tags and temporary-player behavior using play events", async ({
		api,
	}) => {
		await seedLiveEntry(api.db, "table", "alice");
		await seedLiveEntry(api.db, "other-table", "bob");
		const tags = await api.createPlayerTags("alice", 34);
		const added = await api.alice.sessionTablePlayer.addNew({
			sessionId: "table",
			playerName: "Guest",
			playerMemo: "memo",
			playerTagIds: tags,
			seatPosition: 0,
		});
		expect(
			await api.db
				.select()
				.from(playerToPlayerTag)
				.where(eq(playerToPlayerTag.playerId, added.playerId))
		).toHaveLength(34);
		await expect(
			api.alice.sessionTablePlayer.add({
				sessionId: "table",
				playerId: added.playerId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.alice.sessionTablePlayer.updateSeat({
				sessionId: "table",
				playerId: added.playerId,
				seatPosition: 6,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await api.alice.sessionTablePlayer.updateSeat({
			sessionId: "table",
			playerId: added.playerId,
			seatPosition: 5,
		});
		expect(
			(
				await api.alice.sessionTablePlayer.list({
					sessionId: "table",
					activeOnly: true,
				})
			).items
		).toEqual([
			expect.objectContaining({
				id: added.playerId,
				seatPosition: 5,
				player: expect.objectContaining({ name: "Guest", memo: "memo" }),
			}),
		]);
		await api.alice.sessionTablePlayer.remove({
			sessionId: "table",
			playerId: added.playerId,
		});
		expect(
			(
				await api.alice.sessionTablePlayer.list({
					sessionId: "table",
					activeOnly: true,
				})
			).items
		).toEqual([]);
		await api.alice.sessionTablePlayer.add({
			sessionId: "table",
			playerId: added.playerId,
		});
		expect(
			(await api.alice.sessionTablePlayer.list({ sessionId: "table" })).items[0]
				?.stints
		).toHaveLength(2);
		const temporary = await api.alice.sessionTablePlayer.addTemporary({
			sessionId: "table",
		});
		expect(
			await api.db
				.select()
				.from(player)
				.where(eq(player.id, temporary.playerId))
		).toEqual([
			expect.objectContaining({
				isTemporary: true,
				name: "Anonymous",
				memo: null,
			}),
		]);
		const foreign = requireCreatedRow(
			await api.bob.player.create({ name: "Foreign" })
		);
		for (const playerId of [foreign.id, "absent"]) {
			await expect(
				api.alice.sessionTablePlayer.add({
					sessionId: "table",
					playerId,
					seatPosition: 9,
				})
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(
				api.alice.sessionTablePlayer.remove({ sessionId: "table", playerId })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(
				api.alice.sessionTablePlayer.updateSeat({
					sessionId: "table",
					playerId,
					seatPosition: null,
				})
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
		const foreignTag = requireCreatedRow(
			await api.bob.playerTag.create({ name: "Foreign" })
		);
		const before = await api.db.select().from(player);
		await expect(
			api.alice.sessionTablePlayer.addNew({
				sessionId: "table",
				playerName: "Rejected",
				playerTagIds: [foreignTag.id],
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(await api.db.select().from(player)).toEqual(before);
		for (const sessionId of ["absent", "other-table"]) {
			await expect(
				api.alice.sessionTablePlayer.list({ sessionId })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(
				api.alice.sessionTablePlayer.addTemporary({ sessionId })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
		const events = await api.db
			.select()
			.from(playEvent)
			.where(eq(playEvent.entryId, "table"));
		expect(
			events.map(({ sortOrder }) => sortOrder).sort((a, b) => a - b)
		).toEqual([0, 1, 2, 3, 4]);
		expect(
			events.every(({ occurredAt }) => occurredAt.getUTCSeconds() === 0)
		).toBe(true);
	});
});
