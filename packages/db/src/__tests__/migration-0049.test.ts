import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// biome-ignore lint/correctness/noUndeclaredVariables: Bun is a runtime global
const isBun = typeof Bun !== "undefined";
const skipIfNotBun = isBun ? describe : describe.skip;

let Database: any = null;
if (isBun) {
	// @ts-expect-error -- bun:sqlite only exists in the Bun runtime.
	const bunSqlite = require("bun:sqlite");
	Database = bunSqlite.Database;
}

const migrationsDirectory = fileURLToPath(
	new URL("../migrations/", import.meta.url)
);
const MIGRATION_0049_PATTERN = /^0049_.+\.sql$/;
const UNIQUE_CONSTRAINT_PATTERN = /UNIQUE constraint failed/;
const CHECK_CONSTRAINT_PATTERN = /CHECK constraint failed/;
const FOREIGN_KEY_CONSTRAINT_PATTERN = /FOREIGN KEY constraint failed/;
const migrationFile = readdirSync(migrationsDirectory).find((name) =>
	MIGRATION_0049_PATTERN.test(name)
);
if (!migrationFile) {
	throw new Error("migration 0049 is missing");
}
const migrationSql = readFileSync(
	join(migrationsDirectory, migrationFile),
	"utf8"
);

const FINAL_TRIGGERS = [
	["game_group_label_unique_insert", "game_group"],
	["game_group_label_unique_update", "game_group"],
	["game_mix_games_reference_insert", "game_mix"],
	["game_mix_games_reference_update", "game_mix"],
	["game_mix_label_unique_insert", "game_mix"],
	["game_mix_label_unique_update", "game_mix"],
	["game_mix_variants_compat_insert", "game_mix"],
	["game_mix_variants_compat_update", "game_mix"],
	["game_variant_label_unique_insert", "game_variant"],
	["game_variant_label_unique_update", "game_variant"],
	["game_variant_mix_reference_delete", "game_variant"],
	["game_variant_mix_reference_update", "game_variant"],
] as const;
const schemaBefore0049 = `
	CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL);
	CREATE TABLE game_group (
		id TEXT PRIMARY KEY NOT NULL,
		user_id TEXT NOT NULL,
		label TEXT NOT NULL,
		FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
	);
	CREATE TABLE game_variant (
		id TEXT PRIMARY KEY NOT NULL,
		user_id TEXT NOT NULL,
		builtin_key TEXT,
		label TEXT NOT NULL,
		short_label TEXT,
		group_id TEXT NOT NULL,
		sort_order INTEGER DEFAULT 0 NOT NULL,
		created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
		updated_at INTEGER NOT NULL,
		FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
		FOREIGN KEY (group_id) REFERENCES game_group(id) ON DELETE RESTRICT
	);
	CREATE TABLE game_mix (
		id TEXT PRIMARY KEY NOT NULL,
		user_id TEXT NOT NULL,
		builtin_key TEXT,
		label TEXT NOT NULL,
		games TEXT NOT NULL,
		created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
		updated_at INTEGER NOT NULL,
		FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
	);

	CREATE TRIGGER game_group_label_unique_insert
		BEFORE INSERT ON game_group BEGIN SELECT 1; END;
	CREATE TRIGGER game_group_label_unique_update
		BEFORE UPDATE ON game_group BEGIN SELECT 1; END;
	CREATE TRIGGER game_variant_label_unique_insert
		BEFORE INSERT ON game_variant BEGIN SELECT 1; END;
	CREATE TRIGGER game_variant_label_unique_update
		BEFORE UPDATE ON game_variant BEGIN SELECT 1; END;
	CREATE TRIGGER game_mix_label_unique_insert
		BEFORE INSERT ON game_mix BEGIN SELECT 1; END;
	CREATE TRIGGER game_mix_label_unique_update
		BEFORE UPDATE ON game_mix BEGIN SELECT 1; END;
	CREATE TRIGGER game_mix_games_reference_insert
		BEFORE INSERT ON game_mix BEGIN SELECT 1; END;
	CREATE TRIGGER game_mix_games_reference_update
		BEFORE UPDATE ON game_mix BEGIN SELECT 1; END;
	CREATE TRIGGER game_variant_mix_reference_delete
		BEFORE DELETE ON game_variant BEGIN SELECT 1; END;
	CREATE TRIGGER game_variant_mix_reference_update
		BEFORE UPDATE ON game_variant BEGIN SELECT 1; END;
`;

const migrationStatements = migrationSql
	.split("--> statement-breakpoint")
	.map((part) => part.trim())
	.filter(Boolean);

function applyAtomically(db: any): void {
	db.exec("BEGIN");
	try {
		for (const statement of migrationStatements) {
			db.exec(statement);
		}
		db.exec("COMMIT");
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}
}

function applyThrough(db: any, marker: string): void {
	const cut = migrationStatements.findIndex((statement) =>
		statement.includes(marker)
	);
	if (cut < 0) {
		throw new Error(`no migration statement matches ${marker}`);
	}
	for (const statement of migrationStatements.slice(0, cut + 1)) {
		db.exec(statement);
	}
}

function seedLegacyRows(db: any): void {
	db.exec(`
		INSERT INTO user (id) VALUES ('user-1'), ('user-2');
		INSERT INTO game_group (id, user_id, label) VALUES
			('group-1', 'user-1', 'Group One'),
			('group-2', 'user-2', 'Group Two');
		INSERT INTO game_variant (
			id, user_id, label, group_id, sort_order, created_at, updated_at
		) VALUES
			('variant-1', 'user-1', 'Variant One', 'group-1', 0, 11, 21),
			('variant-2', 'user-1', 'Variant Two', 'group-1', 1, 12, 22),
			('variant-free', 'user-1', 'Variant Free', 'group-1', 2, 13, 23),
			('variant-3', 'user-2', 'Variant Three', 'group-2', 0, 14, 24);
		INSERT INTO game_mix (
			id, user_id, builtin_key, label, games, created_at, updated_at
		) VALUES
			(
				'mix-ordered', 'user-1', 'horse', 'Ordered',
				'["variant-2","variant-1"]', 31, 41
			),
			('mix-empty', 'user-1', NULL, 'Empty', '[]', 32, 42),
			('mix-user-2', 'user-2', NULL, 'Other', '["variant-3"]', 33, 43);
	`);
}

skipIfNotBun("migration 0049 — normalized game mix variants", () => {
	let db: any;

	beforeEach(() => {
		db = new Database(":memory:");
		db.exec("PRAGMA foreign_keys=ON");
		db.exec(schemaBefore0049);
	});

	afterEach(() => {
		db?.close();
	});

	it("backfills exact order while preserving every game_mix value", () => {
		seedLegacyRows(db);
		const before = db
			.query(`
				SELECT id, user_id, builtin_key, label, games, created_at, updated_at
				FROM game_mix ORDER BY id
			`)
			.values();

		applyAtomically(db);

		expect(
			db
				.query(`
					SELECT mix_id, variant_id, user_id, position
					FROM game_mix_variant ORDER BY mix_id, position
				`)
				.values()
		).toEqual([
			["mix-ordered", "variant-2", "user-1", 0],
			["mix-ordered", "variant-1", "user-1", 1],
			["mix-user-2", "variant-3", "user-2", 0],
		]);
		expect(
			db
				.query(`
					SELECT id, user_id, builtin_key, label, games, created_at, updated_at
					FROM game_mix ORDER BY id
				`)
				.values()
		).toEqual(before);
		expect(
			db
				.query("PRAGMA table_info(game_mix)")
				.all()
				.map((column: { name: string }) => column.name)
		).toContain("games");
		expect(db.query("PRAGMA foreign_key_check").values()).toEqual([]);
	});

	it("keeps legacy integrity triggers and adds rolling-deploy sync triggers", () => {
		seedLegacyRows(db);
		applyAtomically(db);

		expect(
			db
				.query(`
					SELECT name, tbl_name FROM sqlite_master
					WHERE type = 'trigger' ORDER BY name
				`)
				.values()
		).toEqual(FINAL_TRIGGERS);
	});
	it("keeps the legacy Worker table contract synchronized during deployment", () => {
		seedLegacyRows(db);
		applyAtomically(db);

		expect(
			db.query(`SELECT type FROM sqlite_master WHERE name = 'game_mix'`).get()
		).toEqual({ type: "table" });
		expect(() =>
			db.exec(`
				INSERT INTO game_mix (
					id, user_id, builtin_key, label, games, created_at, updated_at
				) VALUES (
					'mix-compat', 'user-1', NULL, 'Compatibility',
					'["variant-1","variant-free"]', 51, 61
				) ON CONFLICT DO NOTHING
			`)
		).not.toThrow();
		expect(
			db
				.query(`
					SELECT variant_id, position FROM game_mix_variant
					WHERE mix_id = 'mix-compat' ORDER BY position
				`)
				.values()
		).toEqual([
			["variant-1", 0],
			["variant-free", 1],
		]);

		db.exec(`
			UPDATE game_mix
			SET games = '["variant-free","variant-2"]'
			WHERE id = 'mix-compat'
		`);
		expect(
			db
				.query(`
					SELECT variant_id, position FROM game_mix_variant
					WHERE mix_id = 'mix-compat' ORDER BY position
				`)
				.values()
		).toEqual([
			["variant-free", 0],
			["variant-2", 1],
		]);
		expect(
			db.query("SELECT games FROM game_mix WHERE id = 'mix-compat'").get()
		).toEqual({ games: '["variant-free","variant-2"]' });
	});
	it("creates the planned association indexes", () => {
		seedLegacyRows(db);
		applyAtomically(db);

		expect(
			db
				.query(`SELECT name FROM sqlite_master WHERE type = 'index'
					AND name LIKE 'game_mix_variant_%' ORDER BY name`)
				.values()
		).toEqual([
			["game_mix_variant_mix_position_unique"],
			["game_mix_variant_user_mix_position_idx"],
			["game_mix_variant_variant_user_idx"],
		]);
	});

	it("rejects the same variant twice within one mix", () => {
		seedLegacyRows(db);
		applyAtomically(db);
		expect(() =>
			db.exec(`INSERT INTO game_mix_variant VALUES
				('mix-ordered', 'variant-2', 'user-1', 9)`)
		).toThrow(UNIQUE_CONSTRAINT_PATTERN);
	});

	it("rejects two variants at the same position within one mix", () => {
		seedLegacyRows(db);
		applyAtomically(db);
		expect(() =>
			db.exec(`INSERT INTO game_mix_variant VALUES
				('mix-ordered', 'variant-free', 'user-1', 0)`)
		).toThrow(UNIQUE_CONSTRAINT_PATTERN);
	});

	it("rejects negative positions", () => {
		seedLegacyRows(db);
		applyAtomically(db);
		expect(() =>
			db.exec(`INSERT INTO game_mix_variant VALUES
				('mix-empty', 'variant-free', 'user-1', -1)`)
		).toThrow(CHECK_CONSTRAINT_PATTERN);
	});

	it("rejects links whose mix and variant owners differ", () => {
		seedLegacyRows(db);
		applyAtomically(db);
		expect(() =>
			db.exec(`INSERT INTO game_mix_variant VALUES
				('mix-empty', 'variant-3', 'user-1', 0)`)
		).toThrow(FOREIGN_KEY_CONSTRAINT_PATTERN);
	});

	it("cascades links when a mix is deleted", () => {
		seedLegacyRows(db);
		applyAtomically(db);
		db.exec("DELETE FROM game_mix WHERE id = 'mix-ordered'");
		expect(
			db.query("SELECT COUNT(*) AS count FROM game_mix_variant").get()
		).toEqual({ count: 1 });
	});

	it("prevents direct deletion of a referenced variant", () => {
		seedLegacyRows(db);
		applyAtomically(db);
		expect(() =>
			db.exec("DELETE FROM game_variant WHERE id = 'variant-1'")
		).toThrow(FOREIGN_KEY_CONSTRAINT_PATTERN);
	});

	it("allows owner deletion to cascade through mixes, variants, and links", () => {
		seedLegacyRows(db);
		applyAtomically(db);
		expect(() => db.exec("DELETE FROM user WHERE id = 'user-2'")).not.toThrow();
		expect(
			db.query("SELECT id FROM user WHERE id = 'user-2'").values()
		).toEqual([]);
		expect(
			db.query("SELECT id FROM game_group WHERE user_id = 'user-2'").values()
		).toEqual([]);
		expect(
			db.query("SELECT id FROM game_variant WHERE user_id = 'user-2'").values()
		).toEqual([]);
		expect(
			db.query("SELECT id FROM game_mix WHERE user_id = 'user-2'").values()
		).toEqual([]);
		expect(
			db.query("SELECT COUNT(*) AS count FROM game_mix_variant").get()
		).toEqual({ count: 2 });
		expect(db.query("PRAGMA foreign_key_check").values()).toEqual([]);
	});

	describe("defensive backfill of legacy game_mix.games rows", () => {
		it("collapses a repeated id to its first occurrence instead of aborting", () => {
			seedLegacyRows(db);
			db.exec(`UPDATE game_mix
				SET games = '["variant-1","variant-2","variant-1"]'
				WHERE id = 'mix-ordered'`);

			expect(() => applyAtomically(db)).not.toThrow();
			expect(
				db
					.query(`SELECT variant_id, position FROM game_mix_variant
						WHERE mix_id = 'mix-ordered' ORDER BY position`)
					.values()
			).toEqual([
				["variant-1", 0],
				["variant-2", 1],
			]);
			expect(
				db.query("SELECT games FROM game_mix WHERE id = 'mix-ordered'").get()
			).toEqual({ games: '["variant-1","variant-2","variant-1"]' });
		});

		it("drops ids that resolve to no variant and renumbers positions densely", () => {
			seedLegacyRows(db);
			db.exec(`UPDATE game_mix
				SET games = '["deleted-variant","variant-1","variant-2"]'
				WHERE id = 'mix-ordered'`);

			expect(() => applyAtomically(db)).not.toThrow();
			expect(
				db
					.query(`SELECT variant_id, position FROM game_mix_variant
						WHERE mix_id = 'mix-ordered' ORDER BY position`)
					.values()
			).toEqual([
				["variant-1", 0],
				["variant-2", 1],
			]);
			expect(db.query("PRAGMA foreign_key_check").values()).toEqual([]);
		});

		it("drops ids owned by another user", () => {
			seedLegacyRows(db);
			db.exec(`UPDATE game_mix
				SET games = '["variant-3","variant-1"]'
				WHERE id = 'mix-ordered'`);

			expect(() => applyAtomically(db)).not.toThrow();
			expect(
				db
					.query(`SELECT variant_id, position FROM game_mix_variant
						WHERE mix_id = 'mix-ordered' ORDER BY position`)
					.values()
			).toEqual([["variant-1", 0]]);
		});

		it("skips malformed JSON, non-array JSON, and non-string entries", () => {
			seedLegacyRows(db);
			db.exec(`
				UPDATE game_mix SET games = 'not json at all' WHERE id = 'mix-ordered';
				UPDATE game_mix SET games = '{"variant-1":true}' WHERE id = 'mix-empty';
				UPDATE game_mix SET games = '[1,null,"variant-1"]' WHERE id = 'mix-user-2';
			`);

			expect(() => applyAtomically(db)).not.toThrow();
			expect(
				db
					.query(`SELECT mix_id, variant_id, position FROM game_mix_variant
						ORDER BY mix_id, position`)
					.values()
			).toEqual([]);
			expect(
				db.query("SELECT games FROM game_mix WHERE id = 'mix-ordered'").get()
			).toEqual({ games: "not json at all" });
		});

		it("re-applies cleanly when the whole file is applied twice", () => {
			seedLegacyRows(db);
			applyAtomically(db);
			const rowsAfterFirstApply = db
				.query(`SELECT mix_id, variant_id, user_id, position
					FROM game_mix_variant ORDER BY mix_id, position`)
				.values();

			expect(() => applyAtomically(db)).not.toThrow();
			expect(
				db
					.query(`SELECT mix_id, variant_id, user_id, position
						FROM game_mix_variant ORDER BY mix_id, position`)
					.values()
			).toEqual(rowsAfterFirstApply);
			expect(
				db
					.query(`SELECT name, tbl_name FROM sqlite_master
						WHERE type = 'trigger' ORDER BY name`)
					.values()
			).toEqual(FINAL_TRIGGERS);
		});

		it("resumes from a failure that landed between the backfill and the triggers", () => {
			seedLegacyRows(db);
			applyThrough(db, "INSERT OR IGNORE INTO `game_mix_variant`");

			expect(() => applyAtomically(db)).not.toThrow();
			expect(
				db
					.query(`SELECT mix_id, variant_id, position
						FROM game_mix_variant ORDER BY mix_id, position`)
					.values()
			).toEqual([
				["mix-ordered", "variant-2", 0],
				["mix-ordered", "variant-1", 1],
				["mix-user-2", "variant-3", 0],
			]);
			expect(
				db
					.query(`SELECT name, tbl_name FROM sqlite_master
						WHERE type = 'trigger' ORDER BY name`)
					.values()
			).toEqual(FINAL_TRIGGERS);
		});

		it("heals junction rows the old Worker desynced while the triggers were absent", () => {
			seedLegacyRows(db);
			applyThrough(db, "INSERT OR IGNORE INTO `game_mix_variant`");
			db.exec(`UPDATE game_mix SET games = '["variant-free","variant-1"]'
				WHERE id = 'mix-ordered'`);
			db.exec(`UPDATE game_mix SET games = '[]' WHERE id = 'mix-user-2'`);

			applyAtomically(db);

			expect(
				db
					.query(`SELECT mix_id, variant_id, position
						FROM game_mix_variant ORDER BY mix_id, position`)
					.values()
			).toEqual([
				["mix-ordered", "variant-free", 0],
				["mix-ordered", "variant-1", 1],
			]);
		});
	});
});
