import type { Database } from "@sapphire2/db";
import { user } from "@sapphire2/db/schema/auth";
import { entry, entryCash, entryTournament } from "@sapphire2/db/schema/entry";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { cashRule, tournamentRulePrice } from "@sapphire2/db/schema/rule";
import { tournament } from "@sapphire2/db/schema/tournament";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { runBatch } from "../lib/batch";
import {
	type EntryRuleSelection,
	hydrateEntryRules,
	planEntryRule,
} from "../services/entry-rules";
import { type ApiFixture, requireCreatedRow, test } from "./test-fixture";

const DAY = new Date("2026-09-05T00:00:00.000Z");
const RULE_ID_REQUIRED = /NOT NULL constraint failed: entry_cash\.cash_rule_id/;

async function insertEntry(
	db: Database,
	id: string,
	kind: "cash" | "tournament",
	userId = "alice"
) {
	await db.insert(entry).values({
		id,
		userId,
		kind,
		source: "manual",
		status: "settled",
		playedOn: "2026-09-05",
		updatedAt: DAY,
	});
}

async function versionFor(
	db: Database,
	selection: EntryRuleSelection,
	userId = "alice"
) {
	const { ruleVersionId, statements } = await planEntryRule(
		db,
		userId,
		selection
	);
	await runBatch(db, statements);
	return ruleVersionId;
}

async function ringGameWithRoom(api: ApiFixture) {
	const room = requireCreatedRow(await api.alice.room.create({ name: "Club" }));
	const created = await api.alice.ringGame.create({
		roomId: room.id,
		name: "Cash",
		rule: { minBuyIn: 100, maxBuyIn: 500 },
	});
	const [master] = await api.db
		.select({ id: ringGame.id, currentRuleId: ringGame.currentRuleId })
		.from(ringGame)
		.where(eq(ringGame.id, created.id));
	if (!master) {
		throw new Error("ring game was not created");
	}
	return { roomId: room.id, ...master };
}

describe("entry rule versions on D1", () => {
	test("an entry shares its master's version, branches into a child on a rule change, and reports drift by id", async ({
		api,
	}) => {
		const master = await ringGameWithRoom(api);
		const shared = await versionFor(api.db, {
			kind: "cash",
			ringGameId: master.id,
		});
		const unchanged = await versionFor(api.db, {
			kind: "cash",
			ringGameId: master.id,
			rule: { minBuyIn: 100 },
		});
		const child = await versionFor(api.db, {
			kind: "cash",
			ringGameId: master.id,
			rule: { minBuyIn: 200 },
		});
		const standalone = await versionFor(api.db, {
			kind: "cash",
			ringGameId: null,
		});
		expect([shared, unchanged]).toEqual([
			master.currentRuleId,
			master.currentRuleId,
		]);
		expect(
			await api.db
				.select({
					id: cashRule.id,
					ringGameId: cashRule.ringGameId,
					parentRuleId: cashRule.parentRuleId,
					minBuyIn: cashRule.minBuyIn,
					maxBuyIn: cashRule.maxBuyIn,
				})
				.from(cashRule)
				.where(eq(cashRule.id, child))
		).toEqual([
			{
				id: child,
				ringGameId: master.id,
				parentRuleId: master.currentRuleId,
				minBuyIn: 200,
				maxBuyIn: 500,
			},
		]);
		for (const [id, ruleId, ringGameId] of [
			["shared", shared, master.id],
			["child", child, master.id],
			["standalone", standalone, null],
		] as const) {
			await insertEntry(api.db, id, "cash");
			await api.db.insert(entryCash).values({
				entryId: id,
				userId: "alice",
				ringGameId,
				cashRuleId: ruleId,
			});
		}
		const { entries, lineups } = await hydrateEntryRules(api.db, "alice", [
			{
				entryId: "shared",
				kind: "cash",
				masterId: master.id,
				ruleVersionId: shared,
			},
			{
				entryId: "child",
				kind: "cash",
				masterId: master.id,
				ruleVersionId: child,
			},
			{
				entryId: "standalone",
				kind: "cash",
				masterId: null,
				ruleVersionId: standalone,
			},
		]);
		expect(
			["shared", "child", "standalone"].map((id) => {
				const hydrated = entries.get(id);
				return [
					hydrated?.ruleVersionId,
					hydrated?.currentMasterRuleId,
					hydrated?.ruleDrift,
				];
			})
		).toEqual([
			[shared, master.currentRuleId, false],
			[child, master.currentRuleId, true],
			[standalone, null, false],
		]);
		const standaloneVersion = entries.get("standalone")?.ruleVersion;
		expect(
			standaloneVersion && lineups[standaloneVersion.lineupId]?.displayName
		).toBe("NL Hold'em");
	});

	test("the database rejects a missing, cross-owner or other-master rule version", async ({
		api,
	}) => {
		const master = await ringGameWithRoom(api);
		const other = await api.alice.ringGame.create({
			roomId: master.roomId,
			name: "Other",
			rule: {},
		});
		const bobRule = await versionFor(
			api.db,
			{ kind: "cash", ringGameId: null },
			"bob"
		);
		await insertEntry(api.db, "cash-entry", "cash");
		const otherRule = (
			await api.db
				.select({ currentRuleId: ringGame.currentRuleId })
				.from(ringGame)
				.where(eq(ringGame.id, other.id))
		)[0]?.currentRuleId;
		for (const values of [
			{ ringGameId: master.id, cashRuleId: otherRule ?? "" },
			{ ringGameId: null, cashRuleId: bobRule },
		]) {
			await expect(
				api.db
					.insert(entryCash)
					.values({ entryId: "cash-entry", userId: "alice", ...values })
			).rejects.toThrow();
		}
		await expect(
			api.d1
				.prepare(
					"INSERT INTO entry_cash (entry_id, user_id, kind, ring_game_id) VALUES ('cash-entry', 'alice', 'cash', ?)"
				)
				.bind(master.id)
				.run()
		).rejects.toThrow(RULE_ID_REQUIRED);
		expect(await api.db.select().from(entryCash)).toEqual([]);
	});

	test("a master whose child version an entry uses cannot be deleted, nor can its room, but the account can", async ({
		api,
	}) => {
		const master = await ringGameWithRoom(api);
		const child = await versionFor(api.db, {
			kind: "cash",
			ringGameId: master.id,
			rule: { tableSize: 6 },
		});
		await insertEntry(api.db, "cash-entry", "cash");
		await api.db.insert(entryCash).values({
			entryId: "cash-entry",
			userId: "alice",
			ringGameId: master.id,
			cashRuleId: child,
		});
		await expect(
			api.alice.ringGame.delete({ id: master.id })
		).rejects.toMatchObject({ code: "CONFLICT" });
		await expect(
			api.alice.room.delete({ id: master.roomId })
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(
			await api.db
				.select({ id: cashRule.id })
				.from(cashRule)
				.where(eq(cashRule.id, child))
		).toEqual([{ id: child }]);
		await api.db.delete(user).where(eq(user.id, "alice"));
		expect(
			await api.db.select().from(cashRule).where(eq(cashRule.userId, "alice"))
		).toEqual([]);
		expect(
			await api.db.select().from(ringGame).where(eq(ringGame.userId, "alice"))
		).toEqual([]);
	});

	test("a purchase keeps its price and amount after the master's rule changes", async ({
		api,
	}) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const jpy = requireCreatedRow(
			await api.alice.asset.create({ name: "JPY", kind: "currency" })
		);
		const price = {
			kind: "entry" as const,
			assetId: jpy.id,
			fee: 1000,
			chips: null,
		};
		const created = await api.alice.tournament.createWithLevels({
			roomId: room.id,
			name: "Daily",
			rule: {
				levels: [{ isBreak: false, minutes: 20 }],
				prices: [{ ...price, amount: 10_000 }],
			},
		});
		const version = await versionFor(api.db, {
			kind: "tournament",
			tournamentId: created.id,
		});
		expect(version).toBe(created.currentRuleId);
		await insertEntry(api.db, "mtt", "tournament");
		await api.db.insert(entryTournament).values({
			entryId: "mtt",
			userId: "alice",
			tournamentId: created.id,
			tournamentRuleId: version,
		});
		const [paid] = await api.db
			.select({ id: tournamentRulePrice.id })
			.from(tournamentRulePrice)
			.where(
				and(
					eq(tournamentRulePrice.ruleId, version),
					eq(tournamentRulePrice.kind, "entry")
				)
			);
		await api.db.insert(ledgerLine).values({
			id: "mtt:buy_in",
			userId: "alice",
			assetId: jpy.id,
			quantity: -10_000,
			role: "buy_in",
			effect: "real",
			entryId: "mtt",
			priceId: paid?.id,
			occurredAt: DAY,
			updatedAt: DAY,
		});
		const current = await api.alice.tournament.getById({ id: created.id });
		await api.alice.tournament.updateWithLevels({
			id: created.id,
			rule: {
				levels: current.ruleVersion.levels.map((level) => ({
					isBreak: level.isBreak,
					minutes: level.minutes,
				})),
				prices: [{ ...price, amount: 12_000 }],
			},
		});
		const [master] = await api.db
			.select({ currentRuleId: tournament.currentRuleId })
			.from(tournament)
			.where(eq(tournament.id, created.id));
		expect(master?.currentRuleId).not.toBe(version);
		expect(
			await api.db
				.select({
					quantity: ledgerLine.quantity,
					amount: tournamentRulePrice.amount,
					ruleId: tournamentRulePrice.ruleId,
				})
				.from(ledgerLine)
				.innerJoin(
					tournamentRulePrice,
					eq(tournamentRulePrice.id, ledgerLine.priceId)
				)
				.where(eq(ledgerLine.id, "mtt:buy_in"))
		).toEqual([{ quantity: -10_000, amount: 10_000, ruleId: version }]);
		const { entries } = await hydrateEntryRules(api.db, "alice", [
			{
				entryId: "mtt",
				kind: "tournament",
				masterId: created.id,
				ruleVersionId: version,
			},
		]);
		expect(entries.get("mtt")).toMatchObject({
			ruleVersionId: version,
			currentMasterRuleId: master?.currentRuleId,
			ruleDrift: true,
		});
	});
});
