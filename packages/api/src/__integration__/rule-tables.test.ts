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

async function seedOwner(d1: TestD1Database, owner: string) {
	await insert(d1, "room", {
		id: `${owner}-room`,
		name: "Room",
		updated_at: 0,
		user_id: owner,
	});
	for (const suffix of ["a", "b"]) {
		// biome-ignore lint/performance/noAwaitInLoops: Preserve the sequential database fixture operations.
		await insertRingGameFixture(d1, {
			id: `${owner}-ring-${suffix}`,
			name: `Ring ${suffix}`,
			roomId: `${owner}-room`,
			userId: owner,
		});
	}
	await insert(d1, "game_group", {
		id: `${owner}-group`,
		label: `${owner} Big Bet`,
		updated_at: 0,
		user_id: owner,
	});
	for (const variant of ["nlh", "plo"]) {
		// biome-ignore lint/performance/noAwaitInLoops: Preserve the sequential database fixture operations.
		await insert(d1, "game_variant", {
			group_id: `${owner}-group`,
			id: `${owner}-${variant}`,
			label: `${owner} ${variant}`,
			updated_at: 0,
			user_id: owner,
		});
	}
	for (const lineup of ["lineup-1", "lineup-2"]) {
		// biome-ignore lint/performance/noAwaitInLoops: Preserve the sequential database fixture operations.
		await insert(d1, "game_lineup", {
			id: `${owner}-${lineup}`,
			user_id: owner,
		});
		await insert(d1, "game_lineup_group", {
			game_group_id: `${owner}-group`,
			id: `${owner}-${lineup}-group`,
			lineup_id: `${owner}-${lineup}`,
			position: 0,
			user_id: owner,
		});
	}
	for (const suffix of ["a", "b"]) {
		// biome-ignore lint/performance/noAwaitInLoops: Preserve the sequential database fixture operations.
		await seedTournament(d1, owner, `${owner}-tournament-${suffix}`);
	}
}

async function seedTournament(d1: TestD1Database, owner: string, id: string) {
	await insert(d1, "tournament_rule", {
		id: `${id}-current`,
		lineup_id: `${owner}-lineup-1`,
		user_id: owner,
	});
	await insert(d1, "tournament", {
		current_rule_id: `${id}-current`,
		id,
		name: id,
		room_id: `${owner}-room`,
		updated_at: 0,
		user_id: owner,
	});
	await d1
		.prepare("UPDATE tournament_rule SET tournament_id = ? WHERE id = ?")
		.bind(id, `${id}-current`)
		.run();
}

function cashRuleRow(
	id: string,
	owner: string,
	ringGameId: string | null,
	overrides: Row = {}
): Row {
	return {
		id,
		lineup_id: `${owner}-lineup-1`,
		ring_game_id: ringGameId,
		user_id: owner,
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
		lineup_id: `${owner}-lineup-1`,
		tournament_id: tournamentId,
		user_id: owner,
		...overrides,
	};
}

describe("lineup and rule-version tables on D1", () => {
	test("a variant occurs once per lineup even across its groups, while another lineup may list it again", async ({
		api,
	}) => {
		await seedOwner(api.d1, "alice");
		await insert(api.d1, "game_lineup_group", {
			game_group_id: "alice-group",
			id: "alice-lineup-1-second",
			lineup_id: "alice-lineup-1",
			position: 1,
			user_id: "alice",
		});
		await insert(api.d1, "game_lineup_variant", {
			lineup_group_id: "alice-lineup-1-group",
			lineup_id: "alice-lineup-1",
			position: 0,
			user_id: "alice",
			variant_id: "alice-nlh",
		});

		await expect(
			insert(api.d1, "game_lineup_variant", {
				lineup_group_id: "alice-lineup-1-second",
				lineup_id: "alice-lineup-1",
				position: 0,
				user_id: "alice",
				variant_id: "alice-nlh",
			})
		).rejects.toThrow(
			"UNIQUE constraint failed: game_lineup_variant.lineup_id, game_lineup_variant.variant_id"
		);
		await expect(
			insert(api.d1, "game_lineup_variant", {
				lineup_group_id: "alice-lineup-1-second",
				lineup_id: "alice-lineup-2",
				position: 0,
				user_id: "alice",
				variant_id: "alice-nlh",
			}),
			"group named under another lineup"
		).rejects.toThrow(FOREIGN_KEY_FAILED);

		await insert(api.d1, "game_lineup_variant", {
			lineup_group_id: "alice-lineup-1-second",
			lineup_id: "alice-lineup-1",
			position: 0,
			user_id: "alice",
			variant_id: "alice-plo",
		});
		await insert(api.d1, "game_lineup_variant", {
			lineup_group_id: "alice-lineup-2-group",
			lineup_id: "alice-lineup-2",
			position: 0,
			user_id: "alice",
			variant_id: "alice-nlh",
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
			// biome-ignore lint/performance/noAwaitInLoops: Preserve the sequential database fixture operations.
			await insert(api.d1, "entry", {
				id,
				kind,
				played_on: "2026-09-05",
				source: "manual",
				status: "settled",
				updated_at: 0,
				user_id: id.split("-")[0] ?? "",
			});
		}

		const rejected: [string, Row][] = [
			[
				"entry_cash",
				{
					cash_rule_id: "alice-cr-a",
					entry_id: "alice-cash",
					kind: "cash",
					ring_game_id: "alice-ring-b",
					user_id: "alice",
				},
			],
			[
				"entry_tournament",
				{
					entry_id: "alice-mtt",
					kind: "tournament",
					tournament_id: "alice-tournament-b",
					tournament_rule_id: "alice-tr-a",
					user_id: "alice",
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
					cash_rule_id: "alice-cr-a",
					entry_id: "bob-cash",
					kind: "cash",
					user_id: "bob",
				},
			],
			[
				"entry_tournament",
				{
					entry_id: "bob-mtt",
					kind: "tournament",
					tournament_rule_id: "alice-tr-a",
					user_id: "bob",
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
			// biome-ignore lint/performance/noAwaitInLoops: Preserve the sequential database operations and assertions.
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
			cash_rule_id: "alice-cr-a-child",
			entry_id: "alice-cash",
			kind: "cash",
			ring_game_id: "alice-ring-a",
			user_id: "alice",
		});
		await insert(api.d1, "entry_tournament", {
			entry_id: "alice-mtt",
			kind: "tournament",
			tournament_id: "alice-tournament-a",
			tournament_rule_id: "alice-tr-a-child",
			user_id: "alice",
		});
		expect(await ids(api.d1, "cash_rule")).toEqual([
			"alice-cr-a",
			"alice-cr-a-child",
			"alice-ring-a-fixture-rule",
			"alice-ring-b-fixture-rule",
			"bob-ring-a-fixture-rule",
			"bob-ring-b-fixture-rule",
		]);
		expect(await ids(api.d1, "tournament_rule")).toEqual([
			"alice-tournament-a-current",
			"alice-tournament-b-current",
			"alice-tr-a",
			"alice-tr-a-child",
			"bob-tournament-a-current",
			"bob-tournament-b-current",
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
			lineup_id: "alice-lineup-1",
			ordinal,
			rule_id: "rule",
			user_id: "alice",
			...overrides,
		});

		const rejected: [Row, string][] = [
			[
				level("inherits-without-mirror", 1, {
					inherited_lineup_id: null,
					inherits_lineup: 1,
				}),
				"CHECK constraint failed: tournament_rule_level_inherited_lineup_check",
			],
			[
				level("mirror-differs", 1, {
					inherited_lineup_id: "alice-lineup-1",
					inherits_lineup: 1,
					lineup_id: "alice-lineup-2",
				}),
				"CHECK constraint failed: tournament_rule_level_inherited_lineup_check",
			],
			[
				level("override-with-mirror", 1, {
					inherited_lineup_id: "alice-lineup-2",
					inherits_lineup: 0,
					lineup_id: "alice-lineup-2",
				}),
				"CHECK constraint failed: tournament_rule_level_inherited_lineup_check",
			],
			[
				level("inherits-other-lineup", 1, {
					inherited_lineup_id: "alice-lineup-2",
					inherits_lineup: 1,
					lineup_id: "alice-lineup-2",
				}),
				FOREIGN_KEY_FAILED,
			],
			[
				level("inherits-flag-2", 1, {
					inherited_lineup_id: null,
					inherits_lineup: 2,
				}),
				"CHECK constraint failed: tournament_rule_level_inherits_lineup_check",
			],
		];
		for (const [row, error] of rejected) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve the sequential database operations and assertions.
			await expect(
				insert(api.d1, "tournament_rule_level", row),
				`${row.id}`
			).rejects.toThrow(error);
		}

		await insert(
			api.d1,
			"tournament_rule_level",
			level("inherits", 1, {
				inherited_lineup_id: "alice-lineup-1",
				inherits_lineup: 1,
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
