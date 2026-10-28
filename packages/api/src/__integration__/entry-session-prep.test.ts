import type { Database } from "@sapphire2/db";
import {
	entry,
	entryCash,
	entryTournament,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { gameSession } from "@sapphire2/db/schema/session";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { runBatch } from "../lib/batch";
import {
	buildEntryDeleteStatements,
	buildEntryRewriteStatements,
	buildManualEntryInsertStatements,
	type EntrySessionFacts,
	loadEntrySessionFacts,
} from "../services/entry-session";
import { test } from "./test-fixture";

const NOW = new Date("2026-09-05T10:00:00.000Z");

function facts(
	kind: "cash_game"
): Extract<EntrySessionFacts, { kind: "cash_game" }>;
function facts(
	kind: "tournament"
): Extract<EntrySessionFacts, { kind: "tournament" }>;
function facts(kind: "cash_game" | "tournament"): EntrySessionFacts;
function facts(kind: "cash_game" | "tournament"): EntrySessionFacts {
	const base = {
		id: "manual-entry",
		userId: "alice",
		source: "manual",
		sessionDate: new Date("2026-09-01T00:00:00.000Z"),
		startedAt: new Date("2026-09-01T10:00:00.000Z"),
		endedAt: new Date("2026-09-01T12:00:00.000Z"),
		breakMinutes: 15,
		memo: "Recorded result",
		roomId: null,
		currencyId: null,
		ruleName: "Own rules",
	};
	return kind === "cash_game"
		? {
				...base,
				kind,
				cash: { ringGameId: null, cashOut: 300, evCashOut: 350 },
			}
		: {
				...base,
				kind,
				tournament: {
					tournamentId: null,
					placement: 3,
					totalEntries: 50,
					beforeDeadline: false,
				},
			};
}

async function stored(db: Database) {
	return {
		entries: await db.select().from(entry),
		cash: await db.select().from(entryCash),
		tournaments: await db.select().from(entryTournament),
		plays: await db.select().from(playSession),
		events: await db.select().from(playEvent),
		sessions: await db.select().from(gameSession),
	};
}

describe("manual entry persistence without compatibility session rows", () => {
	for (const kind of ["cash_game", "tournament"] as const) {
		test(`${kind}: inserts and rewrites the entry, detail and first play session without a game_session row`, async ({
			api: { db },
		}) => {
			const input = facts(kind);
			await runBatch(db, buildManualEntryInsertStatements(db, input, NOW));
			expect(await db.select().from(gameSession)).toEqual([]);
			expect(await db.select().from(entry)).toEqual([
				expect.objectContaining({
					id: input.id,
					userId: "alice",
					kind: kind === "cash_game" ? "cash" : "tournament",
					source: "manual",
					status: "settled",
					playedOn: "2026-09-01",
					title: "Own rules",
					memo: "Recorded result",
				}),
			]);
			expect(await db.select().from(playSession)).toEqual([
				expect.objectContaining({
					entryId: input.id,
					seq: 1,
					status: "ended",
					startedAt: input.startedAt,
					endedAt: input.endedAt,
					breakMinutes: 15,
					endStack: kind === "cash_game" ? 300 : null,
				}),
			]);
			if (kind === "cash_game") {
				expect(await db.select().from(entryCash)).toEqual([
					expect.objectContaining({ entryId: input.id, evDiff: 50 }),
				]);
			} else {
				expect(await db.select().from(entryTournament)).toEqual([
					expect.objectContaining({
						entryId: input.id,
						placement: 3,
						totalEntries: 50,
						beforeDeadline: false,
					}),
				]);
			}

			await runBatch(
				db,
				buildEntryRewriteStatements(
					db,
					{
						...input,
						memo: "Updated result",
						endedAt: new Date("2026-09-01T09:00:00.000Z"),
					},
					NOW
				)
			);
			expect(
				await db.select().from(entry).where(eq(entry.id, input.id))
			).toEqual([expect.objectContaining({ memo: "Updated result" })]);
			expect(await db.select().from(playSession)).toEqual([
				expect.objectContaining({ endedAt: null }),
			]);
			expect(await db.select().from(gameSession)).toEqual([]);
		});
	}

	test("ownership failures do not reveal entries or mutate another user's aggregate", async ({
		api: { db },
	}) => {
		const input = facts("cash_game");
		await runBatch(db, buildManualEntryInsertStatements(db, input, NOW));
		const before = await stored(db);
		for (const id of [input.id, "missing"]) {
			await expect(loadEntrySessionFacts(db, id, "bob")).rejects.toMatchObject({
				code: "FORBIDDEN",
			});
		}
		await runBatch(
			db,
			buildEntryRewriteStatements(
				db,
				{ ...input, userId: "bob", memo: "Foreign edit" },
				NOW
			)
		);
		await runBatch(db, buildEntryDeleteStatements(db, input.id, "bob"));
		expect(await stored(db)).toEqual(before);
	});

	test("deletion cascades the entry children while retaining another entry", async ({
		api: { db },
	}) => {
		const input = facts("cash_game");
		await runBatch(db, buildManualEntryInsertStatements(db, input, NOW));
		await runBatch(
			db,
			buildManualEntryInsertStatements(
				db,
				{ ...facts("tournament"), id: "kept" },
				NOW
			)
		);
		await runBatch(db, buildEntryDeleteStatements(db, input.id, "alice"));
		expect(await db.select().from(entryCash)).toEqual([]);
		expect((await db.select().from(entry)).map(({ id }) => id)).toEqual([
			"kept",
		]);
		expect(
			(await db.select().from(playSession)).map(({ entryId }) => entryId)
		).toEqual(["kept"]);
		expect(await db.select().from(gameSession)).toEqual([]);
	});

	test("a failed last insert rolls back the whole aggregate", async ({
		api,
	}) => {
		await api.d1
			.prepare(
				"CREATE TRIGGER test_fail_last BEFORE INSERT ON play_session BEGIN SELECT RAISE(ABORT, 'test forced failure'); END;"
			)
			.run();
		const before = await stored(api.db);
		await expect(
			runBatch(
				api.db,
				buildManualEntryInsertStatements(api.db, facts("cash_game"), NOW)
			)
		).rejects.toThrow();
		expect(await stored(api.db)).toEqual(before);
	});

	test("a failed first-play rewrite rolls back the entry and detail updates", async ({
		api,
	}) => {
		const input = facts("cash_game");
		await runBatch(
			api.db,
			buildManualEntryInsertStatements(api.db, input, NOW)
		);
		await api.d1
			.prepare(
				"CREATE TRIGGER test_fail_last BEFORE UPDATE ON play_session BEGIN SELECT RAISE(ABORT, 'test forced failure'); END;"
			)
			.run();
		const before = await stored(api.db);
		await expect(
			runBatch(
				api.db,
				buildEntryRewriteStatements(
					api.db,
					{
						...input,
						memo: "Must roll back",
						cash: { ringGameId: null, cashOut: 300, evCashOut: 400 },
					},
					NOW
				)
			)
		).rejects.toThrow();
		expect(await stored(api.db)).toEqual(before);
	});

	test("a rejected entry deletion preserves the complete aggregate", async ({
		api,
	}) => {
		const input = facts("cash_game");
		await runBatch(
			api.db,
			buildManualEntryInsertStatements(api.db, input, NOW)
		);
		await api.d1
			.prepare(
				"CREATE TRIGGER test_fail_last BEFORE DELETE ON entry BEGIN SELECT RAISE(ABORT, 'test forced failure'); END;"
			)
			.run();
		const before = await stored(api.db);
		await expect(
			runBatch(api.db, buildEntryDeleteStatements(api.db, input.id, "alice"))
		).rejects.toThrow();
		expect(await stored(api.db)).toEqual(before);
	});
});
