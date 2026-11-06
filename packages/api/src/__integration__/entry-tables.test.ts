import { describe, expect } from "vitest";
import type { TestD1Database } from "./test-database";
import {
	FOREIGN_KEY_FAILED,
	ids,
	insert,
	insertRingGameFixture,
	test,
} from "./test-fixture";

type Row = Record<string, string | number | null>;

const day = "2026-09-05";

function entryRow(id: string, userId: string, overrides: Row = {}): Row {
	return {
		id,
		kind: "cash",
		played_on: day,
		source: "manual",
		status: "settled",
		updated_at: 0,
		user_id: userId,
		...overrides,
	};
}

function playSessionRow(
	id: string,
	entryId: string,
	userId: string,
	overrides: Row = {}
): Row {
	return {
		end_state: "cashed_out",
		entry_id: entryId,
		id,
		kind: "cash",
		local_date: day,
		seq: 1,
		status: "ended",
		updated_at: 0,
		user_id: userId,
		...overrides,
	};
}

function playEventRow(
	id: string,
	entryId: string,
	playSessionId: string,
	userId: string,
	overrides: Row = {}
): Row {
	return {
		entry_id: entryId,
		entry_source: "live",
		id,
		occurred_at: 0,
		payload: '{"text":"note"}',
		play_session_id: playSessionId,
		schema_version: 2,
		sort_order: 0,
		type: "memo",
		updated_at: 0,
		user_id: userId,
		...overrides,
	};
}

async function seedMasters(d1: TestD1Database, owners: string[]) {
	for (const owner of owners) {
		// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
		await insert(d1, "room", {
			id: `${owner}-room`,
			name: "Room",
			updated_at: 0,
			user_id: owner,
		});
		await insert(d1, "asset", {
			id: `${owner}-currency`,
			name: "Chips",
			updated_at: 0,
			user_id: owner,
		});
		await insertRingGameFixture(d1, {
			id: `${owner}-ring`,
			name: "1/2",
			roomId: `${owner}-room`,
			userId: owner,
		});
		await insert(d1, "game_lineup", { id: `${owner}-lineup`, user_id: owner });
		await insert(d1, "tournament_rule", {
			id: `${owner}-rule`,
			lineup_id: `${owner}-lineup`,
			user_id: owner,
		});
		await insert(d1, "tournament", {
			current_rule_id: `${owner}-rule`,
			id: `${owner}-tournament`,
			name: "Daily",
			room_id: `${owner}-room`,
			updated_at: 0,
			user_id: owner,
		});
		await d1
			.prepare("UPDATE tournament_rule SET tournament_id = ? WHERE id = ?")
			.bind(`${owner}-tournament`, `${owner}-rule`)
			.run();
	}
}

async function seedEntryAggregate(d1: TestD1Database, owner: string) {
	await insert(
		d1,
		"entry",
		entryRow(`${owner}-cash`, owner, {
			asset_id: `${owner}-currency`,
			room_id: `${owner}-room`,
			source: "live",
		})
	);
	await insert(d1, "entry_cash", {
		cash_rule_id: `${owner}-ring-fixture-rule`,
		entry_id: `${owner}-cash`,
		kind: "cash",
		ring_game_id: `${owner}-ring`,
		user_id: owner,
	});
	await insert(
		d1,
		"play_session",
		playSessionRow(`${owner}-cash-play`, `${owner}-cash`, owner)
	);
	await insert(
		d1,
		"play_event",
		playEventRow(
			`${owner}-cash-event`,
			`${owner}-cash`,
			`${owner}-cash-play`,
			owner
		)
	);
	await insert(
		d1,
		"entry",
		entryRow(`${owner}-mtt`, owner, {
			kind: "tournament",
			room_id: `${owner}-room`,
		})
	);
	await insert(d1, "entry_tournament", {
		entry_id: `${owner}-mtt`,
		kind: "tournament",
		placement: 3,
		total_entries: 40,
		tournament_id: `${owner}-tournament`,
		tournament_rule_id: `${owner}-rule`,
		user_id: owner,
	});
	await insert(
		d1,
		"play_session",
		playSessionRow(`${owner}-mtt-play`, `${owner}-mtt`, owner, {
			end_state: "busted",
			kind: "tournament",
		})
	);
}

describe("entry aggregate tables on D1", () => {
	test("rows that point at another user's room, asset, ring game, tournament, entry or play session are rejected while the owner's own references are stored", async ({
		api,
	}) => {
		await seedMasters(api.d1, ["alice", "bob"]);
		await seedEntryAggregate(api.d1, "alice");
		await insert(
			api.d1,
			"entry",
			entryRow("bob-cash", "bob", { source: "live" })
		);
		await insert(
			api.d1,
			"entry",
			entryRow("bob-mtt", "bob", { kind: "tournament" })
		);
		await insert(
			api.d1,
			"play_session",
			playSessionRow("bob-cash-play", "bob-cash", "bob")
		);

		const crossOwner: [string, Row][] = [
			[
				"entry",
				entryRow("bob-in-alice-room", "bob", { room_id: "alice-room" }),
			],
			[
				"entry",
				entryRow("bob-paid-alice-asset", "bob", { asset_id: "alice-currency" }),
			],
			[
				"entry_cash",
				{
					cash_rule_id: "bob-ring-fixture-rule",
					entry_id: "bob-cash",
					kind: "cash",
					ring_game_id: "alice-ring",
					user_id: "bob",
				},
			],
			[
				"entry_tournament",
				{
					entry_id: "bob-mtt",
					kind: "tournament",
					tournament_id: "alice-tournament",
					tournament_rule_id: "bob-rule",
					user_id: "bob",
				},
			],
			[
				"play_session",
				playSessionRow("bob-play-in-alice-entry", "alice-cash", "bob", {
					seq: 2,
				}),
			],
			[
				"play_event",
				playEventRow(
					"bob-event-in-alice-entry",
					"alice-cash",
					"alice-cash-play",
					"bob",
					{ sort_order: 1 }
				),
			],
			[
				"play_event",
				playEventRow(
					"bob-event-in-alice-play",
					"bob-cash",
					"alice-cash-play",
					"bob"
				),
			],
		];
		for (const [table, row] of crossOwner) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await expect(
				insert(api.d1, table, row),
				`${table} ${row.id ?? row.entry_id}`
			).rejects.toThrow(FOREIGN_KEY_FAILED);
		}

		await insert(
			api.d1,
			"entry",
			entryRow("bob-in-own-room", "bob", {
				asset_id: "bob-currency",
				room_id: "bob-room",
			})
		);
		await insert(api.d1, "entry_cash", {
			cash_rule_id: "bob-ring-fixture-rule",
			entry_id: "bob-cash",
			kind: "cash",
			ring_game_id: "bob-ring",
			user_id: "bob",
		});
		await insert(api.d1, "entry_tournament", {
			entry_id: "bob-mtt",
			kind: "tournament",
			tournament_id: "bob-tournament",
			tournament_rule_id: "bob-rule",
			user_id: "bob",
		});
		await insert(
			api.d1,
			"play_event",
			playEventRow("bob-event", "bob-cash", "bob-cash-play", "bob")
		);
		expect(await ids(api.d1, "entry")).toEqual([
			"alice-cash",
			"alice-mtt",
			"bob-cash",
			"bob-in-own-room",
			"bob-mtt",
		]);
		expect(await ids(api.d1, "entry_cash", "entry_id")).toEqual([
			"alice-cash",
			"bob-cash",
		]);
		expect(await ids(api.d1, "entry_tournament", "entry_id")).toEqual([
			"alice-mtt",
			"bob-mtt",
		]);
		expect(await ids(api.d1, "play_session")).toEqual([
			"alice-cash-play",
			"alice-mtt-play",
			"bob-cash-play",
		]);
		expect(await ids(api.d1, "play_event")).toEqual([
			"alice-cash-event",
			"bob-event",
		]);
	});

	test("a play event can point only at a play session of its own entry", async ({
		api,
	}) => {
		await insert(
			api.d1,
			"entry",
			entryRow("first", "alice", { source: "live" })
		);
		await insert(
			api.d1,
			"entry",
			entryRow("second", "alice", { source: "live" })
		);
		await insert(
			api.d1,
			"play_session",
			playSessionRow("first-play", "first", "alice")
		);
		await insert(
			api.d1,
			"play_session",
			playSessionRow("second-play", "second", "alice")
		);

		await expect(
			insert(
				api.d1,
				"play_event",
				playEventRow("misfiled", "first", "second-play", "alice")
			)
		).rejects.toThrow(FOREIGN_KEY_FAILED);
		await insert(
			api.d1,
			"play_event",
			playEventRow("filed", "first", "first-play", "alice")
		);
		expect(await ids(api.d1, "play_event")).toEqual(["filed"]);
	});

	test("a detail of the other kind, an event on a manual entry and an event without a schema version are rejected", async ({
		api,
	}) => {
		await seedMasters(api.d1, ["alice"]);
		await insert(api.d1, "entry", entryRow("cash", "alice"));
		await insert(
			api.d1,
			"entry",
			entryRow("mtt", "alice", { kind: "tournament" })
		);
		await insert(
			api.d1,
			"entry",
			entryRow("live", "alice", { source: "live" })
		);
		await insert(
			api.d1,
			"play_session",
			playSessionRow("manual-play", "cash", "alice")
		);
		await insert(
			api.d1,
			"play_session",
			playSessionRow("live-play", "live", "alice")
		);

		await expect(
			insert(api.d1, "entry_cash", {
				cash_rule_id: "alice-ring-fixture-rule",
				entry_id: "mtt",
				kind: "cash",
				user_id: "alice",
			}),
			"cash detail on a tournament entry"
		).rejects.toThrow(FOREIGN_KEY_FAILED);
		await expect(
			insert(api.d1, "entry_cash", {
				cash_rule_id: "alice-ring-fixture-rule",
				entry_id: "mtt",
				kind: "tournament",
				user_id: "alice",
			}),
			"cash detail claiming the tournament kind"
		).rejects.toThrow("CHECK constraint failed: entry_cash_kind_check");
		await expect(
			insert(api.d1, "entry_tournament", {
				entry_id: "cash",
				kind: "tournament",
				tournament_rule_id: "alice-rule",
				user_id: "alice",
			}),
			"tournament detail on a cash entry"
		).rejects.toThrow(FOREIGN_KEY_FAILED);
		await expect(
			insert(
				api.d1,
				"play_event",
				playEventRow("on-manual", "cash", "manual-play", "alice")
			),
			"event on a manual entry"
		).rejects.toThrow(FOREIGN_KEY_FAILED);
		await expect(
			insert(
				api.d1,
				"play_event",
				playEventRow("claims-manual", "cash", "manual-play", "alice", {
					entry_source: "manual",
				})
			),
			"event mirroring the manual source"
		).rejects.toThrow("CHECK constraint failed: play_event_entry_source_check");
		const { schema_version: _, ...withoutVersion } = playEventRow(
			"unversioned",
			"live",
			"live-play",
			"alice"
		);
		await expect(
			insert(api.d1, "play_event", withoutVersion),
			"event without a schema version"
		).rejects.toThrow("NOT NULL constraint failed: play_event.schema_version");
		await expect(
			insert(api.d1, "entry_tournament", {
				before_deadline: null,
				entry_id: "mtt",
				kind: "tournament",
				tournament_rule_id: "alice-rule",
				user_id: "alice",
			}),
			"before_deadline NULL"
		).rejects.toThrow(
			"NOT NULL constraint failed: entry_tournament.before_deadline"
		);

		await insert(api.d1, "entry_cash", {
			cash_rule_id: "alice-ring-fixture-rule",
			entry_id: "cash",
			kind: "cash",
			user_id: "alice",
		});
		await insert(api.d1, "entry_tournament", {
			entry_id: "mtt",
			kind: "tournament",
			tournament_rule_id: "alice-rule",
			user_id: "alice",
		});
		await insert(
			api.d1,
			"play_event",
			playEventRow("on-live", "live", "live-play", "alice")
		);
		expect(await ids(api.d1, "entry_cash", "entry_id")).toEqual(["cash"]);
		expect(await ids(api.d1, "entry_tournament", "entry_id")).toEqual(["mtt"]);
		expect(await ids(api.d1, "play_event")).toEqual(["on-live"]);
	});

	test("each user has at most one unfinished play session, and ending it frees the slot", async ({
		api,
	}) => {
		const live = { source: "live", status: "open" };
		const unfinished = { end_state: null, status: "active" };
		await insert(api.d1, "entry", entryRow("alice-live-1", "alice", live));
		await insert(api.d1, "entry", entryRow("alice-live-2", "alice", live));
		await insert(api.d1, "entry", entryRow("alice-manual", "alice"));
		await insert(api.d1, "entry", entryRow("bob-live", "bob", live));
		await insert(
			api.d1,
			"play_session",
			playSessionRow("alice-live-1-play", "alice-live-1", "alice", unfinished)
		);

		await expect(
			insert(
				api.d1,
				"play_session",
				playSessionRow("alice-live-2-play", "alice-live-2", "alice", {
					end_state: null,
					status: "paused",
				})
			)
		).rejects.toThrow("UNIQUE constraint failed: play_session.user_id");
		await insert(
			api.d1,
			"play_session",
			playSessionRow("bob-live-play", "bob-live", "bob", unfinished)
		);
		await insert(
			api.d1,
			"play_session",
			playSessionRow("alice-manual-play", "alice-manual", "alice")
		);

		await api.d1
			.prepare(
				"UPDATE play_session SET status = 'ended', end_state = 'cashed_out' WHERE id = 'alice-live-1-play'"
			)
			.run();
		await insert(
			api.d1,
			"play_session",
			playSessionRow("alice-live-2-play", "alice-live-2", "alice", unfinished)
		);
		const open = await api.d1
			.prepare(
				"SELECT id FROM play_session WHERE status <> 'ended' ORDER BY id"
			)
			.all<{ id: string }>();
		expect(open.results.map(({ id }) => id)).toEqual([
			"alice-live-2-play",
			"bob-live-play",
		]);
	});

	test("play session numbers start at 1 and are unique within an entry", async ({
		api,
	}) => {
		const tournament = { kind: "tournament" };
		await insert(api.d1, "entry", entryRow("multi-day", "alice", tournament));
		await insert(api.d1, "entry", entryRow("other", "alice", tournament));
		await insert(
			api.d1,
			"play_session",
			playSessionRow("day-1", "multi-day", "alice", {
				...tournament,
				end_stack: 52_000,
				end_state: "bagged",
			})
		);

		await expect(
			insert(
				api.d1,
				"play_session",
				playSessionRow("day-1-again", "multi-day", "alice", {
					...tournament,
					end_state: "busted",
				})
			)
		).rejects.toThrow(
			"UNIQUE constraint failed: play_session.entry_id, play_session.seq"
		);
		await expect(
			insert(
				api.d1,
				"play_session",
				playSessionRow("day-0", "multi-day", "alice", {
					...tournament,
					end_state: "busted",
					seq: 0,
				})
			)
		).rejects.toThrow("CHECK constraint failed: play_session_seq_check");
		await insert(
			api.d1,
			"play_session",
			playSessionRow("day-2", "multi-day", "alice", {
				...tournament,
				end_state: "busted",
				seq: 2,
			})
		);
		await insert(
			api.d1,
			"play_session",
			playSessionRow("other-day-1", "other", "alice", {
				...tournament,
				end_state: "finished",
			})
		);
		expect(await ids(api.d1, "play_session")).toEqual([
			"day-1",
			"day-2",
			"other-day-1",
		]);
	});

	test("an end state must fit the entry kind, bagged and held keep a stack, and only an ended play session has one", async ({
		api,
	}) => {
		await insert(api.d1, "entry", entryRow("cash", "alice"));
		await insert(
			api.d1,
			"entry",
			entryRow("mtt", "alice", { kind: "tournament" })
		);
		let seq = 0;
		const play = (entryId: "cash" | "mtt", overrides: Row) => {
			seq += 1;
			return insert(
				api.d1,
				"play_session",
				playSessionRow(`${entryId}-${seq}`, entryId, "alice", {
					kind: entryId === "cash" ? "cash" : "tournament",
					seq,
					...overrides,
				})
			);
		};

		const accepted: ["cash" | "mtt", Row][] = [
			["cash", { end_stack: 30_000, end_state: "held" }],
			["cash", { end_state: "cashed_out" }],
			["cash", { end_state: "finished" }],
			["mtt", { end_stack: 52_000, end_state: "bagged" }],
			["mtt", { end_state: "busted" }],
			["mtt", { end_state: "finished" }],
		];
		for (const [entryId, overrides] of accepted) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await play(entryId, overrides);
		}

		const rejected: ["cash" | "mtt", Row, string][] = [
			[
				"cash",
				{ end_stack: 30_000, end_state: "bagged" },
				"play_session_end_state_kind_check",
			],
			["cash", { end_state: "busted" }, "play_session_end_state_kind_check"],
			[
				"mtt",
				{ end_stack: 52_000, end_state: "held" },
				"play_session_end_state_kind_check",
			],
			["mtt", { end_state: "cashed_out" }, "play_session_end_state_kind_check"],
			["cash", { end_state: "held" }, "play_session_end_stack_required_check"],
			["mtt", { end_state: "bagged" }, "play_session_end_stack_required_check"],
			[
				"cash",
				{ end_state: null, status: "ended" },
				"play_session_end_state_presence_check",
			],
			[
				"mtt",
				{ end_stack: 52_000, end_state: "bagged", status: "paused" },
				"play_session_end_state_presence_check",
			],
		];
		for (const [entryId, overrides, constraint] of rejected) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await expect(
				play(entryId, overrides),
				`${entryId} ${JSON.stringify(overrides)}`
			).rejects.toThrow(`CHECK constraint failed: ${constraint}`);
		}

		await expect(
			insert(
				api.d1,
				"play_session",
				playSessionRow("cash-posing-as-tournament", "cash", "alice", {
					end_stack: 30_000,
					end_state: "bagged",
					kind: "tournament",
					seq: 99,
				})
			)
		).rejects.toThrow(FOREIGN_KEY_FAILED);

		const stored = await api.d1
			.prepare(
				"SELECT entry_id, end_state FROM play_session ORDER BY entry_id, seq"
			)
			.all<{ end_state: string; entry_id: string }>();
		expect(stored.results).toEqual([
			{ end_state: "held", entry_id: "cash" },
			{ end_state: "cashed_out", entry_id: "cash" },
			{ end_state: "finished", entry_id: "cash" },
			{ end_state: "bagged", entry_id: "mtt" },
			{ end_state: "busted", entry_id: "mtt" },
			{ end_state: "finished", entry_id: "mtt" },
		]);
	});

	test("entries, tournament results, play times and event payloads outside the specification are rejected", async ({
		api,
	}) => {
		await seedMasters(api.d1, ["alice"]);
		const rejected: [string, Row, string][] = [
			["entry", entryRow("sng", "alice", { kind: "sng" }), "entry_kind_check"],
			[
				"entry",
				entryRow("csv", "alice", { source: "csv" }),
				"entry_source_check",
			],
			[
				"entry",
				entryRow("closed", "alice", { status: "closed" }),
				"entry_status_check",
			],
			[
				"entry",
				entryRow("manual-open", "alice", { status: "open" }),
				"entry_manual_settled_check",
			],
			[
				"entry",
				entryRow("slash-date", "alice", { played_on: "2026/09/05" }),
				"entry_played_on_check",
			],
		];
		for (const [table, row, constraint] of rejected) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await expect(insert(api.d1, table, row), `${row.id}`).rejects.toThrow(
				`CHECK constraint failed: ${constraint}`
			);
		}
		await insert(
			api.d1,
			"entry",
			entryRow("live-open", "alice", { source: "live", status: "open" })
		);

		const results: [Row, string | null][] = [
			[{ placement: 0, total_entries: 10 }, "entry_tournament_placement_check"],
			[
				{ placement: 11, total_entries: 10 },
				"entry_tournament_placement_within_total_check",
			],
			[
				{ before_deadline: 1, placement: 3, total_entries: 10 },
				"entry_tournament_before_deadline_placement_check",
			],
			[{ before_deadline: 0, placement: 10, total_entries: 10 }, null],
			[{ before_deadline: 1, placement: null, total_entries: 10 }, null],
			[{ before_deadline: 2 }, "entry_tournament_before_deadline_check"],
		];
		for (const [index, [result, constraint]] of results.entries()) {
			const id = `mtt-${index}`;
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await insert(
				api.d1,
				"entry",
				entryRow(id, "alice", { kind: "tournament" })
			);
			const write = insert(api.d1, "entry_tournament", {
				entry_id: id,
				kind: "tournament",
				tournament_rule_id: "alice-rule",
				user_id: "alice",
				...result,
			});
			if (constraint) {
				await expect(write, JSON.stringify(result)).rejects.toThrow(
					`CHECK constraint failed: ${constraint}`
				);
			} else {
				await write;
			}
		}
		expect(await ids(api.d1, "entry_tournament", "entry_id")).toEqual([
			"mtt-3",
			"mtt-4",
		]);

		await expect(
			insert(
				api.d1,
				"play_session",
				playSessionRow("backwards", "live-open", "alice", {
					ended_at: 1000,
					started_at: 2000,
				})
			)
		).rejects.toThrow("CHECK constraint failed: play_session_time_order_check");
		await insert(
			api.d1,
			"play_session",
			playSessionRow("forwards", "live-open", "alice", {
				ended_at: 1000,
				started_at: 1000,
			})
		);
		await expect(
			insert(
				api.d1,
				"play_event",
				playEventRow("truncated", "live-open", "forwards", "alice", {
					payload: '{"text":',
				})
			)
		).rejects.toThrow("CHECK constraint failed: play_event_payload_json_check");
		await insert(
			api.d1,
			"play_event",
			playEventRow("empty", "live-open", "forwards", "alice", {
				payload: "{}",
			})
		);
		expect(await ids(api.d1, "play_event")).toEqual(["empty"]);
	});

	test("a room, asset, ring game or tournament used by an entry cannot be deleted, and deleting the entry removes its detail, play sessions and events", async ({
		api,
	}) => {
		await seedMasters(api.d1, ["alice"]);
		await seedEntryAggregate(api.d1, "alice");

		for (const [table, id] of [
			["room", "alice-room"],
			["asset", "alice-currency"],
			["ring_game", "alice-ring"],
			["tournament", "alice-tournament"],
		]) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await expect(
				api.d1.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run(),
				table
			).rejects.toThrow(FOREIGN_KEY_FAILED);
		}

		await api.d1
			.prepare("DELETE FROM entry WHERE id IN ('alice-cash', 'alice-mtt')")
			.run();
		for (const table of ["play_event", "play_session"]) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			expect(await ids(api.d1, table), table).toEqual([]);
		}
		for (const table of ["entry_cash", "entry_tournament"]) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			expect(await ids(api.d1, table, "entry_id"), table).toEqual([]);
		}
		await api.d1.prepare("DELETE FROM asset WHERE id = 'alice-currency'").run();
		await api.d1
			.prepare("DELETE FROM tournament WHERE id = 'alice-tournament'")
			.run();
		await api.d1.prepare("DELETE FROM room WHERE id = 'alice-room'").run();
		expect(await ids(api.d1, "ring_game")).toEqual([]);
		expect(await ids(api.d1, "tournament")).toEqual([]);
	});

	test("deleting a user removes their entries together with the masters they reference and keeps the other user's rows", async ({
		api,
	}) => {
		await seedMasters(api.d1, ["alice", "bob"]);
		await seedEntryAggregate(api.d1, "alice");
		await seedEntryAggregate(api.d1, "bob");

		await api.d1.prepare("DELETE FROM user WHERE id = 'alice'").run();

		expect(await ids(api.d1, "entry")).toEqual(["bob-cash", "bob-mtt"]);
		expect(await ids(api.d1, "entry_cash", "entry_id")).toEqual(["bob-cash"]);
		expect(await ids(api.d1, "entry_tournament", "entry_id")).toEqual([
			"bob-mtt",
		]);
		expect(await ids(api.d1, "play_session")).toEqual([
			"bob-cash-play",
			"bob-mtt-play",
		]);
		expect(await ids(api.d1, "play_event")).toEqual(["bob-cash-event"]);
		expect(await ids(api.d1, "room")).toEqual(["bob-room"]);
	});
});
