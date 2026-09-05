import { transactionType } from "@sapphire2/db/schema/currency";
import { filterPreset } from "@sapphire2/db/schema/filter-preset";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { blindLevel, tournament } from "@sapphire2/db/schema/tournament";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { ensureSessionResultTypeId } from "../services/session-result-type";
import { test } from "./test-fixture";

const instant = new Date("2026-09-05T03:04:05.000Z");

describe("stored defaults and value encoding", () => {
	test("persists the passkey plugin fields and enforces credential uniqueness and owner deletion", async ({
		api,
	}) => {
		const createdAfter = Math.floor(Date.now() / 1000) * 1000;
		const credential = {
			id: "alice-passkey",
			userId: "alice",
			publicKey: "public-key",
			credentialID: "credential-alice",
			counter: 0,
			deviceType: "multiDevice",
			backedUp: false,
		};
		await api.db.insert(schema.passkey).values(credential);
		const [saved] = await api.db.select().from(schema.passkey);
		expect(saved).toEqual({
			...credential,
			name: null,
			transports: null,
			aaguid: null,
			createdAt: expect.any(Date),
		});
		expect(saved?.createdAt.getTime()).toBeGreaterThanOrEqual(createdAfter);
		expect(saved?.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
		await expect(
			api.d1
				.prepare(
					"INSERT INTO passkey (id, user_id, public_key, credential_id, counter, device_type, backed_up) VALUES ('duplicate', 'bob', 'another-key', 'credential-alice', 0, 'singleDevice', 0)"
				)
				.run()
		).rejects.toThrow("UNIQUE constraint failed: passkey.credential_id");
		await api.db.insert(schema.passkey).values({
			...credential,
			id: "bob-passkey",
			userId: "bob",
			credentialID: "credential-bob",
			backedUp: true,
			name: "Bob device",
			transports: "internal",
			aaguid: "test-aaguid",
		});
		await api.db.delete(user).where(eq(user.id, "alice"));
		expect(await api.db.select().from(schema.passkey)).toEqual([
			expect.objectContaining({
				id: "bob-passkey",
				userId: "bob",
				credentialID: "credential-bob",
				backedUp: true,
				name: "Bob device",
				transports: "internal",
				aaguid: "test-aaguid",
			}),
		]);
	});

	test("concurrent Session Result initialization converges on one stored type while unrelated names and accounts remain independent", async ({
		api,
	}) => {
		const [first, second] = await Promise.all([
			ensureSessionResultTypeId(api.db, "alice"),
			ensureSessionResultTypeId(api.db, "alice"),
		]);
		expect(first).toBe(second);
		const insert = (id: string, userId: string, name: string) =>
			api.d1
				.prepare(
					"INSERT INTO transaction_type (id, user_id, name, updated_at) VALUES (?, ?, ?, 0)"
				)
				.bind(id, userId, name)
				.run();
		await expect(
			insert("duplicate", "alice", "Session Result")
		).rejects.toThrow("UNIQUE constraint failed: transaction_type.user_id");
		await insert("bob-result", "bob", "Session Result");
		await insert("normal-one", "alice", "Adjustment");
		await insert("normal-two", "alice", "Adjustment");
		expect(
			(await api.db.select().from(transactionType))
				.map(({ id, userId, name }) => ({ id, userId, name }))
				.sort((a, b) => a.id.localeCompare(b.id))
		).toEqual(
			[
				{ id: first, userId: "alice", name: "Session Result" },
				{ id: "bob-result", userId: "bob", name: "Session Result" },
				{ id: "normal-one", userId: "alice", name: "Adjustment" },
				{ id: "normal-two", userId: "alice", name: "Adjustment" },
			].sort((a, b) => a.id.localeCompare(b.id))
		);
	});

	test("round trips JSON game groups, false, zero, coordinates and timestamps while keeping readable default variants", async ({
		api,
	}) => {
		const games = [
			{
				name: "Big Bet",
				variants: ["NL Hold'em", "Pot Limit Omaha"],
				blind1: 0,
				blind2: 100,
			},
		];
		await api.db.insert(room).values({
			id: "room",
			userId: "alice",
			name: "Room",
			latitude: 35.5,
			longitude: 139.125,
			updatedAt: instant,
		});
		await api.db.insert(ringGame).values({
			id: "ring",
			roomId: "room",
			userId: "alice",
			name: "Game",
			mixGames: games,
			archivedAt: instant,
			updatedAt: instant,
		});
		await api.db.insert(tournament).values({
			id: "tournament",
			roomId: "room",
			name: "Tournament",
			updatedAt: instant,
		});
		await api.db.insert(gameSession).values([
			{
				id: "cash",
				userId: "alice",
				kind: "cash_game",
				status: "completed",
				source: "manual",
				sessionDate: instant,
				updatedAt: instant,
			},
			{
				id: "tour",
				userId: "alice",
				kind: "tournament",
				status: "completed",
				source: "manual",
				sessionDate: instant,
				updatedAt: instant,
			},
		]);
		await api.db
			.insert(sessionCashDetail)
			.values({ sessionId: "cash", mixGames: games });
		await api.db
			.insert(sessionTournamentDetail)
			.values({ sessionId: "tour", timerStartedAt: instant });
		await api.db.insert(blindLevel).values({
			id: "master-level",
			tournamentId: "tournament",
			level: 1,
			games,
		});
		await api.db
			.insert(sessionBlindLevel)
			.values({ id: "snapshot-level", sessionId: "tour", level: 1, games });
		expect(await api.db.select().from(room)).toEqual([
			expect.objectContaining({
				latitude: 35.5,
				longitude: 139.125,
				updatedAt: instant,
			}),
		]);
		expect(await api.db.select().from(ringGame)).toEqual([
			expect.objectContaining({
				variant: "NL Hold'em",
				mixGames: games,
				archivedAt: instant,
			}),
		]);
		expect(await api.db.select().from(tournament)).toEqual([
			expect.objectContaining({ variant: "NL Hold'em" }),
		]);
		expect(await api.db.select().from(sessionCashDetail)).toEqual([
			expect.objectContaining({ variant: "NL Hold'em", mixGames: games }),
		]);
		expect(await api.db.select().from(sessionTournamentDetail)).toEqual([
			expect.objectContaining({
				variant: "NL Hold'em",
				timerStartedAt: instant,
			}),
		]);
		expect(await api.db.select().from(blindLevel)).toEqual([
			expect.objectContaining({ games, isBreak: false }),
		]);
		expect(await api.db.select().from(sessionBlindLevel)).toEqual([
			expect.objectContaining({ games, isBreak: false }),
		]);
		expect(
			await api.d1
				.prepare("SELECT mix_games FROM ring_game WHERE id = 'ring'")
				.first("mix_games")
		).toBe(JSON.stringify(games));
	});

	test("round trips saved filter JSON and enforces name and default uniqueness within each account and screen", async ({
		api,
	}) => {
		const payload = { period: "all", display: "normalized" as const };
		await api.db.insert(filterPreset).values({
			id: "initial",
			userId: "alice",
			screenKey: "sessions",
			name: "All",
			payload,
			updatedAt: instant,
		});
		expect(await api.db.select().from(filterPreset)).toEqual([
			expect.objectContaining({
				payload,
				isDefault: false,
				updatedAt: instant,
			}),
		]);
		await api.db
			.update(filterPreset)
			.set({ isDefault: true })
			.where(eq(filterPreset.id, "initial"));
		const insert = (
			id: string,
			userId: string,
			screen: string,
			name: string,
			isDefault: number
		) =>
			api.d1
				.prepare(
					"INSERT INTO filter_preset (id, user_id, screen_key, name, payload, is_default, updated_at) VALUES (?, ?, ?, ?, '{}', ?, 0)"
				)
				.bind(id, userId, screen, name, isDefault)
				.run();
		await expect(
			insert("duplicate-name", "alice", "sessions", "All", 0)
		).rejects.toThrow("UNIQUE constraint failed");
		await expect(
			insert("duplicate-default", "alice", "sessions", "Other", 1)
		).rejects.toThrow("UNIQUE constraint failed");
		await insert("non-default", "alice", "sessions", "Other", 0);
		await insert("other-screen", "alice", "statistics", "All", 1);
		await insert("other-account", "bob", "sessions", "All", 1);
		expect(
			(await api.db.select().from(filterPreset)).map(({ id }) => id).sort()
		).toEqual(["initial", "non-default", "other-account", "other-screen"]);
	});
});

import { schema } from "@sapphire2/db/schema";
import { user } from "@sapphire2/db/schema/auth";
