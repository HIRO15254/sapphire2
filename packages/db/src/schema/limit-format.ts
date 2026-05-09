import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const limitFormat = sqliteTable("limit_format", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	blind1Label: text("blind1_label").notNull(),
	blind2Label: text("blind2_label").notNull(),
	blind3Label: text("blind3_label"),
	blind4Label: text("blind4_label"),
	sortOrder: integer("sort_order").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.$onUpdate(() => new Date())
		.notNull(),
});

export const limitFormatRelations = relations(limitFormat, ({ one }) => ({
	user: one(user, {
		fields: [limitFormat.userId],
		references: [user.id],
	}),
}));
