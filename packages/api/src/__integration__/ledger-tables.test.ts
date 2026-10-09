import { describe, expect } from "vitest";
import type { TestD1Database } from "./test-database";
import { test } from "./test-fixture";

type Row = Record<string, string | number | null>;

const FOREIGN_KEY_FAILED = "FOREIGN KEY constraint failed";
const MAX_QUANTITY = 1_000_000_000_000;

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

function lineRow(id: string, userId: string, overrides: Row = {}): Row {
	return {
		id,
		user_id: userId,
		asset_id: `${userId}-currency`,
		quantity: -10_000,
		role: "buy_in",
		effect: "real",
		entry_id: `${userId}-entry`,
		occurred_at: 1_790_000_000,
		updated_at: 0,
		...overrides,
	};
}

function rateRow(id: string, userId: string, overrides: Row = {}): Row {
	return {
		id,
		user_id: userId,
		base_asset_id: `${userId}-ticket`,
		quote_asset_id: `${userId}-currency`,
		rate_num: 20_000,
		rate_den: 1,
		effective_from: 0,
		...overrides,
	};
}

async function seedOwner(d1: TestD1Database, owner: string) {
	await insert(d1, "currency", {
		id: `${owner}-currency`,
		user_id: owner,
		name: "Points",
		updated_at: 0,
	});
	await insert(d1, "currency", {
		id: `${owner}-ticket`,
		user_id: owner,
		name: "Main ticket",
		kind: "item",
		updated_at: 0,
	});
	await insert(d1, "ledger_category", {
		id: `${owner}-deposit`,
		user_id: owner,
		name: "Deposit",
		updated_at: 0,
	});
	await insert(d1, "entry", {
		id: `${owner}-entry`,
		user_id: owner,
		kind: "tournament",
		source: "live",
		status: "open",
		played_on: "2026-09-05",
		updated_at: 0,
	});
	await insert(d1, "play_session", {
		id: `${owner}-day-1`,
		user_id: owner,
		entry_id: `${owner}-entry`,
		kind: "tournament",
		seq: 1,
		local_date: "2026-09-05",
		status: "ended",
		end_state: "busted",
		updated_at: 0,
	});
	await insert(d1, "play_event", {
		id: `${owner}-start`,
		user_id: owner,
		entry_id: `${owner}-entry`,
		play_session_id: `${owner}-day-1`,
		type: "session_start",
		occurred_at: 1_790_000_000,
		sort_order: 0,
		payload: "{}",
		updated_at: 0,
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
					source_event_id: "alice-start",
				}),
			],
			[
				"ledger_line",
				lineRow("bob-deposit-alice-category", "bob", {
					role: "adjustment",
					quantity: 5000,
					entry_id: null,
					category_id: "alice-deposit",
				}),
			],
			[
				"user_setting",
				{ user_id: "bob", base_asset_id: "alice-currency", updated_at: 0 },
			],
		];
		for (const [table, row] of crossOwner) {
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
				source_event_id: "bob-start",
			})
		);
		await insert(
			api.d1,
			"ledger_line",
			lineRow("bob-deposit", "bob", {
				role: "adjustment",
				quantity: 5000,
				entry_id: null,
				category_id: "bob-deposit",
			})
		);
		await insert(api.d1, "user_setting", {
			user_id: "bob",
			base_asset_id: "bob-currency",
			time_zone: "Asia/Tokyo",
			updated_at: 0,
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
			user_id: "alice",
			kind: "tournament",
			source: "manual",
			status: "settled",
			played_on: "2026-09-06",
			updated_at: 0,
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
		const wallet = { entry_id: null, category_id: "alice-deposit" };

		const accepted: Row[] = [
			{ role: "buy_in", quantity: -10_000 },
			{ role: "fee", quantity: -1000 },
			{ role: "chip_purchase", quantity: -MAX_QUANTITY },
			{ role: "prize", quantity: 1 },
			{
				role: "prize",
				quantity: 1,
				asset_id: "alice-ticket",
				effect: "virtual",
			},
			{ role: "bounty", quantity: 2000 },
			{ role: "adjustment", quantity: 5000, ...wallet },
			{ role: "adjustment", quantity: -5000, ...wallet },
			{
				role: "exchange",
				quantity: -20_000,
				entry_id: null,
				transfer_id: "swap",
			},
			{
				role: "exchange",
				quantity: 1,
				asset_id: "alice-ticket",
				entry_id: null,
				transfer_id: "swap",
			},
		];
		for (const [index, overrides] of accepted.entries()) {
			await insert(
				api.d1,
				"ledger_line",
				lineRow(`ok-${index}`, "alice", overrides)
			);
		}

		const rejected: [Row, string][] = [
			[{ role: "buy_in", quantity: 0 }, "ledger_line_quantity_check"],
			[
				{ role: "chip_purchase", quantity: -MAX_QUANTITY - 1 },
				"ledger_line_quantity_check",
			],
			[{ role: "buy_in", quantity: 10_000 }, "ledger_line_role_sign_check"],
			[{ role: "addon", quantity: 5000 }, "ledger_line_role_sign_check"],
			[{ role: "cash_out", quantity: -5000 }, "ledger_line_role_sign_check"],
			[{ role: "prize", quantity: -1 }, "ledger_line_role_sign_check"],
			[{ role: "adjustment", quantity: 5000 }, "ledger_line_role_entry_check"],
			[
				{ role: "adjustment", quantity: 5000, effect: "virtual", ...wallet },
				"ledger_line_role_entry_check",
			],
			[
				{ role: "prize", quantity: 1, entry_id: null },
				"ledger_line_role_entry_check",
			],
			[
				{ role: "prize", quantity: 1, entry_id: null, effect: "virtual" },
				"ledger_line_role_entry_check",
			],
			[
				{ role: "exchange", quantity: -20_000, entry_id: null },
				"ledger_line_exchange_transfer_check",
			],
			[
				{
					role: "adjustment",
					quantity: 5000,
					play_session_id: "alice-day-1",
					...wallet,
				},
				"ledger_line_play_session_entry_check",
			],
			[{ role: "rakeback", quantity: 100 }, "ledger_line_role_check"],
			[{ effect: "estimated" }, "ledger_line_effect_check"],
		];
		for (const [index, [overrides, constraint]] of rejected.entries()) {
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

	test("assets are currencies or items with 0 to 4 decimals, existing currencies default to a currency with no decimals, and rates and category names follow their keys", async ({
		api,
	}) => {
		await seedOwner(api.d1, "alice");
		await seedOwner(api.d1, "bob");

		const assets = await api.d1
			.prepare(
				"SELECT id, kind, decimals, archived_at FROM currency WHERE user_id = 'alice' ORDER BY id"
			)
			.all();
		expect(assets.results).toEqual([
			{
				id: "alice-currency",
				kind: "currency",
				decimals: 0,
				archived_at: null,
			},
			{ id: "alice-ticket", kind: "item", decimals: 0, archived_at: null },
		]);
		await insert(api.d1, "currency", {
			id: "usd",
			user_id: "alice",
			name: "USD",
			decimals: 4,
			updated_at: 0,
		});
		for (const [overrides, constraint] of [
			[{ kind: "point" }, "currency_kind_check"],
			[{ decimals: 5 }, "currency_decimals_check"],
			[{ decimals: -1 }, "currency_decimals_check"],
		] as const) {
			await expect(
				insert(api.d1, "currency", {
					id: "bad-asset",
					user_id: "alice",
					name: "Bad",
					updated_at: 0,
					...overrides,
				}),
				JSON.stringify(overrides)
			).rejects.toThrow(`CHECK constraint failed: ${constraint}`);
		}

		await insert(api.d1, "asset_rate", rateRow("from-start", "alice"));
		await insert(
			api.d1,
			"asset_rate",
			rateRow("raised", "alice", {
				rate_num: 25_000,
				effective_from: 1_790_000_000,
			})
		);
		await insert(
			api.d1,
			"asset_rate",
			rateRow("inverse", "alice", {
				base_asset_id: "alice-currency",
				quote_asset_id: "alice-ticket",
				rate_num: 1,
				rate_den: 20_000,
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
				user_id: "alice",
				name: "DEPOSIT",
				updated_at: 0,
			})
		).rejects.toThrow("UNIQUE constraint failed");
		await insert(api.d1, "ledger_category", {
			id: "withdrawal",
			user_id: "alice",
			name: "Withdrawal",
			updated_at: 0,
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
				role: "adjustment",
				quantity: 5000,
				entry_id: null,
				category_id: "alice-deposit",
			})
		);
		await insert(api.d1, "currency", {
			id: "yen",
			user_id: "alice",
			name: "Yen",
			updated_at: 0,
		});
		await insert(api.d1, "user_setting", {
			user_id: "alice",
			base_asset_id: "yen",
			updated_at: 0,
		});

		for (const [table, id] of [
			["currency", "alice-currency"],
			["currency", "yen"],
			["ledger_category", "alice-deposit"],
		]) {
			await expect(
				api.d1.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run(),
				`${table} ${id}`
			).rejects.toThrow(FOREIGN_KEY_FAILED);
		}

		await api.d1
			.prepare("DELETE FROM play_event WHERE id = 'alice-start'")
			.run();
		expect(await ids(api.d1, "ledger_line")).toEqual(["deposit", "manual"]);
		await api.d1
			.prepare("DELETE FROM currency WHERE id = 'alice-ticket'")
			.run();
		expect(await ids(api.d1, "asset_rate")).toEqual([]);
		await api.d1.prepare("DELETE FROM entry WHERE id = 'alice-entry'").run();
		expect(await ids(api.d1, "ledger_line")).toEqual(["deposit"]);
	});

	test("deleting a user removes their assets, rates, categories, lines and settings and keeps the other user's rows", async ({
		api,
	}) => {
		for (const owner of ["alice", "bob"]) {
			await seedOwner(api.d1, owner);
			await insert(api.d1, "asset_rate", rateRow(`${owner}-rate`, owner));
			await insert(api.d1, "ledger_line", lineRow(`${owner}-line`, owner));
			await insert(api.d1, "user_setting", {
				user_id: owner,
				base_asset_id: `${owner}-currency`,
				updated_at: 0,
			});
		}

		await api.d1.prepare("DELETE FROM user WHERE id = 'alice'").run();

		expect(await ids(api.d1, "currency")).toEqual([
			"bob-currency",
			"bob-ticket",
		]);
		expect(await ids(api.d1, "asset_rate")).toEqual(["bob-rate"]);
		expect(await ids(api.d1, "ledger_category")).toEqual(["bob-deposit"]);
		expect(await ids(api.d1, "ledger_line")).toEqual(["bob-line"]);
		expect(await ids(api.d1, "user_setting", "user_id")).toEqual(["bob"]);
	});
});
