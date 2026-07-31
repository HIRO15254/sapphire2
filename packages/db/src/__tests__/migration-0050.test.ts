import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// biome-ignore lint/correctness/noUndeclaredVariables: Bun global is only present in Bun runtime
const isBun = typeof Bun !== "undefined";
const skipIfNotBun = isBun ? describe : describe.skip;

let Database: any = null;
if (isBun) {
	// eslint-disable-next-line import/no-unresolved
	const bunSqlite = require("bun:sqlite");
	Database = bunSqlite.Database;
}

const migrationPath = fileURLToPath(
	new URL("../migrations/0050_magenta_professor_monster.sql", import.meta.url)
);
const migrationSql = readFileSync(migrationPath, "utf8");

const migrationStatements = migrationSql
	.split("--> statement-breakpoint")
	.map((part) => part.trim())
	.filter(Boolean);

/** `user` is the only pre-existing table the OIDC tables reference. */
const baseSchema = "CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL);";

function applyAll(db: any): void {
	for (const statement of migrationStatements) {
		db.exec(statement);
	}
}

/**
 * Apply only the statements up to and including the first one matching
 * `marker`, WITHOUT a transaction — what a production apply that dies mid-file
 * leaves behind (`wrangler` streams statements to D1 and only records the
 * migration once the last one succeeds).
 */
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

function tableNames(db: any): string[] {
	return db
		.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
		.all()
		.map((row: { name: string }) => row.name);
}

function indexNames(db: any): string[] {
	return db
		.query(
			"SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
		)
		.all()
		.map((row: { name: string }) => row.name);
}

skipIfNotBun("migration 0050 — OIDC provider tables for MCP OAuth", () => {
	let db: any;

	beforeEach(() => {
		db = new Database(":memory:");
		db.exec(baseSchema);
	});

	afterEach(() => {
		db?.close();
	});

	it("creates the three tables better-auth's mcp plugin reads and writes", () => {
		applyAll(db);
		expect(tableNames(db)).toEqual([
			"oauth_access_token",
			"oauth_application",
			"oauth_consent",
			"user",
		]);
	});

	it("creates every unique constraint and lookup index", () => {
		applyAll(db);
		expect(indexNames(db)).toEqual([
			"oauthAccessToken_clientId_idx",
			"oauthAccessToken_userId_idx",
			"oauthApplication_userId_idx",
			"oauthConsent_clientId_idx",
			"oauthConsent_userId_idx",
			"oauth_access_token_access_token_unique",
			"oauth_access_token_refresh_token_unique",
			"oauth_application_client_id_unique",
		]);
	});

	it("points the token and consent client_id FKs at oauth_application(client_id), not its id", () => {
		applyAll(db);
		for (const table of ["oauth_access_token", "oauth_consent"]) {
			const fks = db.query(`PRAGMA foreign_key_list(${table})`).all();
			expect(
				fks.map((fk: { table: string; from: string; to: string }) => ({
					table: fk.table,
					from: fk.from,
					to: fk.to,
				}))
			).toContainEqual({
				table: "oauth_application",
				from: "client_id",
				to: "client_id",
			});
		}
	});

	it("cascades token and consent rows when their user is deleted", () => {
		applyAll(db);
		db.exec("PRAGMA foreign_keys = ON");
		db.exec("INSERT INTO user (id) VALUES ('user-1')");
		db.exec(
			"INSERT INTO oauth_application (id, name, client_id, redirect_urls, type, disabled, created_at, updated_at) VALUES ('app-1', 'Claude', 'client-1', 'https://example.test/cb', 'public', 0, 0, 0)"
		);
		db.exec(
			"INSERT INTO oauth_access_token (id, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, client_id, user_id, scopes, created_at, updated_at) VALUES ('tok-1', 'a', 'r', 1, 1, 'client-1', 'user-1', 'openid', 0, 0)"
		);
		db.exec(
			"INSERT INTO oauth_consent (id, client_id, user_id, scopes, consent_given, created_at, updated_at) VALUES ('con-1', 'client-1', 'user-1', 'openid', 1, 0, 0)"
		);

		db.exec("DELETE FROM user WHERE id = 'user-1'");

		expect(
			db.query("SELECT COUNT(*) AS n FROM oauth_access_token").get()
		).toEqual({ n: 0 });
		expect(db.query("SELECT COUNT(*) AS n FROM oauth_consent").get()).toEqual({
			n: 0,
		});
	});

	it("is re-runnable: applying the whole file twice is a no-op", () => {
		applyAll(db);
		expect(() => applyAll(db)).not.toThrow();
		expect(tableNames(db)).toHaveLength(4);
		expect(indexNames(db)).toHaveLength(8);
	});

	it("recovers from a mid-file failure: a partial apply can be replayed in full", () => {
		// A production apply that died after the first CREATE TABLE leaves the
		// table behind and `d1_migrations` unrecorded, so wrangler replays the
		// whole file on the next deploy.
		applyThrough(db, "CREATE TABLE IF NOT EXISTS `oauth_access_token`");
		expect(tableNames(db)).toContain("oauth_access_token");

		expect(() => applyAll(db)).not.toThrow();
		expect(tableNames(db)).toEqual([
			"oauth_access_token",
			"oauth_application",
			"oauth_consent",
			"user",
		]);
	});

	it("recovers when the failure happened after an index was created", () => {
		applyThrough(db, "`oauthAccessToken_userId_idx`");
		expect(indexNames(db)).toContain("oauthAccessToken_userId_idx");

		expect(() => applyAll(db)).not.toThrow();
		expect(indexNames(db)).toHaveLength(8);
	});

	it("preserves rows written before a replay (no DROP/recreate)", () => {
		applyAll(db);
		db.exec("INSERT INTO user (id) VALUES ('user-1')");
		db.exec(
			"INSERT INTO oauth_application (id, name, client_id, redirect_urls, type, disabled, created_at, updated_at) VALUES ('app-1', 'Claude', 'client-1', 'https://example.test/cb', 'public', 0, 0, 0)"
		);

		applyAll(db);

		expect(
			db.query("SELECT id, client_id FROM oauth_application").all()
		).toEqual([{ id: "app-1", client_id: "client-1" }]);
	});
});
