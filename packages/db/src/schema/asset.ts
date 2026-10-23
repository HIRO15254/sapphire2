import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { ASSET_KINDS, ASSET_MAX_DECIMALS } from "../constants/asset";
import { user } from "./auth";
import { currencyTransaction } from "./currency";
import { oneOf } from "./sql-checks";

export const asset = sqliteTable(
	"asset",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		unit: text("unit"),
		description: text("description"),
		isFavorite: integer("is_favorite", { mode: "boolean" })
			.notNull()
			.default(false),
		kind: text("kind", { enum: ASSET_KINDS }).notNull().default("currency"),
		decimals: integer("decimals").notNull().default(0),
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("asset_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("asset_name_uq").on(t.userId, sql`lower(trim(${t.name}))`),
		index("asset_user_kind_idx").on(t.userId, t.kind),
		check("asset_is_favorite_check", sql`${t.isFavorite} IN (0, 1)`),
		check("asset_kind_check", oneOf(t.kind, ASSET_KINDS)),
		check(
			"asset_decimals_check",
			sql`${t.decimals} BETWEEN 0 AND ${sql.raw(String(ASSET_MAX_DECIMALS))}`
		),
	]
);

export const assetRelations = relations(asset, ({ one, many }) => ({
	user: one(user, {
		fields: [asset.userId],
		references: [user.id],
	}),
	transactions: many(currencyTransaction),
}));
