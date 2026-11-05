import { describe, expect, it } from "vitest";
import { payloadSchemaForScreenKey } from "../schemas/filter-preset";
import {
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
} from "./sqlite";

const TARGET = "0073_filter_preset_final_payload.sql";

describe("migration 0073 — filter presets", () => {
	it("preserves rows and converts legacy selections to valid final payloads", () => {
		const db = openDatabase();
		try {
			db.exec("PRAGMA foreign_keys=ON");
			for (const file of migrationFiles(TARGET)) {
				for (const statement of statementsOf(file)) {
					db.exec(statement);
				}
			}
			db.exec(`
				INSERT INTO user (id,name,email) VALUES ('a','A','a@test'),('b','B','b@test');
				INSERT INTO room (id,user_id,name,updated_at) VALUES ('r','a','Room',1),('br','b','Other',1);
				INSERT INTO asset (id,user_id,name,updated_at) VALUES ('x','a','Asset',1),('bx','b','Other',1);
			`);
			const insert = db.prepare(
				"INSERT INTO filter_preset (id,user_id,screen_key,name,payload,is_default,created_at,updated_at) VALUES (?, 'a', ?, ?, ?, 0, 10, 20)"
			);
			const fixtures = [
				[
					"s",
					"sessions",
					JSON.stringify({
						period: "this_month",
						from: 1_704_067_200,
						to: 1_706_745_600,
						type: "cash_game",
						roomId: "r",
						currencyId: "x",
						display: "currency",
					}),
				],
				[
					"n",
					"sessions",
					JSON.stringify({
						currencyId: "x",
						display: "normalized",
						type: "all",
					}),
				],
				[
					"t",
					"statistics",
					JSON.stringify({
						currency: "x",
						room: "r",
						norm: "off",
						type: "tournament",
					}),
				],
				[
					"m",
					"statistics",
					JSON.stringify({
						currency: "bx",
						room: "br",
						norm: "off",
						from: 1_706_745_600,
						to: 1_704_067_200,
					}),
				],
				["d", "statistics", "{broken"],
				["a", "sessions", "[]"],
				[
					"z",
					"statistics",
					JSON.stringify({ currency: "x", norm: "normalized" }),
				],
			] as const;
			for (const [id, screen, payload] of fixtures) {
				insert.run(id, screen, id, payload);
			}
			for (const statement of statementsOf(TARGET)) {
				db.exec(statement);
			}
			const rows = db
				.prepare(
					"SELECT id, screen_key, payload, user_id, name, is_default, created_at, updated_at FROM filter_preset ORDER BY id"
				)
				.all();
			expect(rows).toHaveLength(fixtures.length);
			const payloads: Record<string, unknown> = {};
			for (const row of rows) {
				const id = String(row.id);
				const screen = row.screen_key as "sessions" | "statistics";
				const payload = JSON.parse(String(row.payload));
				expect(
					payloadSchemaForScreenKey(screen).safeParse(payload).success
				).toBe(true);
				expect([
					row.user_id,
					row.name,
					row.is_default,
					row.created_at,
					row.updated_at,
				]).toEqual(["a", id, 0, 10, 20]);
				payloads[id] = payload;
			}
			expect(payloads).toEqual({
				a: {},
				d: { normalized: true },
				m: { normalized: true },
				n: { normalized: true },
				s: {
					period: "this_month",
					dateFrom: "2024-01-01",
					dateTo: "2024-02-01",
					kind: "cash",
					roomId: "r",
					assetId: "x",
					normalized: false,
				},
				t: { kind: "tournament", roomId: "r", assetId: "x", normalized: false },
				z: { normalized: true },
			});
			expect(rowValues(db.prepare("PRAGMA foreign_key_check"))).toEqual([]);
			expect(
				rowValues(
					db.prepare(
						"SELECT name FROM sqlite_master WHERE name LIKE '__stage_0073%' OR name LIKE '__gate_0073%'"
					)
				)
			).toEqual([]);
			expect(() =>
				db.exec("UPDATE filter_preset SET payload = 'broken' WHERE id = 's'")
			).toThrow();
		} finally {
			db.close();
		}
	});
});
