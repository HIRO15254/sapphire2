import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

// User-defined poker variants. Stored purely as a definition row so the user
// can pick from a personal list when creating rooms/sessions; the `variant`
// column elsewhere in the schema always stores the display label verbatim
// (self-freezing), so deleting a row here never touches past data.
export const customGameVariant = sqliteTable(
	"custom_game_variant",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		label: text("label").notNull(),
		blind1Label: text("blind1_label"),
		blind2Label: text("blind2_label"),
		blind3Label: text("blind3_label"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("customGameVariant_userId_idx").on(table.userId)]
);

export const customGameVariantRelations = relations(
	customGameVariant,
	({ one }) => ({
		user: one(user, {
			fields: [customGameVariant.userId],
			references: [user.id],
		}),
	})
);
