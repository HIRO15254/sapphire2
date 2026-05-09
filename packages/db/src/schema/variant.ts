import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const variant = sqliteTable("variant", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	sortOrder: integer("sort_order").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.$onUpdate(() => new Date())
		.notNull(),
});

export const variantRelations = relations(variant, ({ one }) => ({
	user: one(user, {
		fields: [variant.userId],
		references: [user.id],
	}),
}));
