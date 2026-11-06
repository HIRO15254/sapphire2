import { describe, expect } from "vitest";
import type { TestD1Database } from "./test-database";
import { FOREIGN_KEY_FAILED, ids, insert, test } from "./test-fixture";

type Row = Record<string, string | number | null>;

const MAX_QUANTITY = 1_000_000_000_000;

function lineRow(id: string, userId: string, overrides: Row = {}): Row {
	return {
		asset_id: `${userId}-currency`,
		effect: "real",
		entry_id: `${userId}-entry`,
		id,
		occurred_at: 1_790_000_000,
		quantity: -10_000,
		role: "buy_in",
		updated_at: 0,
		user_id: userId,
		...overrides,
	};
}

function rateRow(id: string, userId: string, overrides: Row = {}): Row {
	return {
		base_asset_id: `${userId}-ticket`,
		effective_from: 0,
		id,
		quote_asset_id: `${userId}-currency`,
		rate_den: 1,
		rate_num: 20_000,
		user_id: userId,
		...overrides,
	};
}

async function seedOwner(d1: TestD1Database, owner: string) {
	await insert(d1, "asset", {
		id: `${owner}-currency`,
		name: "Points",
		updated_at: 0,
		user_id: owner,
	});
	await insert(d1, "asset", {
		id: `${owner}-ticket`,
		kind: "item",
		name: "Main ticket",
		updated_at: 0,
		user_id: owner,
	});
	await insert(d1, "ledger_category", {
		id: `${owner}-deposit`,
		name: "Deposit",
		updated_at: 0,
		user_id: owner,
	});
	await insert(d1, "entry", {
		id: `${owner}-entry`,
		kind: "tournament",
		played_on: "2026-09-05",
		source: "live",
		status: "open",
		updated_at: 0,
		user_id: owner,
	});
	await insert(d1, "play_session", {
		end_state: "busted",
		entry_id: `${owner}-entry`,
		id: `${owner}-day-1`,
		kind: "tournament",
		local_date: "2026-09-05",
		seq: 1,
		status: "ended",
		updated_at: 0,
		user_id: owner,
	});
	await insert(d1, "play_event", {
		entry_id: `${owner}-entry`,
		entry_source: "live",
		id: `${owner}-start`,
		occurred_at: 1_790_000_000,
		payload: "{}",
		play_session_id: `${owner}-day-1`,
		schema_version: 2,
		sort_order: 0,
		type: "session_start",
		updated_at: 0,
		user_id: owner,
	});
	await insert(d1, "game_lineup", { id: `${owner}-lineup`, user_id: owner });
	await insert(d1, "tournament_rule", {
		id: `${owner}-rule`,
		lineup_id: `${owner}-lineup`,
		user_id: owner,
	});
	await insert(d1, "tournament_rule_price", {
		amount: 10_000,
		asset_id: `${owner}-currency`,
		id: `${owner}-entry-price`,
		kind: "entry",
		label: "Entry",
		ordinal: 1,
		rule_id: `${owner}-rule`,
		user_id: owner,
	});
}

describe("asset and ledger tables on D1", () => {
	test("rates, ledger lines and settings that point at another user's asset, entry, play session, event or category are rejected while the owner's own references are stored", async ({
		api,
	}) => {
		await seedOwner(api.d1, "alice");
		await seedOwner(api.d1, "bob");

		const crossOwner: [string, Row][] = [
			[
				"asset_rate",
				rateRow("bob-rate-alice-base", "bob", {
					base_asset_id: "alice-ticket",
				}),
			],
			[
				"asset_rate",
				rateRow("bob-rate-alice-quote", "bob", {
					quote_asset_id: "alice-currency",
				}),
			],
			[
				"ledger_line",
				lineRow("bob-paid-alice-asset", "bob", { asset_id: "alice-currency" }),
			],
			[
				"ledger_line",
				lineRow("bob-line-alice-entry", "bob", { entry_id: "alice-entry" }),
			],
			[
				"ledger_line",
				lineRow("bob-line-alice-day", "bob", {
					play_session_id: "alice-day-1",
				}),
			],
			[
				"ledger_line",
				lineRow("bob-line-alice-event", "bob", {
					play_session_id: "bob-day-1",
					source_event_id: "alice-start",
				}),
			],
			[
				"ledger_line",
				lineRow("bob-line-alice-price", "bob", {
					price_id: "alice-entry-price",
				}),
			],
			[
				"ledger_line",
				lineRow("bob-deposit-alice-category", "bob", {
					category_id: "alice-deposit",
					entry_id: null,
					quantity: 5000,
					role: "adjustment",
				}),
			],
			[
				"user_setting",
				{ base_asset_id: "alice-currency", updated_at: 0, user_id: "bob" },
			],
		];
		for (const [table, row] of crossOwner) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 constraint checks sequential.
			await expect(
				insert(api.d1, table, row),
				`${table} ${row.id ?? row.user_id}`
			).rejects.toThrow(FOREIGN_KEY_FAILED);
		}

		await insert(api.d1, "asset_rate", rateRow("bob-rate", "bob"));
		await insert(
			api.d1,
			"ledger_line",
			lineRow("bob-buy-in", "bob", {
				play_session_id: "bob-day-1",
				price_id: "bob-entry-price",
				source_event_id: "bob-start",
			})
		);
		await insert(
			api.d1,
			"ledger_line",
			lineRow("bob-deposit", "bob", {
				category_id: "bob-deposit",
				entry_id: null,
				quantity: 5000,
				role: "adjustment",
			})
		);
		await insert(api.d1, "user_setting", {
			base_asset_id: "bob-currency",
			time_zone: "Asia/Tokyo",
			updated_at: 0,
			user_id: "bob",
		});
		expect(await ids(api.d1, "asset_rate")).toEqual(["bob-rate"]);
		expect(await ids(api.d1, "ledger_line")).toEqual([
			"bob-buy-in",
			"bob-deposit",
		]);
		expect(await ids(api.d1, "user_setting", "user_id")).toEqual(["bob"]);
	});

	test("a ledger line can point only at a play session of its own entry", async ({
		api,
	}) => {
		await seedOwner(api.d1, "alice");
		await insert(api.d1, "entry", {
			id: "other-entry",
			kind: "tournament",
			played_on: "2026-09-06",
			source: "manual",
			status: "settled",
			updated_at: 0,
			user_id: "alice",
		});

		await expect(
			insert(
				api.d1,
				"ledger_line",
				lineRow("misfiled", "alice", {
					entry_id: "other-entry",
					play_session_id: "alice-day-1",
				})
			)
		).rejects.toThrow(FOREIGN_KEY_FAILED);
		await insert(
			api.d1,
			"ledger_line",
			lineRow("filed", "alice", { play_session_id: "alice-day-1" })
		);
		expect(await ids(api.d1, "ledger_line")).toEqual(["filed"]);
	});

	test("a ledger line's sign follows its role, a wallet line has no entry and is real, an entry line has an entry, and an exchange carries its transfer id", async ({
		api,
	}) => {
		await seedOwner(api.d1, "alice");
		const wallet = { category_id: "alice-deposit", entry_id: null };

		const accepted: Row[] = [
			{ quantity: -10_000, role: "buy_in" },
			{ price_id: "alice-entry-price", quantity: -10_000, role: "buy_in" },
			{ quantity: -1000, role: "fee" },
			{ quantity: -MAX_QUANTITY, role: "chip_purchase" },
			{ quantity: 1, role: "prize" },
			{
				asset_id: "alice-ticket",
				effect: "virtual",
				quantity: 1,
				role: "prize",
			},
			{ quantity: 2000, role: "bounty" },
			{ quantity: 5000, role: "adjustment", ...wallet },
			{ quantity: -5000, role: "adjustment", ...wallet },
			{
				entry_id: null,
				quantity: -20_000,
				role: "exchange",
				transfer_id: "swap",
			},
			{
				asset_id: "alice-ticket",
				entry_id: null,
				quantity: 1,
				role: "exchange",
				transfer_id: "swap",
			},
		];
		for (const [index, overrides] of accepted.entries()) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 inserts sequential.
			await insert(
				api.d1,
				"ledger_line",
				lineRow(`ok-${index}`, "alice", overrides)
			);
		}

		const rejected: [Row, string][] = [
			[{ quantity: 0, role: "buy_in" }, "ledger_line_quantity_check"],
			[
				{ quantity: -MAX_QUANTITY - 1, role: "chip_purchase" },
				"ledger_line_quantity_check",
			],
			[{ quantity: 10_000, role: "buy_in" }, "ledger_line_role_sign_check"],
			[{ quantity: 5000, role: "addon" }, "ledger_line_role_sign_check"],
			[{ quantity: -5000, role: "cash_out" }, "ledger_line_role_sign_check"],
			[{ quantity: -1, role: "prize" }, "ledger_line_role_sign_check"],
			[{ quantity: 5000, role: "adjustment" }, "ledger_line_role_entry_check"],
			[
				{ effect: "virtual", quantity: 5000, role: "adjustment", ...wallet },
				"ledger_line_role_entry_check",
			],
			[
				{ entry_id: null, quantity: 1, role: "prize" },
				"ledger_line_role_entry_check",
			],
			[
				{ effect: "virtual", entry_id: null, quantity: 1, role: "prize" },
				"ledger_line_role_entry_check",
			],
			[
				{ entry_id: null, quantity: -20_000, role: "exchange" },
				"ledger_line_exchange_transfer_check",
			],
			[
				{
					play_session_id: "alice-day-1",
					quantity: 5000,
					role: "adjustment",
					...wallet,
				},
				"ledger_line_play_session_entry_check",
			],
			[
				{ quantity: -1, role: "buy_in", source_event_id: "alice-start" },
				"ledger_line_source_event_scope_check",
			],
			[
				{ category_id: "alice-deposit", quantity: -1, role: "buy_in" },
				"ledger_line_category_role_check",
			],
			[
				{ quantity: 5000, role: "adjustment", transfer_id: "swap", ...wallet },
				"ledger_line_exchange_transfer_check",
			],
			[
				{ price_id: "alice-entry-price", quantity: 1, role: "prize" },
				"ledger_line_price_role_check",
			],
			[
				{ price_id: "alice-entry-price", quantity: -1, role: "addon" },
				"ledger_line_price_role_check",
			],
			[
				{
					price_id: "alice-entry-price",
					quantity: 5000,
					role: "adjustment",
					...wallet,
				},
				"ledger_line_price_role_check",
			],
			[
				{
					quantity: 5000,
					role: "adjustment",
					source_event_id: "alice-start",
					...wallet,
				},
				"ledger_line_source_event_scope_check",
			],
			[{ quantity: 100, role: "rakeback" }, "ledger_line_role_check"],
			[{ effect: "estimated" }, "ledger_line_effect_check"],
		];
		for (const [index, [overrides, constraint]] of rejected.entries()) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 constraint checks sequential.
			await expect(
				insert(
					api.d1,
					"ledger_line",
					lineRow(`bad-${index}`, "alice", overrides)
				),
				JSON.stringify(overrides)
			).rejects.toThrow(`CHECK constraint failed: ${constraint}`);
		}

		expect(await ids(api.d1, "ledger_line")).toEqual(
			accepted.map((_, index) => `ok-${index}`).sort()
		);
	});

	test("assets are currencies or items with 0 to 4 decimals and unique names per user ignoring case and surrounding spaces, existing currencies default to a currency with no decimals, and rates and category names follow their keys", async ({
		api,
	}) => {
		await seedOwner(api.d1, "alice");
		await seedOwner(api.d1, "bob");

		const assets = await api.d1
			.prepare(
				"SELECT id, kind, decimals, archived_at FROM asset WHERE user_id = 'alice' ORDER BY id"
			)
			.all();
		expect(assets.results).toEqual([
			{
				archived_at: null,
				decimals: 0,
				id: "alice-currency",
				kind: "currency",
			},
			{ archived_at: null, decimals: 0, id: "alice-ticket", kind: "item" },
		]);
		await insert(api.d1, "asset", {
			decimals: 4,
			id: "usd",
			name: "USD",
			updated_at: 0,
			user_id: "alice",
		});
		for (const [overrides, constraint] of [
			[{ kind: "point" }, "asset_kind_check"],
			[{ decimals: 5 }, "asset_decimals_check"],
			[{ decimals: -1 }, "asset_decimals_check"],
		] as const) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 constraint checks sequential.
			await expect(
				insert(api.d1, "asset", {
					id: "bad-asset",
					name: "Bad",
					updated_at: 0,
					user_id: "alice",
					...overrides,
				}),
				JSON.stringify(overrides)
			).rejects.toThrow(`CHECK constraint failed: ${constraint}`);
		}
		await expect(
			insert(api.d1, "asset", {
				id: "usd-again",
				name: " usd ",
				updated_at: 0,
				user_id: "alice",
			})
		).rejects.toThrow("UNIQUE constraint failed");
		await insert(api.d1, "asset", {
			id: "bob-usd",
			name: "USD",
			updated_at: 0,
			user_id: "bob",
		});

		await insert(api.d1, "asset_rate", rateRow("from-start", "alice"));
		await insert(
			api.d1,
			"asset_rate",
			rateRow("raised", "alice", {
				effective_from: 1_790_000_000,
				rate_num: 25_000,
			})
		);
		await insert(
			api.d1,
			"asset_rate",
			rateRow("inverse", "alice", {
				base_asset_id: "alice-currency",
				quote_asset_id: "alice-ticket",
				rate_den: 20_000,
				rate_num: 1,
			})
		);
		await expect(
			insert(
				api.d1,
				"asset_rate",
				rateRow("second-from-start", "alice", { rate_num: 1 })
			)
		).rejects.toThrow(
			"UNIQUE constraint failed: asset_rate.user_id, asset_rate.base_asset_id, asset_rate.quote_asset_id, asset_rate.effective_from"
		);
		for (const [overrides, constraint] of [
			[{ quote_asset_id: "alice-ticket" }, "asset_rate_distinct_assets_check"],
			[{ rate_num: 0 }, "asset_rate_rate_num_check"],
			[{ rate_den: 1_000_000_000_001 }, "asset_rate_rate_den_check"],
		] as const) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 constraint checks sequential.
			await expect(
				insert(
					api.d1,
					"asset_rate",
					rateRow("bad-rate", "alice", { effective_from: 1, ...overrides })
				),
				JSON.stringify(overrides)
			).rejects.toThrow(`CHECK constraint failed: ${constraint}`);
		}
		expect(await ids(api.d1, "asset_rate")).toEqual([
			"from-start",
			"inverse",
			"raised",
		]);

		await expect(
			insert(api.d1, "ledger_category", {
				id: "shouting",
				name: "DEPOSIT",
				updated_at: 0,
				user_id: "alice",
			})
		).rejects.toThrow("UNIQUE constraint failed");
		await expect(
			insert(api.d1, "ledger_category", {
				id: "padded",
				name: "  deposit ",
				updated_at: 0,
				user_id: "alice",
			})
		).rejects.toThrow("UNIQUE constraint failed");
		await insert(api.d1, "ledger_category", {
			id: "withdrawal",
			name: "Withdrawal",
			updated_at: 0,
			user_id: "alice",
		});
		expect(await ids(api.d1, "ledger_category")).toEqual([
			"alice-deposit",
			"bob-deposit",
			"withdrawal",
		]);
	});

	test("an asset or category in use cannot be deleted, deleting an asset removes its rates, and deleting an entry or event removes its lines", async ({
		api,
	}) => {
		await seedOwner(api.d1, "alice");
		await insert(api.d1, "asset_rate", rateRow("rate", "alice"));
		await insert(
			api.d1,
			"ledger_line",
			lineRow("projected", "alice", {
				asset_id: "alice-ticket",
				play_session_id: "alice-day-1",
				source_event_id: "alice-start",
			})
		);
		await insert(api.d1, "ledger_line", lineRow("manual", "alice"));
		await insert(
			api.d1,
			"ledger_line",
			lineRow("deposit", "alice", {
				category_id: "alice-deposit",
				entry_id: null,
				quantity: 5000,
				role: "adjustment",
			})
		);
		await insert(api.d1, "asset", {
			id: "yen",
			name: "Yen",
			updated_at: 0,
			user_id: "alice",
		});
		await insert(api.d1, "user_setting", {
			base_asset_id: "yen",
			updated_at: 0,
			user_id: "alice",
		});

		for (const [table, id] of [
			["asset", "alice-currency"],
			["asset", "yen"],
			["ledger_category", "alice-deposit"],
		]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 constraint checks sequential.
			await expect(
				api.d1.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run(),
				`${table} ${id}`
			).rejects.toThrow(FOREIGN_KEY_FAILED);
		}

		await api.d1
			.prepare("DELETE FROM play_event WHERE id = 'alice-start'")
			.run();
		expect(await ids(api.d1, "ledger_line")).toEqual(["deposit", "manual"]);
		await api.d1.prepare("DELETE FROM asset WHERE id = 'alice-ticket'").run();
		expect(await ids(api.d1, "asset_rate")).toEqual([]);
		await api.d1.prepare("DELETE FROM entry WHERE id = 'alice-entry'").run();
		expect(await ids(api.d1, "ledger_line")).toEqual(["deposit"]);
	});

	test("deleting a user removes their assets, rates, categories, lines and settings and keeps the other user's rows", async ({
		api,
	}) => {
		for (const owner of ["alice", "bob"]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 setup sequential.
			await seedOwner(api.d1, owner);
			await insert(api.d1, "asset_rate", rateRow(`${owner}-rate`, owner));
			await insert(api.d1, "ledger_line", lineRow(`${owner}-line`, owner));
			await insert(api.d1, "user_setting", {
				base_asset_id: `${owner}-currency`,
				updated_at: 0,
				user_id: owner,
			});
		}

		await api.d1.prepare("DELETE FROM user WHERE id = 'alice'").run();

		expect(await ids(api.d1, "asset")).toEqual(["bob-currency", "bob-ticket"]);
		expect(await ids(api.d1, "asset_rate")).toEqual(["bob-rate"]);
		expect(await ids(api.d1, "ledger_category")).toEqual(["bob-deposit"]);
		expect(await ids(api.d1, "ledger_line")).toEqual(["bob-line"]);
		expect(await ids(api.d1, "user_setting", "user_id")).toEqual(["bob"]);
	});
});
