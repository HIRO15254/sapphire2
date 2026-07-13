import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
	new URL("../migrations/0041_amazing_amphibian.sql", import.meta.url)
);
const legacyMigrationPath = fileURLToPath(
	new URL("../migrations/0038_abandoned_scalphunter.sql", import.meta.url)
);

const migrationSql = readFileSync(migrationPath, "utf8");
const legacyMigrationSql = readFileSync(legacyMigrationPath, "utf8");
const MIGRATION_FILE_PATTERN = /^\d{4}_.+\.sql$/;
const migrationsDirectory = fileURLToPath(
	new URL("../migrations/", import.meta.url)
);

const REQUIRED_GAME_INTEGRITY_TRIGGERS = [
	["game_group_label_unique_insert", "game_group"],
	["game_group_label_unique_update", "game_group"],
	["game_mix_games_reference_insert", "game_mix"],
	["game_mix_games_reference_update", "game_mix"],
	["game_mix_label_unique_insert", "game_mix"],
	["game_mix_label_unique_update", "game_mix"],
	["game_variant_label_unique_insert", "game_variant"],
	["game_variant_label_unique_update", "game_variant"],
	["game_variant_mix_reference_delete", "game_variant"],
	["game_variant_mix_reference_update", "game_variant"],
] as const;

const schemaBefore0041 = `
	CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL);
	CREATE TABLE room (id TEXT PRIMARY KEY NOT NULL);
	CREATE TABLE currency (id TEXT PRIMARY KEY NOT NULL);
	CREATE TABLE game_session (id TEXT PRIMARY KEY NOT NULL);

	CREATE TABLE ring_game (
		id TEXT PRIMARY KEY NOT NULL,
		room_id TEXT,
		user_id TEXT,
		name TEXT NOT NULL,
		variant TEXT DEFAULT 'NL Hold''em' NOT NULL,
		mix_games TEXT,
		blind1 INTEGER,
		blind2 INTEGER,
		blind3 INTEGER,
		ante INTEGER,
		ante_type TEXT,
		min_buy_in INTEGER,
		max_buy_in INTEGER,
		table_size INTEGER,
		currency_id TEXT,
		memo TEXT,
		archived_at INTEGER,
		created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
		updated_at INTEGER NOT NULL,
		FOREIGN KEY (room_id) REFERENCES room(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
		FOREIGN KEY (currency_id) REFERENCES currency(id) ON DELETE SET NULL
	);

	CREATE TABLE session_cash_detail (
		session_id TEXT PRIMARY KEY NOT NULL,
		ring_game_id TEXT,
		buy_in INTEGER,
		cash_out INTEGER,
		ev_cash_out INTEGER,
		rule_name TEXT DEFAULT 'Untitled' NOT NULL,
		variant TEXT DEFAULT 'NL Hold''em' NOT NULL,
		mix_games TEXT,
		blind1 INTEGER,
		blind2 INTEGER,
		blind3 INTEGER,
		ante INTEGER,
		ante_type TEXT,
		min_buy_in INTEGER,
		max_buy_in INTEGER,
		table_size INTEGER,
		FOREIGN KEY (session_id) REFERENCES game_session(id) ON DELETE CASCADE,
		FOREIGN KEY (ring_game_id) REFERENCES ring_game(id) ON DELETE SET NULL
	);

	CREATE TABLE tournament (
		id TEXT PRIMARY KEY NOT NULL,
		room_id TEXT NOT NULL,
		name TEXT NOT NULL,
		variant TEXT DEFAULT 'NL Hold''em' NOT NULL,
		buy_in INTEGER,
		entry_fee INTEGER,
		starting_stack INTEGER,
		bounty_amount INTEGER,
		table_size INTEGER,
		currency_id TEXT,
		memo TEXT,
		archived_at INTEGER,
		created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
		updated_at INTEGER NOT NULL,
		FOREIGN KEY (room_id) REFERENCES room(id) ON DELETE CASCADE,
		FOREIGN KEY (currency_id) REFERENCES currency(id) ON DELETE SET NULL
	);

	CREATE TABLE blind_level (
		id TEXT PRIMARY KEY NOT NULL,
		tournament_id TEXT NOT NULL,
		level INTEGER NOT NULL,
		is_break INTEGER DEFAULT 0 NOT NULL,
		blind1 INTEGER,
		blind2 INTEGER,
		blind3 INTEGER,
		ante INTEGER,
		minutes INTEGER,
		games TEXT,
		FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE
	);

	CREATE TABLE tournament_chip_purchase (
		id TEXT PRIMARY KEY NOT NULL,
		tournament_id TEXT NOT NULL,
		name TEXT NOT NULL,
		cost INTEGER NOT NULL,
		chips INTEGER NOT NULL,
		sort_order INTEGER DEFAULT 0 NOT NULL,
		FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE
	);

	CREATE TABLE tournament_tag (
		id TEXT PRIMARY KEY NOT NULL,
		tournament_id TEXT NOT NULL,
		name TEXT NOT NULL,
		created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
		FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE
	);

	CREATE TABLE session_tournament_detail (
		session_id TEXT PRIMARY KEY NOT NULL,
		tournament_id TEXT,
		tournament_buy_in INTEGER,
		entry_fee INTEGER,
		placement INTEGER,
		total_entries INTEGER,
		before_deadline INTEGER,
		prize_money INTEGER,
		bounty_prizes INTEGER,
		timer_started_at INTEGER,
		rule_name TEXT DEFAULT 'Untitled' NOT NULL,
		variant TEXT DEFAULT 'NL Hold''em' NOT NULL,
		starting_stack INTEGER,
		bounty_amount INTEGER,
		table_size INTEGER,
		FOREIGN KEY (session_id) REFERENCES game_session(id) ON DELETE CASCADE,
		FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE SET NULL
	);

	CREATE TABLE game_group (
		id TEXT PRIMARY KEY NOT NULL,
		user_id TEXT NOT NULL,
		builtin_key TEXT,
		label TEXT NOT NULL,
		blind1_label TEXT,
		blind2_label TEXT,
		blind3_label TEXT,
		created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
		updated_at INTEGER NOT NULL,
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
`;

const applyAsD1Migration = (db: Database, sql: string) => {
	const statements = sql
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter(Boolean)
		.filter((statement) => !statement.startsWith("PRAGMA foreign_keys="));

	db.transaction(() => {
		for (const statement of statements) {
			db.exec(statement);
		}
	})();
};

const applyCompleteMigrationHistory = (db: Database) => {
	const filenames = readdirSync(migrationsDirectory)
		.filter((filename) => MIGRATION_FILE_PATTERN.test(filename))
		.toSorted();
	for (const filename of filenames) {
		applyAsD1Migration(
			db,
			readFileSync(join(migrationsDirectory, filename), "utf8")
		);
	}
};

const insertBaseParents = (db: Database) => {
	db.exec(`
		INSERT INTO user (id) VALUES ('user-1');
		INSERT INTO room (id) VALUES ('room-1');
		INSERT INTO currency (id) VALUES ('currency-1');
		INSERT INTO game_session (id) VALUES ('cash-session'), ('tournament-session');
	`);
};

describe("0041_amazing_amphibian migration", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		db.exec("PRAGMA foreign_keys=ON");
		db.exec(schemaBefore0041);
		insertBaseParents(db);
	});

	afterEach(() => {
		db.close();
	});

	it("preserves ring-game and tournament children while foreign keys stay enabled", () => {
		db.exec(`
			INSERT INTO ring_game (
				id, room_id, user_id, name, currency_id, updated_at
			) VALUES ('ring-1', 'room-1', 'user-1', 'Cash Game', 'currency-1', 1);
			INSERT INTO session_cash_detail (session_id, ring_game_id)
			VALUES ('cash-session', 'ring-1');

			INSERT INTO tournament (
				id, room_id, name, currency_id, updated_at
			) VALUES ('tournament-1', 'room-1', 'Main Event', 'currency-1', 1);
			INSERT INTO blind_level (id, tournament_id, level)
			VALUES ('level-1', 'tournament-1', 1);
			INSERT INTO tournament_chip_purchase (
				id, tournament_id, name, cost, chips
			) VALUES ('purchase-1', 'tournament-1', 'Rebuy', 100, 1000);
			INSERT INTO tournament_tag (id, tournament_id, name)
			VALUES ('tag-1', 'tournament-1', 'Sunday');
			INSERT INTO session_tournament_detail (session_id, tournament_id)
			VALUES ('tournament-session', 'tournament-1');
		`);

		applyAsD1Migration(db, migrationSql);

		expect(db.query("SELECT id FROM ring_game ORDER BY id").values()).toEqual([
			["ring-1"],
		]);
		expect(
			db.query("SELECT ring_game_id FROM session_cash_detail").values()
		).toEqual([["ring-1"]]);
		expect(db.query("SELECT id FROM tournament ORDER BY id").values()).toEqual([
			["tournament-1"],
		]);
		expect(db.query("SELECT tournament_id FROM blind_level").values()).toEqual([
			["tournament-1"],
		]);
		expect(
			db.query("SELECT tournament_id FROM tournament_chip_purchase").values()
		).toEqual([["tournament-1"]]);
		expect(
			db.query("SELECT tournament_id FROM tournament_tag").values()
		).toEqual([["tournament-1"]]);
		expect(
			db.query("SELECT tournament_id FROM session_tournament_detail").values()
		).toEqual([["tournament-1"]]);
		expect(db.query("PRAGMA foreign_key_check").values()).toEqual([]);
	});

	it("reparents duplicate groups and rewrites ordered mix ids before deduplicating variants", () => {
		db.exec(`
			INSERT INTO game_group (id, user_id, builtin_key, label, updated_at) VALUES
				('group-bigbet', 'user-1', 'bigbet', 'Big Bet', 1),
				('group-bigbet-duplicate', 'user-1', 'bigbet', 'Big Bet', 2),
				('group-stud', 'user-1', 'stud', 'Stud', 1),
				('group-stud-duplicate', 'user-1', 'stud', 'Seven Card Games', 2),
				('group-custom', 'user-1', NULL, 'Custom', 1),
				('group-custom-duplicate', 'user-1', NULL, ' custom ', 2);

			INSERT INTO game_variant (
				id, user_id, builtin_key, label, group_id, sort_order, updated_at
			) VALUES
				('variant-nlh', 'user-1', 'nlh', 'NL Hold''em', 'group-bigbet', 0, 1),
				('variant-nlh-duplicate', 'user-1', 'nlh', 'NL Hold''em', 'group-bigbet-duplicate', 0, 2),
				('variant-stud', 'user-1', 'stud', 'Seven Card Stud', 'group-stud', 1, 1),
				('variant-stud-duplicate', 'user-1', 'stud', 'Stud Poker', 'group-stud-duplicate', 1, 2),
				('variant-custom', 'user-1', NULL, 'Custom Variant', 'group-custom', 2, 1),
				('variant-custom-duplicate', 'user-1', NULL, ' CUSTOM variant ', 'group-custom-duplicate', 2, 2),
				('variant-other', 'user-1', NULL, 'Other Variant', 'group-bigbet', 3, 1);

			INSERT INTO game_mix (
				id, user_id, builtin_key, label, games, updated_at
			) VALUES
				(
					'mix-custom', 'user-1', NULL, 'Custom Mix',
					'["variant-other","variant-nlh-duplicate","variant-stud-duplicate","variant-custom-duplicate"]', 1
				),
				(
					'mix-horse', 'user-1', 'horse', 'HORSE',
					'["variant-stud-duplicate","variant-other"]', 1
				),
				(
					'mix-horse-duplicate', 'user-1', 'horse', 'HORSE',
					'["variant-other","variant-stud"]', 2
				),
				(
					'mix-custom-duplicate', 'user-1', NULL, ' custom MIX ',
					'["variant-stud","variant-other"]', 2
				);
		`);

		applyAsD1Migration(db, migrationSql);

		expect(db.query("SELECT id FROM game_group ORDER BY id").values()).toEqual([
			["group-bigbet"],
			["group-custom"],
			["group-stud"],
		]);
		expect(
			db.query("SELECT id, group_id FROM game_variant ORDER BY id").values()
		).toEqual([
			["variant-custom", "group-custom"],
			["variant-nlh", "group-bigbet"],
			["variant-other", "group-bigbet"],
			["variant-stud", "group-stud"],
		]);
		expect(
			db.query("SELECT games FROM game_mix WHERE id = 'mix-custom'").values()
		).toEqual([
			['["variant-other","variant-nlh","variant-stud","variant-custom"]'],
		]);
		expect(
			db.query("SELECT id FROM game_mix WHERE builtin_key = 'horse'").values()
		).toEqual([["mix-horse"]]);
		expect(db.query("SELECT id FROM game_mix ORDER BY id").values()).toEqual([
			["mix-custom"],
			["mix-horse"],
		]);
		expect(
			db
				.query(`
					SELECT game_mix.id, json_each.value
					FROM game_mix, json_each(game_mix.games)
					LEFT JOIN game_variant ON game_variant.id = json_each.value
					WHERE game_variant.id IS NULL
				`)
				.values()
		).toEqual([]);
		expect(db.query("PRAGMA foreign_key_check").values()).toEqual([]);
	});

	it("carries legacy custom variants into the new group and variant masters", () => {
		db.exec(`
			CREATE TABLE custom_game_variant (
				id TEXT PRIMARY KEY NOT NULL,
				user_id TEXT NOT NULL,
				label TEXT NOT NULL,
				blind1_label TEXT,
				blind2_label TEXT,
				blind3_label TEXT,
				created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
				updated_at INTEGER NOT NULL,
				FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
			);
			INSERT INTO custom_game_variant (
				id, user_id, label, blind1_label, blind2_label, blind3_label,
				created_at, updated_at
			) VALUES (
				'legacy-variant', 'user-1', 'Double Board', 'SB', 'BB', 'Button', 10, 20
			);
		`);

		applyAsD1Migration(db, legacyMigrationSql);
		applyAsD1Migration(db, migrationSql);

		expect(
			db
				.query(`
					SELECT label, blind1_label, blind2_label, blind3_label,
						created_at, updated_at
					FROM game_group
					WHERE id = 'legacy-group-legacy-variant'
				`)
				.values()
		).toEqual([["Double Board Blinds", "SB", "BB", "Button", 10, 20]]);
		expect(
			db
				.query(`
					SELECT id, label, group_id, created_at, updated_at
					FROM game_variant
					WHERE id = 'legacy-variant'
				`)
				.values()
		).toEqual([
			["legacy-variant", "Double Board", "legacy-group-legacy-variant", 10, 20],
		]);
		expect(
			db
				.query(`
					SELECT name FROM sqlite_master
					WHERE type = 'table' AND name = '__legacy_custom_game_variant'
				`)
				.values()
		).toEqual([]);
		expect(db.query("PRAGMA foreign_key_check").values()).toEqual([]);
	});

	it("rejects trimmed case-insensitive label conflicts including the variant-mix namespace", () => {
		applyAsD1Migration(db, migrationSql);
		db.exec(`
			INSERT INTO user (id) VALUES ('user-2');
			INSERT INTO game_group (id, user_id, label, updated_at)
			VALUES ('group-1', 'user-1', 'Mixed Games', 1);
			INSERT INTO game_group (id, user_id, label, updated_at)
			VALUES ('group-2', 'user-2', ' mixed games ', 1);
			INSERT INTO game_variant (
				id, user_id, label, group_id, updated_at
			) VALUES
				('variant-1', 'user-1', 'Shared Name', 'group-1', 1),
				('variant-2', 'user-1', 'Other Game', 'group-1', 1),
				('variant-user-2', 'user-2', ' shared name ', 'group-2', 1);
		`);

		expect(() =>
			db.exec(`
				INSERT INTO game_group (id, user_id, label, updated_at)
				VALUES ('group-duplicate', 'user-1', ' mixed games ', 1)
			`)
		).toThrow("game_group label already exists");
		expect(() =>
			db.exec(`
				INSERT INTO game_variant (
					id, user_id, label, group_id, updated_at
				) VALUES (
					'variant-duplicate', 'user-1', ' shared NAME ', 'group-1', 1
				)
			`)
		).toThrow("game master label already exists");
		expect(() =>
			db.exec(`
				INSERT INTO game_mix (id, user_id, label, games, updated_at)
				VALUES (
					'mix-conflict', 'user-1', ' shared name ',
					'["variant-1","variant-2"]', 1
				)
			`)
		).toThrow("game master label already exists");

		db.exec(`
			INSERT INTO game_mix (id, user_id, label, games, updated_at)
			VALUES (
				'mix-1', 'user-1', 'Rotation',
				'["variant-1","variant-2"]', 1
			)
		`);
		expect(() =>
			db.exec(`
				UPDATE game_variant SET label = ' rotation '
				WHERE id = 'variant-2'
			`)
		).toThrow("game master label already exists");
		expect(() =>
			db.exec(`
				UPDATE game_mix SET label = ' other GAME '
				WHERE id = 'mix-1'
			`)
		).toThrow("game master label already exists");
	});

	it("rejects missing and cross-owner mix ids and prevents deleting referenced variants", () => {
		applyAsD1Migration(db, migrationSql);
		db.exec(`
			INSERT INTO user (id) VALUES ('user-2');
			INSERT INTO game_group (id, user_id, label, updated_at) VALUES
				('group-1', 'user-1', 'User One Group', 1),
				('group-2', 'user-2', 'User Two Group', 1);
			INSERT INTO game_variant (
				id, user_id, label, group_id, updated_at
			) VALUES
				('variant-1', 'user-1', 'Game One', 'group-1', 1),
				('variant-2', 'user-1', 'Game Two', 'group-1', 1),
				('variant-unused', 'user-1', 'Unused Game', 'group-1', 1),
				('variant-other-user', 'user-2', 'Other User Game', 'group-2', 1);
		`);

		expect(() =>
			db.exec(`
				INSERT INTO game_mix (id, user_id, label, games, updated_at)
				VALUES ('mix-missing', 'user-1', 'Missing', '["variant-1","missing"]', 1)
			`)
		).toThrow("game_mix contains an unavailable variant");
		expect(() =>
			db.exec(`
				INSERT INTO game_mix (id, user_id, label, games, updated_at)
				VALUES (
					'mix-cross-owner', 'user-1', 'Cross Owner',
					'["variant-1","variant-other-user"]', 1
				)
			`)
		).toThrow("game_mix contains an unavailable variant");

		db.exec(`
			INSERT INTO game_mix (id, user_id, label, games, updated_at)
			VALUES (
				'mix-valid', 'user-1', 'Valid Mix',
				'["variant-2","variant-1"]', 1
			)
		`);
		expect(() =>
			db.exec(`
				UPDATE game_mix SET games = '["variant-1","missing"]'
				WHERE id = 'mix-valid'
			`)
		).toThrow("game_mix contains an unavailable variant");
		expect(() =>
			db.exec("DELETE FROM game_variant WHERE id = 'variant-1'")
		).toThrow("game_variant is referenced by a mix");
		expect(() =>
			db.exec("DELETE FROM game_variant WHERE id = 'variant-unused'")
		).not.toThrow();
		expect(
			db.query("SELECT games FROM game_mix WHERE id = 'mix-valid'").values()
		).toEqual([['["variant-2","variant-1"]']]);
		expect(db.query("PRAGMA foreign_key_check").values()).toEqual([]);
	});
});

describe("complete migration history", () => {
	it("keeps the 0041 game-integrity triggers after every migration", () => {
		const db = new Database(":memory:");
		db.exec("PRAGMA foreign_keys=ON");

		try {
			applyCompleteMigrationHistory(db);

			expect(
				db
					.query(`
						SELECT name, tbl_name
						FROM sqlite_master
						WHERE type = 'trigger'
							AND name IN (
								'game_group_label_unique_insert',
								'game_group_label_unique_update',
								'game_mix_games_reference_insert',
								'game_mix_games_reference_update',
								'game_mix_label_unique_insert',
								'game_mix_label_unique_update',
								'game_variant_label_unique_insert',
								'game_variant_label_unique_update',
								'game_variant_mix_reference_delete',
								'game_variant_mix_reference_update'
							)
						ORDER BY name
					`)
					.values()
			).toEqual(REQUIRED_GAME_INTEGRITY_TRIGGERS);
		} finally {
			db.close();
		}
	});
});
