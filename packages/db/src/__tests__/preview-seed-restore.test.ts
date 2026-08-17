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

const MIGRATION_FILE_PATTERN = /^\d{4}_.+\.sql$/;
const POSITION_UNIQUE_VIOLATION =
	/UNIQUE constraint failed: game_mix_variant\.mix_id, game_mix_variant\.position/;
const TRIGGER_ALREADY_EXISTS = /already exists/;
const migrationsDirectory = fileURLToPath(
	new URL("../migrations/", import.meta.url)
);

const applyAsD1Migration = (db: Database, sql: string) => {
	const statements = sql
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter(Boolean)
		.filter((statement) => !statement.startsWith("PRAGMA foreign_keys="));
	for (const statement of statements) {
		db.exec(statement);
	}
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

interface TriggerRow {
	name: string;
	sql: string;
}

const readTriggers = (db: Database): TriggerRow[] =>
	db
		.query(
			"SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND sql IS NOT NULL ORDER BY name"
		)
		.all() as TriggerRow[];

const dropTriggers = (db: Database, triggers: TriggerRow[]) => {
	for (const trigger of triggers) {
		db.exec(`DROP TRIGGER IF EXISTS \`${trigger.name}\`;`);
	}
};

const rearmTriggers = (db: Database, triggers: TriggerRow[]) => {
	dropTriggers(db, triggers);
	for (const trigger of triggers) {
		db.exec(`${trigger.sql};`);
	}
};

const halfOf = (triggers: TriggerRow[]): TriggerRow[] =>
	triggers.slice(0, Math.floor(triggers.length / 2));

const recreateTriggers = (db: Database, triggers: TriggerRow[]) => {
	for (const trigger of triggers) {
		db.exec(`${trigger.sql};`);
	}
};

const replayProductionDump = (db: Database) => {
	db.exec("PRAGMA foreign_keys = OFF;");
	db.exec(
		`INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
			VALUES ('user-1', 'U', 'u@example.com', 1, 0, 0);`
	);
	db.exec(
		`INSERT INTO game_group (id, user_id, label, created_at, updated_at)
			VALUES ('group-1', 'user-1', 'Holdem', 0, 0);`
	);
	db.exec(
		`INSERT INTO game_variant (id, user_id, label, group_id, sort_order, created_at, updated_at)
			VALUES ('variant-1', 'user-1', 'NLH', 'group-1', 0, 0, 0),
			       ('variant-2', 'user-1', 'PLO', 'group-1', 1, 0, 0);`
	);
	db.exec(
		`INSERT INTO game_mix (id, user_id, label, games, created_at, updated_at)
			VALUES ('mix-1', 'user-1', 'Mix', '["variant-1","variant-2"]', 0, 0);`
	);
	db.exec(
		`INSERT INTO game_mix_variant (mix_id, variant_id, user_id, position)
			VALUES ('mix-1', 'variant-1', 'user-1', 0),
			       ('mix-1', 'variant-2', 'user-1', 1);`
	);
	db.exec("PRAGMA foreign_keys = ON;");
};

skipIfNotBun("seed restore (preview-deploy.yml, dev-deploy.yml)", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		applyCompleteMigrationHistory(db);
	});

	afterEach(() => {
		db.close();
	});

	it("collides on game_mix_variant when the dump is replayed with triggers armed", () => {
		expect(() => replayProductionDump(db)).toThrow(POSITION_UNIQUE_VIOLATION);
	});

	it("replays the dump cleanly once the triggers are stashed", () => {
		dropTriggers(db, readTriggers(db));
		expect(() => replayProductionDump(db)).not.toThrow();
	});

	it("keeps the dump's junction rows as the only ones, not the trigger's rebuild", () => {
		const stashed = readTriggers(db);
		dropTriggers(db, stashed);
		replayProductionDump(db);
		recreateTriggers(db, stashed);

		expect(
			db
				.query(
					"SELECT mix_id, variant_id, user_id, position FROM game_mix_variant ORDER BY position"
				)
				.all()
		).toEqual([
			{
				mix_id: "mix-1",
				variant_id: "variant-1",
				user_id: "user-1",
				position: 0,
			},
			{
				mix_id: "mix-1",
				variant_id: "variant-2",
				user_id: "user-1",
				position: 1,
			},
		]);
	});

	it("re-arms every stashed trigger, byte-identically", () => {
		const stashed = readTriggers(db);
		expect(stashed.length).toBeGreaterThan(0);

		dropTriggers(db, stashed);
		expect(readTriggers(db)).toEqual([]);

		replayProductionDump(db);
		recreateTriggers(db, stashed);
		expect(readTriggers(db)).toEqual(stashed);
	});

	it("does not survive a partial drop when the re-arm skips the drops", () => {
		const stashed = readTriggers(db);
		dropTriggers(db, halfOf(stashed));

		expect(() => recreateTriggers(db, stashed)).toThrow(TRIGGER_ALREADY_EXISTS);
	});

	it("re-arms every trigger from a partially dropped state", () => {
		const stashed = readTriggers(db);
		dropTriggers(db, halfOf(stashed));

		rearmTriggers(db, stashed);
		expect(readTriggers(db)).toEqual(stashed);
	});

	it("re-arms idempotently when no trigger was dropped at all", () => {
		const stashed = readTriggers(db);

		rearmTriggers(db, stashed);
		expect(readTriggers(db)).toEqual(stashed);
	});

	it("leaves the re-armed triggers deriving rows for real application writes", () => {
		const stashed = readTriggers(db);
		dropTriggers(db, stashed);
		replayProductionDump(db);
		recreateTriggers(db, stashed);

		db.exec(
			`INSERT INTO game_mix (id, user_id, label, games, created_at, updated_at)
				VALUES ('mix-2', 'user-1', 'Mix2', '["variant-2"]', 0, 0);`
		);

		expect(
			db
				.query(
					"SELECT variant_id, position FROM game_mix_variant WHERE mix_id = 'mix-2'"
				)
				.all()
		).toEqual([{ variant_id: "variant-2", position: 0 }]);
	});
});
