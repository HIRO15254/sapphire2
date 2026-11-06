import { entry, entryCash, entryTournament } from "@sapphire2/db/schema/entry";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { tournamentRule, tournamentRuleLevel } from "@sapphire2/db/schema/rule";
import { tournament } from "@sapphire2/db/schema/tournament";
import { describe, expect } from "vitest";
import { insertRingGameFixture, test } from "./test-fixture";

const day = new Date("2026-09-05T00:00:00.000Z");
const ARCHIVE_GUIDANCE = /archive/iu;

describe("entry-referenced master deletion on D1", () => {
	for (const kind of ["cash", "tournament"] as const) {
		test(`${kind} master deletion conflicts before changing a referenced master or its entry`, async ({
			api,
		}) => {
			await api.db.insert(room).values({
				id: "club",
				name: "Club",
				updatedAt: day,
				userId: "alice",
			});
			const master = { id: "referenced" };
			let ruleId = `${master.id}-fixture-rule`;
			if (kind === "cash") {
				await insertRingGameFixture(api.d1, {
					id: master.id,
					name: "Recorded game",
					roomId: "club",
					userId: "alice",
				});
			} else {
				const nlh = (await api.alice.gameVariant.list()).find(
					(row) => row.builtinKey === "nlh"
				);
				if (!nlh) {
					throw new Error("missing builtin nlh");
				}
				const created = await api.alice.tournament.createWithLevels({
					name: "Recorded game",
					roomId: "club",
					rule: {
						game: { variantId: nlh.id },
						levels: [
							{
								isBreak: false,
								minutes: 20,
								stakes: [{ blind1: 1, blind2: 2, gameGroupId: nlh.groupId }],
							},
						],
					},
				});
				master.id = created.id;
				ruleId = created.currentRuleId;
			}
			await api.db.insert(entry).values({
				id: "recorded-entry",
				kind,
				playedOn: "2026-09-05",
				source: "manual",
				status: "settled",
				updatedAt: day,
				userId: "alice",
			});
			if (kind === "cash") {
				await api.db.insert(entryCash).values({
					cashRuleId: ruleId,
					entryId: "recorded-entry",
					ringGameId: master.id,
					userId: "alice",
				});
			} else {
				await api.db.insert(entryTournament).values({
					entryId: "recorded-entry",
					tournamentId: master.id,
					tournamentRuleId: ruleId,
					userId: "alice",
				});
			}
			const snapshot = async () => ({
				cash: await api.db.select().from(entryCash),
				entries: await api.db.select().from(entry),
				games: await api.db.select().from(ringGame),
				levels: await api.db.select().from(tournamentRuleLevel),
				rules: await api.db.select().from(tournamentRule),
				tournament: await api.db.select().from(entryTournament),
				tournaments: await api.db.select().from(tournament),
			});
			const before = await snapshot();
			const owner = kind === "cash" ? api.alice.ringGame : api.alice.tournament;
			const other = kind === "cash" ? api.bob.ringGame : api.bob.tournament;
			for (const id of [master.id, "missing"]) {
				// biome-ignore lint/performance/noAwaitInLoops: Keep D1 operations sequential.
				await expect(other.delete({ id })).rejects.toMatchObject({
					code: "FORBIDDEN",
				});
			}
			await expect(owner.delete({ id: master.id })).rejects.toMatchObject({
				code: "CONFLICT",
				message: expect.stringMatching(ARCHIVE_GUIDANCE),
			});
			expect(await snapshot()).toEqual(before);
		});

		test(`${kind} master deletion still removes an unreferenced master`, async ({
			api,
		}) => {
			await api.db.insert(room).values({
				id: "club",
				name: "Club",
				updatedAt: day,
				userId: "alice",
			});
			const master = {
				id: "unused",
				name: "Unused",
				roomId: "club",
				updatedAt: day,
				userId: "alice",
			};
			if (kind === "cash") {
				await insertRingGameFixture(api.d1, master);
				expect(await api.alice.ringGame.delete({ id: master.id })).toEqual({
					success: true,
				});
				expect(await api.db.select().from(ringGame)).toEqual([]);
			} else {
				const nlh = (await api.alice.gameVariant.list()).find(
					(row) => row.builtinKey === "nlh"
				);
				if (!nlh) {
					throw new Error("missing builtin nlh");
				}
				const created = await api.alice.tournament.createWithLevels({
					name: "Unused",
					roomId: "club",
					rule: {
						game: { variantId: nlh.id },
						levels: [
							{
								isBreak: false,
								minutes: 20,
								stakes: [{ blind1: 1, blind2: 2, gameGroupId: nlh.groupId }],
							},
						],
					},
				});
				await api.alice.tournament.update({
					id: created.id,
					rule: { startingStack: 20_000 },
				});
				expect(await api.alice.tournament.delete({ id: created.id })).toEqual({
					success: true,
				});
				expect(await api.db.select().from(tournament)).toEqual([]);
				expect(await api.db.select().from(tournamentRule)).toEqual([]);
				expect(await api.db.select().from(tournamentRuleLevel)).toEqual([]);
			}
		});
	}
});
