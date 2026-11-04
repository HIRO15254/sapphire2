import { entry, entryCash, entryTournament } from "@sapphire2/db/schema/entry";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { tournamentRule, tournamentRuleLevel } from "@sapphire2/db/schema/rule";
import { tournament } from "@sapphire2/db/schema/tournament";
import { describe, expect } from "vitest";
import { test } from "./test-fixture";

const day = new Date("2026-09-05T00:00:00.000Z");
const ARCHIVE_GUIDANCE = /archive/i;

describe("entry-referenced master deletion on D1", () => {
	for (const kind of ["cash", "tournament"] as const) {
		test(`${kind} master deletion conflicts before changing a referenced master or its entry`, async ({
			api,
		}) => {
			await api.db.insert(room).values({
				id: "club",
				userId: "alice",
				name: "Club",
				updatedAt: day,
			});
			const master = { id: "referenced" };
			if (kind === "cash") {
				await api.db.insert(ringGame).values({
					id: master.id,
					userId: "alice",
					roomId: "club",
					name: "Recorded game",
					updatedAt: day,
				});
			} else {
				master.id = (
					await api.alice.tournament.createWithLevels({
						roomId: "club",
						name: "Recorded game",
						rule: { levels: [{ isBreak: false, minutes: 20 }] },
					})
				).id;
			}
			await api.db.insert(entry).values({
				id: "recorded-entry",
				userId: "alice",
				kind,
				source: "manual",
				status: "settled",
				playedOn: "2026-09-05",
				updatedAt: day,
			});
			if (kind === "cash") {
				await api.db.insert(entryCash).values({
					entryId: "recorded-entry",
					userId: "alice",
					ringGameId: master.id,
				});
			} else {
				await api.db.insert(entryTournament).values({
					entryId: "recorded-entry",
					userId: "alice",
					tournamentId: master.id,
				});
			}
			const snapshot = async () => ({
				games: await api.db.select().from(ringGame),
				tournaments: await api.db.select().from(tournament),
				rules: await api.db.select().from(tournamentRule),
				levels: await api.db.select().from(tournamentRuleLevel),
				entries: await api.db.select().from(entry),
				cash: await api.db.select().from(entryCash),
				tournament: await api.db.select().from(entryTournament),
			});
			const before = await snapshot();
			const owner = kind === "cash" ? api.alice.ringGame : api.alice.tournament;
			const other = kind === "cash" ? api.bob.ringGame : api.bob.tournament;
			for (const id of [master.id, "missing"]) {
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
				userId: "alice",
				name: "Club",
				updatedAt: day,
			});
			const master = {
				id: "unused",
				userId: "alice",
				roomId: "club",
				name: "Unused",
				updatedAt: day,
			};
			if (kind === "cash") {
				await api.db.insert(ringGame).values(master);
				expect(await api.alice.ringGame.delete({ id: master.id })).toEqual({
					success: true,
				});
				expect(await api.db.select().from(ringGame)).toEqual([]);
			} else {
				const created = await api.alice.tournament.createWithLevels({
					roomId: "club",
					name: "Unused",
					rule: { levels: [{ isBreak: false, minutes: 20 }] },
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
