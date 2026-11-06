import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const passkey = sqliteTable(
	"passkey",
	{
		aaguid: text("aaguid"),
		backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
		counter: integer("counter").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		credentialID: text("credential_id").notNull(),
		deviceType: text("device_type").notNull(),
		id: text("id").primaryKey(),
		name: text("name"),
		publicKey: text("public_key").notNull(),
		transports: text("transports"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
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
