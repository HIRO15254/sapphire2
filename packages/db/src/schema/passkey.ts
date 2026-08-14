import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

// WebAuthn credentials consumed by better-auth's passkey() plugin. Field set
// mirrors the plugin's schema definition exactly — better-auth reads/writes
// these through its drizzle adapter, so the JS property names (not the column
// names) are the contract.
//
// `credentialID` is unique on top of the plugin's plain index: authentication
// resolves a credential with a single `findOne({ credentialID })`, so a
// duplicate would make which account you land in non-deterministic. Two
// accounts can never legitimately share one credential — an authenticator
// mints a new credential per (relying party, user handle) pair.
export const passkey = sqliteTable(
	"passkey",
	{
		id: text("id").primaryKey(),
		name: text("name"),
		publicKey: text("public_key").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		credentialID: text("credential_id").notNull(),
		counter: integer("counter").notNull(),
		deviceType: text("device_type").notNull(),
		backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
		transports: text("transports"),
		aaguid: text("aaguid"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(table) => [
		index("passkey_userId_idx").on(table.userId),
		unique("passkey_credentialId_unique").on(table.credentialID),
	]
);

export const passkeyRelations = relations(passkey, ({ one }) => ({
	user: one(user, {
		fields: [passkey.userId],
		references: [user.id],
	}),
}));
