import { schema } from "@sapphire2/db/schema";
import { user } from "@sapphire2/db/schema/auth";
import { filterPreset } from "@sapphire2/db/schema/filter-preset";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { cashRuleStake } from "@sapphire2/db/schema/rule";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { test } from "./test-fixture";

const instant = new Date("2026-09-05T03:04:05.000Z");

describe("stored defaults and value encoding", () => {
	test("persists the passkey plugin fields and enforces credential uniqueness and owner deletion", async ({
		api,
	}) => {
		const createdAfter = Math.floor(Date.now() / 1000) * 1000;
		const credential = {
			backedUp: false,
			counter: 0,
			credentialID: "credential-alice",
			deviceType: "multiDevice",
			id: "alice-passkey",
			publicKey: "public-key",
			userId: "alice",
		};
		await api.db.insert(schema.passkey).values(credential);
		const [saved] = await api.db.select().from(schema.passkey);
		expect(saved).toEqual({
			...credential,
			aaguid: null,
			createdAt: expect.any(Date),
			name: null,
			transports: null,
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
			aaguid: "test-aaguid",
			backedUp: true,
			credentialID: "credential-bob",
			id: "bob-passkey",
			name: "Bob device",
			transports: "internal",
			userId: "bob",
		});
		await api.db.delete(user).where(eq(user.id, "alice"));
		expect(await api.db.select().from(schema.passkey)).toEqual([
			expect.objectContaining({
				aaguid: "test-aaguid",
				backedUp: true,
				credentialID: "credential-bob",
				id: "bob-passkey",
				name: "Bob device",
				transports: "internal",
				userId: "bob",
			}),
		]);
	});

	test("round trips zero, coordinates and timestamps in rooms and rule stakes", async ({
		api,
	}) => {
		await api.db.insert(room).values({
			id: "room",
			latitude: 35.5,
			longitude: 139.125,
			name: "Room",
			updatedAt: instant,
			userId: "alice",
		});
		const nlh = (await api.alice.gameVariant.list()).find(
			(row) => row.builtinKey === "nlh"
		);
		if (!nlh) {
			throw new Error("missing builtin nlh");
		}
		const createdRing = await api.alice.ringGame.create({
			name: "Game",
			roomId: "room",
			rule: {
				game: { variantId: nlh.id },
				stakes: [{ blind1: 0, blind2: 100, gameGroupId: nlh.groupId }],
			},
		});
		await api.db
			.update(ringGame)
			.set({ archivedAt: instant, updatedAt: instant })
			.where(eq(ringGame.id, createdRing.id));
		expect(await api.db.select().from(room)).toEqual([
			expect.objectContaining({
				latitude: 35.5,
				longitude: 139.125,
				updatedAt: instant,
			}),
		]);
		expect(await api.db.select().from(ringGame)).toEqual([
			expect.objectContaining({
				archivedAt: instant,
				currentRuleId: createdRing.currentRuleId,
			}),
		]);
		expect(await api.db.select().from(cashRuleStake)).toEqual([
			expect.objectContaining({ blind1: 0, blind2: 100 }),
		]);
		expect(createdRing.ruleVersion.id).toBe(createdRing.currentRuleId);
	});

	test("round trips saved filter JSON and enforces name and default uniqueness within each account and screen", async ({
		api,
	}) => {
		const payload = { display: "normalized" as const, period: "all" };
		await api.db.insert(filterPreset).values({
			id: "initial",
			name: "All",
			payload,
			screenKey: "sessions",
			updatedAt: instant,
			userId: "alice",
		});
		expect(await api.db.select().from(filterPreset)).toEqual([
			expect.objectContaining({
				isDefault: false,
				payload,
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
