import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// bun:sqlite is only available in Bun. CI has a dedicated `bun test` step for
// migration files, while Vitest's Node projects intentionally skip the body.
// biome-ignore lint/correctness/noUndeclaredVariables: Bun is a runtime global
const isBun = typeof Bun !== "undefined";
const skipIfNotBun = isBun ? describe : describe.skip;

let Database: any = null;
if (isBun) {
	// @ts-expect-error -- bun:sqlite only exists in the Bun runtime.
	// eslint-disable-next-line import/no-unresolved
	const bunSqlite = require("bun:sqlite");
	Database = bunSqlite.Database;
}

/**
 * preview-deploy.yml (new preview DB) and dev-deploy.yml (every deploy — the
 * dev DB is dropped and recreated each time) both seed a brand-new D1 by
 * applying every migration and then replaying a `--no-schema` dump of the
 * production database into it. The steps are hand-copied siblings, so these
 * tests pin the shared semantics for both; `bun run check:rules` separately
 * asserts that every workflow performing the restore carries the stash.
 *
 * Triggers exist to keep derived tables in sync with *application* writes. A
 * bulk restore is not an application write: the dump already carries the
 * derived rows, so an armed trigger produces a second copy of them. That is
 * not hypothetical — 0049's game_mix compat triggers rebuild
 * `game_mix_variant` from the legacy JSON mirror on every `game_mix` insert,
 * which collides with the dump's own junction rows and took the whole
 * db-migrate job down the first time a preview DB was created after 0049
 * reached production.
 *
 * These tests pin both halves of the workflows' fix: the collision is real
 * (so nobody "simplifies" the trigger stash away), and stashing the triggers
 * around the restore makes the dump the single source of truth without
 * leaving the DB permanently trigger-less.
 *
 * Only the first case names 0049's compat triggers. When the contract
 * migration drops the legacy `games` mirror they stop firing and that case
 * stops throwing — the fix is to re-point it at whatever derived-table
 * trigger remains (or delete this file once none do), NOT to conclude the
 * stash is unnecessary. The stash guards the restore against triggers in
 * general; every other case reads whatever triggers exist out of
 * sqlite_master and never names 0049.
 */

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

/** The exact query the seed steps run to stash the triggers. */
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

/**
 * The workflows' re-arm file: `cat drop-triggers.sql restore-triggers.sql`.
 *
 * The drops are what make it idempotent. SQLite strips `IF NOT EXISTS` before
 * storing DDL in sqlite_master, so the read-back CREATEs alone abort on the
 * first surviving trigger — and `wrangler d1 execute --file` stops there,
 * skipping every CREATE behind it.
 */
const rearmTriggers = (db: Database, triggers: TriggerRow[]) => {
	dropTriggers(db, triggers);
	for (const trigger of triggers) {
		db.exec(`${trigger.sql};`);
	}
};

/**
 * A DROP batch that died halfway. Derived from the live count, never a
 * literal: the contract migration in db-migrations.md leaves exactly six
 * triggers, so a hard-coded `slice(0, 6)` would quietly become a FULL drop
 * and both partial-drop cases would stop testing what they name.
 */
const halfOf = (triggers: TriggerRow[]): TriggerRow[] =>
	triggers.slice(0, Math.floor(triggers.length / 2));

const recreateTriggers = (db: Database, triggers: TriggerRow[]) => {
	for (const trigger of triggers) {
		db.exec(`${trigger.sql};`);
	}
};

/**
 * A production `--no-schema` dump, in the order `wrangler d1 export` writes it:
 * `game_mix` (carrying the legacy JSON mirror) before `game_mix_variant`
 * (carrying the authoritative junction rows production already normalized).
 */
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

		// A post-seed write is an application write again: the compat trigger
		// must still mirror `games` into the junction.
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
