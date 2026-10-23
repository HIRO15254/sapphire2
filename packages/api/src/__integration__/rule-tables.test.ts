import { describe, expect } from "vitest";
import type { TestD1Database } from "./test-database";
import { test } from "./test-fixture";

type Row = Record<string, string | number | null>;

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

async function seedOwner(d1: TestD1Database, owner: string) {
	await insert(d1, "room", {
		id: `${owner}-room`,
		user_id: owner,
		name: "Room",
		updated_at: 0,
	});
	for (const suffix of ["a", "b"]) {
		await insert(d1, "ring_game", {
			id: `${owner}-ring-${suffix}`,
			user_id: owner,
			room_id: `${owner}-room`,
			name: `Ring ${suffix}`,
			updated_at: 0,
		});
		await insert(d1, "tournament", {
			id: `${owner}-tournament-${suffix}`,
			user_id: owner,
			room_id: `${owner}-room`,
			name: `Tournament ${suffix}`,
			updated_at: 0,
		});
	}
	await insert(d1, "game_group", {
		id: `${owner}-group`,
		user_id: owner,
		label: `${owner} Big Bet`,
		updated_at: 0,
	});
	for (const variant of ["nlh", "plo"]) {
		await insert(d1, "game_variant", {
			id: `${owner}-${variant}`,
			user_id: owner,
			group_id: `${owner}-group`,
			label: `${owner} ${variant}`,
			updated_at: 0,
		});
	}
	for (const lineup of ["lineup-1", "lineup-2"]) {
		await insert(d1, "game_lineup", {
			id: `${owner}-${lineup}`,
			user_id: owner,
		});
		await insert(d1, "game_lineup_group", {
			id: `${owner}-${lineup}-group`,
			user_id: owner,
			lineup_id: `${owner}-${lineup}`,
			position: 0,
			game_group_id: `${owner}-group`,
		});
	}
}

function cashRuleRow(
	id: string,
	owner: string,
	ringGameId: string | null,
	overrides: Row = {}
): Row {
	return {
		id,
		user_id: owner,
		ring_game_id: ringGameId,
		lineup_id: `${owner}-lineup-1`,
		...overrides,
	};
}

function tournamentRuleRow(
	id: string,
	owner: string,
	tournamentId: string | null,
	overrides: Row = {}
): Row {
	return {
		id,
		user_id: owner,
		tournament_id: tournamentId,
		lineup_id: `${owner}-lineup-1`,
		...overrides,
	};
}

describe("lineup and rule-version tables on D1", () => {
	test("a variant occurs once per lineup even across its groups, while another lineup may list it again", async ({
		api,
	}) => {
		await seedOwner(api.d1, "alice");
		await insert(api.d1, "game_lineup_group", {
			id: "alice-lineup-1-second",
			user_id: "alice",
			lineup_id: "alice-lineup-1",
			position: 1,
			game_group_id: "alice-group",
		});
		await insert(api.d1, "game_lineup_variant", {
			user_id: "alice",
			lineup_id: "alice-lineup-1",
			lineup_group_id: "alice-lineup-1-group",
			variant_id: "alice-nlh",
			position: 0,
		});

		await expect(
			insert(api.d1, "game_lineup_variant", {
				user_id: "alice",
				lineup_id: "alice-lineup-1",
				lineup_group_id: "alice-lineup-1-second",
				variant_id: "alice-nlh",
				position: 0,
			})
		).rejects.toThrow(
			"UNIQUE constraint failed: game_lineup_variant.lineup_id, game_lineup_variant.variant_id"
		);
		await expect(
			insert(api.d1, "game_lineup_variant", {
				user_id: "alice",
				lineup_id: "alice-lineup-2",
				lineup_group_id: "alice-lineup-1-second",
				variant_id: "alice-nlh",
				position: 0,
			}),
			"group named under another lineup"
		).rejects.toThrow(FOREIGN_KEY_FAILED);

		await insert(api.d1, "game_lineup_variant", {
			user_id: "alice",
			lineup_id: "alice-lineup-1",
			lineup_group_id: "alice-lineup-1-second",
			variant_id: "alice-plo",
			position: 0,
		});
		await insert(api.d1, "game_lineup_variant", {
			user_id: "alice",
			lineup_id: "alice-lineup-2",
			lineup_group_id: "alice-lineup-2-group",
			variant_id: "alice-nlh",
			position: 0,
		});
		const rows = await api.d1
			.prepare(
				"SELECT lineup_group_id, variant_id FROM game_lineup_variant ORDER BY lineup_group_id"
			)
			.all();
		expect(rows.results).toEqual([
			{ lineup_group_id: "alice-lineup-1-group", variant_id: "alice-nlh" },
			{ lineup_group_id: "alice-lineup-1-second", variant_id: "alice-plo" },
			{ lineup_group_id: "alice-lineup-2-group", variant_id: "alice-nlh" },
		]);
	});

	test("an entry and a child version can use only a version of their own master, and only their owner's", async ({
		api,
	}) => {
		await seedOwner(api.d1, "alice");
		await seedOwner(api.d1, "bob");
		await insert(
			api.d1,
			"cash_rule",
			cashRuleRow("alice-cr-a", "alice", "alice-ring-a")
		);
		await insert(
			api.d1,
			"tournament_rule",
			tournamentRuleRow("alice-tr-a", "alice", "alice-tournament-a")
		);
		for (const [id, kind] of [
			["alice-cash", "cash"],
			["alice-mtt", "tournament"],
			["bob-cash", "cash"],
			["bob-mtt", "tournament"],
		] as const) {
			await insert(api.d1, "entry", {
				id,
				user_id: id.split("-")[0] ?? "",
				kind,
				source: "manual",
				status: "settled",
				played_on: "2026-09-05",
				updated_at: 0,
			});
		}

		const rejected: [string, Row][] = [
			[
				"entry_cash",
				{
					entry_id: "alice-cash",
					user_id: "alice",
					kind: "cash",
					ring_game_id: "alice-ring-b",
					cash_rule_id: "alice-cr-a",
				},
			],
			[
				"entry_tournament",
				{
					entry_id: "alice-mtt",
					user_id: "alice",
					kind: "tournament",
					tournament_id: "alice-tournament-b",
					tournament_rule_id: "alice-tr-a",
				},
			],
			[
				"cash_rule",
				cashRuleRow("alice-cr-b-child", "alice", "alice-ring-b", {
					parent_rule_id: "alice-cr-a",
				}),
			],
			[
				"tournament_rule",
				tournamentRuleRow("alice-tr-b-child", "alice", "alice-tournament-b", {
					parent_rule_id: "alice-tr-a",
				}),
			],
			[
				"entry_cash",
				{
					entry_id: "bob-cash",
					user_id: "bob",
					kind: "cash",
					cash_rule_id: "alice-cr-a",
				},
			],
			[
				"entry_tournament",
				{
					entry_id: "bob-mtt",
					user_id: "bob",
					kind: "tournament",
					tournament_rule_id: "alice-tr-a",
				},
			],
			[
				"cash_rule",
				cashRuleRow("bob-cr-child", "bob", null, {
					parent_rule_id: "alice-cr-a",
				}),
			],
			[
				"cash_rule",
				cashRuleRow("bob-cr-alice-lineup", "bob", null, {
					lineup_id: "alice-lineup-1",
				}),
			],
		];
		for (const [table, row] of rejected) {
			await expect(
				insert(api.d1, table, row),
				`${table} ${row.id ?? row.entry_id}`
			).rejects.toThrow(FOREIGN_KEY_FAILED);
		}

		await insert(
			api.d1,
			"cash_rule",
			cashRuleRow("alice-cr-a-child", "alice", "alice-ring-a", {
				parent_rule_id: "alice-cr-a",
			})
		);
		await insert(
			api.d1,
			"tournament_rule",
			tournamentRuleRow("alice-tr-a-child", "alice", "alice-tournament-a", {
				parent_rule_id: "alice-tr-a",
			})
		);
		await insert(api.d1, "entry_cash", {
			entry_id: "alice-cash",
			user_id: "alice",
			kind: "cash",
			ring_game_id: "alice-ring-a",
			cash_rule_id: "alice-cr-a-child",
		});
		await insert(api.d1, "entry_tournament", {
			entry_id: "alice-mtt",
			user_id: "alice",
			kind: "tournament",
			tournament_id: "alice-tournament-a",
			tournament_rule_id: "alice-tr-a-child",
		});
		expect(await ids(api.d1, "cash_rule")).toEqual([
			"alice-cr-a",
			"alice-cr-a-child",
		]);
		expect(await ids(api.d1, "tournament_rule")).toEqual([
			"alice-tr-a",
			"alice-tr-a-child",
		]);
		expect(await ids(api.d1, "entry_cash", "entry_id")).toEqual(["alice-cash"]);
		expect(await ids(api.d1, "entry_tournament", "entry_id")).toEqual([
			"alice-mtt",
		]);
	});

	test("an inheriting level mirrors its version's lineup, and an overriding level has no mirror", async ({
		api,
	}) => {
		await seedOwner(api.d1, "alice");
		await insert(
			api.d1,
			"tournament_rule",
			tournamentRuleRow("rule", "alice", null)
		);
		const level = (id: string, ordinal: number, overrides: Row): Row => ({
			id,
			user_id: "alice",
			rule_id: "rule",
			ordinal,
			lineup_id: "alice-lineup-1",
			...overrides,
		});

		const rejected: [Row, string][] = [
			[
				level("inherits-without-mirror", 1, {
					inherits_lineup: 1,
					inherited_lineup_id: null,
				}),
				"CHECK constraint failed: tournament_rule_level_inherited_lineup_check",
			],
			[
				level("mirror-differs", 1, {
					inherits_lineup: 1,
					lineup_id: "alice-lineup-2",
					inherited_lineup_id: "alice-lineup-1",
				}),
				"CHECK constraint failed: tournament_rule_level_inherited_lineup_check",
			],
			[
				level("override-with-mirror", 1, {
					inherits_lineup: 0,
					lineup_id: "alice-lineup-2",
					inherited_lineup_id: "alice-lineup-2",
				}),
				"CHECK constraint failed: tournament_rule_level_inherited_lineup_check",
			],
			[
				level("inherits-other-lineup", 1, {
					inherits_lineup: 1,
					lineup_id: "alice-lineup-2",
					inherited_lineup_id: "alice-lineup-2",
				}),
				FOREIGN_KEY_FAILED,
			],
			[
				level("inherits-flag-2", 1, {
					inherits_lineup: 2,
					inherited_lineup_id: null,
				}),
				"CHECK constraint failed: tournament_rule_level_inherits_lineup_check",
			],
		];
		for (const [row, error] of rejected) {
			await expect(
				insert(api.d1, "tournament_rule_level", row),
				`${row.id}`
			).rejects.toThrow(error);
		}

		await insert(
			api.d1,
			"tournament_rule_level",
			level("inherits", 1, {
				inherits_lineup: 1,
				inherited_lineup_id: "alice-lineup-1",
			})
		);
		await insert(
			api.d1,
			"tournament_rule_level",
			level("overrides", 2, {
				inherits_lineup: 0,
				lineup_id: "alice-lineup-2",
			})
		);
		expect(await ids(api.d1, "tournament_rule_level")).toEqual([
			"inherits",
			"overrides",
		]);
	});
});
