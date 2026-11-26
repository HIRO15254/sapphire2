import type { DatabaseSync, SQLOutputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
	openMigratedDatabase,
	SCRUB_POLICY,
	scrubSeed,
	unclassified,
} from "../scrub-seed";

const SECRETS = [
	"owner@example.com",
	"https://lh3.googleusercontent.com/a/owner-photo",
	"prod-session-token",
	"203.0.113.7",
	"scrypt-password-hash",
	"google-access-token",
	"google-refresh-token",
	"google-id-token",
	"email-verification-value",
	"passkey-public-key",
	"mcp-client-secret",
	"mcp-access-token",
	"mcp-refresh-token",
];

const ROOM_NAME = `O'Brien's "Card" Room\nFloor 2 🂡`;
const BEYOND_DOUBLE = 9_007_199_254_740_993n;

const PRODUCTION_EXPORT = `PRAGMA defer_foreign_keys=TRUE;
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0000_cultured_cargill.sql','2026-01-01 00:00:00');
INSERT INTO "user" ("id","name","email","email_verified","image","created_at","updated_at") VALUES('u1','Owner','owner@example.com',1,'https://lh3.googleusercontent.com/a/owner-photo',1700000000,1700000000);
INSERT INTO "user" ("id","name","email","email_verified","image","created_at","updated_at") VALUES('u2','Friend','friend@example.com',0,NULL,1700000000,1700000000);
INSERT INTO "session" ("id","expires_at","token","created_at","updated_at","ip_address","user_agent","user_id") VALUES('s1',1900000000,'prod-session-token',1700000000,1700000000,'203.0.113.7','Mozilla/5.0','u1');
INSERT INTO "account" ("id","account_id","provider_id","user_id","access_token","refresh_token","id_token","access_token_expires_at","refresh_token_expires_at","scope","password","created_at","updated_at") VALUES('a1','u1','credential','u1',NULL,NULL,NULL,NULL,NULL,NULL,'scrypt-password-hash',1700000000,1700000000);
INSERT INTO "account" ("id","account_id","provider_id","user_id","access_token","refresh_token","id_token","access_token_expires_at","refresh_token_expires_at","scope","password","created_at","updated_at") VALUES('a2','google-sub-1','google','u1','google-access-token','google-refresh-token','google-id-token',1900000000,1900000000,'openid email profile',NULL,1700000000,1700000000);
INSERT INTO "verification" ("id","identifier","value","expires_at","created_at","updated_at") VALUES('v1','owner@example.com','email-verification-value',1900000000,1700000000,1700000000);
INSERT INTO "passkey" ("id","name","public_key","user_id","credential_id","counter","device_type","backed_up","transports","aaguid","created_at") VALUES('pk1','Laptop','passkey-public-key','u1','credential-1',0,'singleDevice',0,'internal',NULL,1700000000);
INSERT INTO "oauth_client" ("id","client_id","client_secret","redirect_uris","user_id","created_at","updated_at") VALUES('oc1','client-1','mcp-client-secret','["https://claude.ai/api/mcp/auth_callback"]','u1',1700000000000,1700000000000);
INSERT INTO "oauth_refresh_token" ("id","token","client_id","session_id","user_id","scopes") VALUES('ort1','mcp-refresh-token','client-1','s1','u1','["mcp"]');
INSERT INTO "oauth_access_token" ("id","token","client_id","session_id","user_id","refresh_id","scopes") VALUES('oat1','mcp-access-token','client-1','s1','u1','ort1','["mcp"]');
INSERT INTO "oauth_consent" ("id","client_id","user_id","scopes") VALUES('ocs1','client-1','u1','["mcp"]');
INSERT INTO "room" ("id","user_id","name","memo","is_favorite","latitude","longitude","archived_at","created_at","updated_at") VALUES('r1','u1',replace('O''Brien''s "Card" Room\\nFloor 2 🂡','\\n',char(10)),NULL,1,35.6812,139.7671,NULL,${BEYOND_DOUBLE},1700000000);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',1);
`;

function rowValues(db: DatabaseSync, sql: string): SQLOutputValue[][] {
	const statement = db.prepare(sql);
	statement.setReadBigInts(true);
	statement.setReturnArrays(true);
	return statement.all() as unknown as SQLOutputValue[][];
}

function restore(seedSql: string): DatabaseSync {
	const db = openMigratedDatabase();
	db.exec("PRAGMA foreign_keys = ON");
	db.exec(`BEGIN;\n${seedSql}COMMIT;`);
	return db;
}

describe("scrub-seed", () => {
	it("leaves no production credential, session or email address in the seed", () => {
		const { sql } = scrubSeed(PRODUCTION_EXPORT);

		expect(SECRETS.filter((secret) => sql.includes(secret))).toEqual([]);
	});

	it("restores the scrubbed seed with domain rows intact and every user still linked to their sign-in accounts", () => {
		const db = restore(scrubSeed(PRODUCTION_EXPORT).sql);
		try {
			expect(rowValues(db, "PRAGMA foreign_key_check")).toEqual([]);
			expect(
				rowValues(
					db,
					"SELECT name, memo, latitude, longitude, created_at FROM room WHERE id = 'r1'"
				)
			).toEqual([[ROOM_NAME, null, 35.6812, 139.7671, BEYOND_DOUBLE]]);
			expect(
				rowValues(
					db,
					"SELECT a.provider_id, a.account_id, a.password, a.access_token, a.refresh_token, a.id_token, u.id FROM account a JOIN user u ON u.id = a.user_id ORDER BY a.id"
				)
			).toEqual([
				["credential", "u1", null, null, null, null, "u1"],
				["google", "google-sub-1", null, null, null, null, "u1"],
			]);
			expect(
				rowValues(
					db,
					"SELECT (SELECT count(*) FROM user), (SELECT count(DISTINCT email) FROM user), (SELECT count(*) FROM session) + (SELECT count(*) FROM passkey) + (SELECT count(*) FROM verification) + (SELECT count(*) FROM oauth_client)"
				)
			).toEqual([[2n, 2n, 0n]]);
		} finally {
			db.close();
		}
	});

	it("keeps only the preview login account's email and password, and no one else's credential", () => {
		const seed = scrubSeed(PRODUCTION_EXPORT, {
			keepLoginEmail: "Owner@Example.com",
		});
		const db = restore(seed.sql);
		try {
			expect(seed.keptLogin).toBe(true);
			expect(
				rowValues(
					db,
					"SELECT u.id, u.email, a.provider_id, a.password, a.access_token FROM user u LEFT JOIN account a ON a.user_id = u.id ORDER BY u.id, a.id"
				)
			).toEqual([
				["u1", "owner@example.com", "credential", "scrypt-password-hash", null],
				["u1", "owner@example.com", "google", null, null],
				["u2", "user-u2@scrubbed.invalid", null, null, null],
			]);
			const kept = new Set(["owner@example.com", "scrypt-password-hash"]);
			expect(
				SECRETS.filter(
					(secret) => !kept.has(secret) && seed.sql.includes(secret)
				)
			).toEqual([]);
		} finally {
			db.close();
		}
	});

	it("has a scrub decision for every table and column any migration prefix creates, since production may lag behind, and none for anything none of them do", () => {
		const gaps = new Set<string>();
		const columns = new Map<string, Set<string>>();
		openMigratedDatabase(undefined, (db) => {
			for (const gap of unclassified(db)) {
				gaps.add(gap);
			}
			for (const [table] of rowValues(
				db,
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
			)) {
				const seen = columns.get(String(table)) ?? new Set();
				for (const [column] of rowValues(
					db,
					`SELECT name FROM pragma_table_info('${String(table)}')`
				)) {
					seen.add(String(column));
				}
				columns.set(String(table), seen);
			}
		}).close();

		expect([...gaps]).toEqual([]);
		expect(
			Object.keys(SCRUB_POLICY).filter((table) => !columns.has(table))
		).toEqual([]);
		for (const [table, rule] of Object.entries(SCRUB_POLICY)) {
			if (typeof rule === "object") {
				expect([...(columns.get(table) ?? [])].toSorted()).toEqual(
					Object.keys(rule.columns).toSorted()
				);
			}
		}
	});
});
