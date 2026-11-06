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
import {
	type ApiFixture,
	nlhGame,
	requireCreatedRow,
	test,
} from "./test-fixture";

const DAY = new Date("2026-09-05T00:00:00.000Z");
const RULE_ID_REQUIRED =
	/NOT NULL constraint failed: entry_cash\.cash_rule_id/u;

async function insertEntry(
	db: Database,
	id: string,
	kind: "cash" | "tournament",
	userId = "alice"
) {
	await db.insert(entry).values({
		id,
		kind,
		playedOn: "2026-09-05",
		source: "manual",
		status: "settled",
		updatedAt: DAY,
		userId,
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
		name: "Cash",
		roomId: room.id,
		rule: { ...(await nlhGame(api.db)), maxBuyIn: 500, minBuyIn: 100 },
	});
	const [master] = await api.db
		.select({ currentRuleId: ringGame.currentRuleId, id: ringGame.id })
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
			rule: await nlhGame(api.db),
		});
		expect([shared, unchanged]).toEqual([
			master.currentRuleId,
			master.currentRuleId,
		]);
		expect(
			await api.db
				.select({
					id: cashRule.id,
					maxBuyIn: cashRule.maxBuyIn,
					minBuyIn: cashRule.minBuyIn,
					parentRuleId: cashRule.parentRuleId,
					ringGameId: cashRule.ringGameId,
				})
				.from(cashRule)
				.where(eq(cashRule.id, child))
		).toEqual([
			{
				id: child,
				maxBuyIn: 500,
				minBuyIn: 200,
				parentRuleId: master.currentRuleId,
				ringGameId: master.id,
			},
		]);
		for (const [id, ruleId, ringGameId] of [
			["shared", shared, master.id],
			["child", child, master.id],
			["standalone", standalone, null],
		] as const) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await insertEntry(api.db, id, "cash");
			await api.db.insert(entryCash).values({
				cashRuleId: ruleId,
				entryId: id,
				ringGameId,
				userId: "alice",
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
			name: "Other",
			roomId: master.roomId,
			rule: await nlhGame(api.db),
		});
		const bobRule = await versionFor(
			api.db,
			{ kind: "cash", ringGameId: null, rule: await nlhGame(api.db, "bob") },
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
			{ cashRuleId: otherRule ?? "", ringGameId: master.id },
			{ cashRuleId: bobRule, ringGameId: null },
		]) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
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

	test("rejects a master pointing at another master's rule before creating an entry", async ({
		api,
	}) => {
		const first = await ringGameWithRoom(api);
		const second = await api.alice.ringGame.create({
			name: "Other",
			roomId: first.roomId,
			rule: await nlhGame(api.db),
		});
		await api.db
			.update(ringGame)
			.set({ currentRuleId: second.currentRuleId })
			.where(eq(ringGame.id, first.id));
		await expect(
			planEntryRule(api.db, "alice", { kind: "cash", ringGameId: first.id })
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

		const a = await api.alice.tournament.create({
			name: "A",
			roomId: first.roomId,
			rule: {},
		});
		const b = await api.alice.tournament.create({
			name: "B",
			roomId: first.roomId,
			rule: {},
		});
		await api.db
			.update(tournament)
			.set({ currentRuleId: b.currentRuleId })
			.where(eq(tournament.id, a.id));
		await expect(
			planEntryRule(api.db, "alice", {
				kind: "tournament",
				tournamentId: a.id,
			})
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
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
			cashRuleId: child,
			entryId: "cash-entry",
			ringGameId: master.id,
			userId: "alice",
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
			await api.alice.asset.create({ kind: "currency", name: "JPY" })
		);
		const price = {
			assetId: jpy.id,
			chips: null,
			fee: 1000,
			kind: "entry" as const,
		};
		const { game, stakes } = await nlhGame(api.db);
		const levels = [{ isBreak: false, minutes: 20, stakes }];
		const created = await api.alice.tournament.createWithLevels({
			name: "Daily",
			roomId: room.id,
			rule: { game, levels, prices: [{ ...price, amount: 10_000 }] },
		});
		const version = await versionFor(api.db, {
			kind: "tournament",
			tournamentId: created.id,
		});
		expect(version).toBe(created.currentRuleId);
		await insertEntry(api.db, "mtt", "tournament");
		await api.db.insert(entryTournament).values({
			entryId: "mtt",
			tournamentId: created.id,
			tournamentRuleId: version,
			userId: "alice",
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
			assetId: jpy.id,
			effect: "real",
			entryId: "mtt",
			id: "mtt:buy_in",
			occurredAt: DAY,
			priceId: paid?.id,
			quantity: -10_000,
			role: "buy_in",
			updatedAt: DAY,
			userId: "alice",
		});
		await api.alice.tournament.updateWithLevels({
			id: created.id,
			rule: { game, levels, prices: [{ ...price, amount: 12_000 }] },
		});
		const [master] = await api.db
			.select({ currentRuleId: tournament.currentRuleId })
			.from(tournament)
			.where(eq(tournament.id, created.id));
		expect(master?.currentRuleId).not.toBe(version);
		expect(
			await api.db
				.select({
					amount: tournamentRulePrice.amount,
					quantity: ledgerLine.quantity,
					ruleId: tournamentRulePrice.ruleId,
				})
				.from(ledgerLine)
				.innerJoin(
					tournamentRulePrice,
					eq(tournamentRulePrice.id, ledgerLine.priceId)
				)
				.where(eq(ledgerLine.id, "mtt:buy_in"))
		).toEqual([{ amount: 10_000, quantity: -10_000, ruleId: version }]);
		const { entries } = await hydrateEntryRules(api.db, "alice", [
			{
				entryId: "mtt",
				kind: "tournament",
				masterId: created.id,
				ruleVersionId: version,
			},
		]);
		expect(entries.get("mtt")).toMatchObject({
			currentMasterRuleId: master?.currentRuleId,
			ruleDrift: true,
			ruleVersionId: version,
		});
	});
});
