import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const dashboardWidget = sqliteTable(
	"dashboard_widget",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		device: text("device").notNull(),
		type: text("type").notNull(),
		config: text("config").notNull().default("{}"),
		x: integer("x").notNull().default(0),
		y: integer("y").notNull().default(0),
		w: integer("w").notNull().default(2),
		h: integer("h").notNull().default(1),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(table) => [
		index("dashboard_widget_user_device_idx").on(table.userId, table.device),
	]
);

export const dashboardWidgetRelations = relations(
	dashboardWidget,
	({ one }) => ({
		user: one(user, {
			fields: [dashboardWidget.userId],
			references: [user.id],
		}),
	})
);
