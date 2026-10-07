import { describe, expect } from "vitest";
import type { TestD1Database } from "./test-database";
import { test } from "./test-fixture";

type Row = Record<string, string | number | null>;

const day = "2026-09-05";
const FOREIGN_KEY_FAILED = "FOREIGN KEY constraint failed";

function insert(d1: TestD1Database, table: string, row: Row) {
	const columns = Object.keys(row);
	return d1
		.prepare(
			`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`
		)
		.bind(...Object.values(row))
		.run();
}

async function ids(d1: TestD1Database, table: string, key = "id") {
	const rows = await d1
		.prepare(`SELECT ${key} AS id FROM ${table} ORDER BY ${key}`)
		.all<{ id: string }>();
	return rows.results.map(({ id }) => id);
}

function entryRow(id: string, userId: string, overrides: Row = {}): Row {
	return {
		id,
		user_id: userId,
		kind: "cash",
		source: "manual",
		status: "settled",
		played_on: day,
		updated_at: 0,
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
		id,
		user_id: userId,
		entry_id: entryId,
		kind: "cash",
		seq: 1,
		local_date: day,
		status: "ended",
		end_state: "cashed_out",
		updated_at: 0,
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
		id,
		user_id: userId,
		entry_id: entryId,
		play_session_id: playSessionId,
		type: "memo",
		occurred_at: 0,
		sort_order: 0,
		payload: '{"text":"note"}',
		updated_at: 0,
		...overrides,
	};
}

async function seedMasters(d1: TestD1Database, owners: string[]) {
	for (const owner of owners) {
		await insert(d1, "room", {
			id: `${owner}-room`,
			user_id: owner,
			name: "Room",
			updated_at: 0,
		});
		await insert(d1, "currency", {
			id: `${owner}-currency`,
			user_id: owner,
			name: "Chips",
			updated_at: 0,
		});
		await insert(d1, "ring_game", {
			id: `${owner}-ring`,
			user_id: owner,
			room_id: `${owner}-room`,
			name: "1/2",
			updated_at: 0,
		});
		await insert(d1, "tournament", {
			id: `${owner}-tournament`,
			user_id: owner,
			room_id: `${owner}-room`,
			name: "Daily",
			updated_at: 0,
		});
	}
}

async function seedEntryAggregate(d1: TestD1Database, owner: string) {
	await insert(
		d1,
		"entry",
		entryRow(`${owner}-cash`, owner, {
			room_id: `${owner}-room`,
			asset_id: `${owner}-currency`,
		})
	);
	await insert(d1, "entry_cash", {
		entry_id: `${owner}-cash`,
		user_id: owner,
		ring_game_id: `${owner}-ring`,
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
		user_id: owner,
		tournament_id: `${owner}-tournament`,
		placement: 3,
		total_entries: 40,
	});
	await insert(
		d1,
		"play_session",
		playSessionRow(`${owner}-mtt-play`, `${owner}-mtt`, owner, {
			kind: "tournament",
			end_state: "busted",
		})
	);
}

describe("entry aggregate tables on D1", () => {
	test("rows that point at another user's room, asset, ring game, tournament, entry or play session are rejected while the owner's own references are stored", async ({
		api,
	}) => {
		await seedMasters(api.d1, ["alice", "bob"]);
		await seedEntryAggregate(api.d1, "alice");
		await insert(api.d1, "entry", entryRow("bob-cash", "bob"));
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
				{ entry_id: "bob-cash", user_id: "bob", ring_game_id: "alice-ring" },
			],
			[
				"entry_tournament",
				{
					entry_id: "bob-mtt",
					user_id: "bob",
					tournament_id: "alice-tournament",
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
			await expect(
				insert(api.d1, table, row),
				`${table} ${row.id ?? row.entry_id}`
			).rejects.toThrow(FOREIGN_KEY_FAILED);
		}

		await insert(
			api.d1,
			"entry",
			entryRow("bob-in-own-room", "bob", {
				room_id: "bob-room",
				asset_id: "bob-currency",
			})
		);
		await insert(api.d1, "entry_cash", {
			entry_id: "bob-cash",
			user_id: "bob",
			ring_game_id: "bob-ring",
		});
		await insert(api.d1, "entry_tournament", {
			entry_id: "bob-mtt",
			user_id: "bob",
			tournament_id: "bob-tournament",
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
		await insert(api.d1, "entry", entryRow("first", "alice"));
		await insert(api.d1, "entry", entryRow("second", "alice"));
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

	test("each user has at most one unfinished play session, and ending it frees the slot", async ({
		api,
	}) => {
		const live = { source: "live", status: "open" };
		const unfinished = { status: "active", end_state: null };
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
					status: "paused",
					end_state: null,
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
				end_state: "bagged",
				end_stack: 52_000,
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
					seq: 0,
					end_state: "busted",
				})
			)
		).rejects.toThrow("CHECK constraint failed: play_session_seq_check");
		await insert(
			api.d1,
			"play_session",
			playSessionRow("day-2", "multi-day", "alice", {
				...tournament,
				seq: 2,
				end_state: "busted",
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
			["cash", { end_state: "held", end_stack: 30_000 }],
			["cash", { end_state: "cashed_out" }],
			["cash", { end_state: "finished" }],
			["mtt", { end_state: "bagged", end_stack: 52_000 }],
			["mtt", { end_state: "busted" }],
			["mtt", { end_state: "finished" }],
		];
		for (const [entryId, overrides] of accepted) {
			await play(entryId, overrides);
		}

		const rejected: ["cash" | "mtt", Row, string][] = [
			[
				"cash",
				{ end_state: "bagged", end_stack: 30_000 },
				"play_session_end_state_kind_check",
			],
			["cash", { end_state: "busted" }, "play_session_end_state_kind_check"],
			[
				"mtt",
				{ end_state: "held", end_stack: 52_000 },
				"play_session_end_state_kind_check",
			],
			["mtt", { end_state: "cashed_out" }, "play_session_end_state_kind_check"],
			["cash", { end_state: "held" }, "play_session_end_stack_required_check"],
			["mtt", { end_state: "bagged" }, "play_session_end_stack_required_check"],
			[
				"cash",
				{ status: "ended", end_state: null },
				"play_session_end_state_presence_check",
			],
			[
				"mtt",
				{ status: "paused", end_state: "bagged", end_stack: 52_000 },
				"play_session_end_state_presence_check",
			],
		];
		for (const [entryId, overrides, constraint] of rejected) {
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
					kind: "tournament",
					seq: 99,
					end_state: "bagged",
					end_stack: 30_000,
				})
			)
		).rejects.toThrow(FOREIGN_KEY_FAILED);

		const stored = await api.d1
			.prepare(
				"SELECT entry_id, end_state FROM play_session ORDER BY entry_id, seq"
			)
			.all<{ end_state: string; entry_id: string }>();
		expect(stored.results).toEqual([
			{ entry_id: "cash", end_state: "held" },
			{ entry_id: "cash", end_state: "cashed_out" },
			{ entry_id: "cash", end_state: "finished" },
			{ entry_id: "mtt", end_state: "bagged" },
			{ entry_id: "mtt", end_state: "busted" },
			{ entry_id: "mtt", end_state: "finished" },
		]);
	});

	test("entries, tournament results, play times and event payloads outside the specification are rejected", async ({
		api,
	}) => {
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
			[{ placement: 10, total_entries: 10, before_deadline: 0 }, null],
			[{ before_deadline: 1, placement: null, total_entries: 10 }, null],
		];
		for (const [index, [result, constraint]] of results.entries()) {
			const id = `mtt-${index}`;
			await insert(
				api.d1,
				"entry",
				entryRow(id, "alice", { kind: "tournament" })
			);
			const write = insert(api.d1, "entry_tournament", {
				entry_id: id,
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
					started_at: 2000,
					ended_at: 1000,
				})
			)
		).rejects.toThrow("CHECK constraint failed: play_session_time_order_check");
		await insert(
			api.d1,
			"play_session",
			playSessionRow("forwards", "live-open", "alice", {
				started_at: 1000,
				ended_at: 1000,
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
			["currency", "alice-currency"],
			["ring_game", "alice-ring"],
			["tournament", "alice-tournament"],
		]) {
			await expect(
				api.d1.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run(),
				table
			).rejects.toThrow(FOREIGN_KEY_FAILED);
		}

		await api.d1
			.prepare("DELETE FROM entry WHERE id IN ('alice-cash', 'alice-mtt')")
			.run();
		for (const table of ["play_event", "play_session"]) {
			expect(await ids(api.d1, table), table).toEqual([]);
		}
		for (const table of ["entry_cash", "entry_tournament"]) {
			expect(await ids(api.d1, table, "entry_id"), table).toEqual([]);
		}
		await api.d1
			.prepare("DELETE FROM currency WHERE id = 'alice-currency'")
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
