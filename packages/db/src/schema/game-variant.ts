import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const gameVariant = sqliteTable(
	"game_variant",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		blindLabel1: text("blind_label_1"),
		blindLabel2: text("blind_label_2"),
		blindLabel3: text("blind_label_3"),
		sortOrder: integer("sort_order").notNull().default(0),
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("gameVariant_userId_idx").on(table.userId),
		uniqueIndex("gameVariant_userId_name_unique").on(table.userId, table.name),
	]
);

export const gameVariantRelations = relations(gameVariant, ({ one }) => ({
	user: one(user, {
		fields: [gameVariant.userId],
		references: [user.id],
	}),
}));
