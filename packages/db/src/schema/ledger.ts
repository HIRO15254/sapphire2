import { relations, sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { ASSET_RATE_MAX_TERM } from "../constants/asset";
import {
	LEDGER_EFFECTS,
	LEDGER_MAX_QUANTITY,
	LEDGER_PAYMENT_ROLES,
	LEDGER_RECEIPT_ROLES,
	LEDGER_ROLES,
	LEDGER_WALLET_ROLES,
} from "../constants/ledger";
import { user } from "./auth";
import { currency } from "./currency";
import { entry, playEvent, playSession } from "./entry";
import { oneOf } from "./sql-checks";

export const assetRate = sqliteTable(
	"asset_rate",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		baseAssetId: text("base_asset_id").notNull(),
		quoteAssetId: text("quote_asset_id").notNull(),
		rateNum: integer("rate_num").notNull(),
		rateDen: integer("rate_den").notNull(),
		effectiveFrom: integer("effective_from", { mode: "timestamp" }).notNull(),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [
		uniqueIndex("asset_rate_pair_effective_from_unique").on(
			t.userId,
			t.baseAssetId,
			t.quoteAssetId,
			t.effectiveFrom
		),
		foreignKey({
			columns: [t.baseAssetId, t.userId],
			foreignColumns: [currency.id, currency.userId],
			name: "asset_rate_base_asset_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.quoteAssetId, t.userId],
			foreignColumns: [currency.id, currency.userId],
			name: "asset_rate_quote_asset_owner_fk",
		}).onDelete("cascade"),
		check(
			"asset_rate_distinct_assets_check",
			sql`${t.baseAssetId} <> ${t.quoteAssetId}`
		),
		check(
			"asset_rate_rate_num_check",
			sql`${t.rateNum} BETWEEN 1 AND ${sql.raw(String(ASSET_RATE_MAX_TERM))}`
		),
		check(
			"asset_rate_rate_den_check",
			sql`${t.rateDen} BETWEEN 1 AND ${sql.raw(String(ASSET_RATE_MAX_TERM))}`
		),
	]
);

export const ledgerCategory = sqliteTable(
	"ledger_category",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("ledger_category_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("ledger_category_user_name_unique").on(
			t.userId,
			sql`lower(${t.name})`
		),
	]
);

export const ledgerLine = sqliteTable(
	"ledger_line",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		assetId: text("asset_id").notNull(),
		quantity: integer("quantity").notNull(),
		role: text("role", { enum: LEDGER_ROLES }).notNull(),
		effect: text("effect", { enum: LEDGER_EFFECTS }).notNull(),
		entryId: text("entry_id"),
		playSessionId: text("play_session_id"),
		sourceEventId: text("source_event_id"),
		categoryId: text("category_id"),
		transferId: text("transfer_id"),
		occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		index("ledger_line_user_entry_idx").on(t.userId, t.entryId),
		index("ledger_line_user_asset_occurred_at_idx").on(
			t.userId,
			t.assetId,
			t.occurredAt
		),
		index("ledger_line_source_event_idx").on(t.sourceEventId),
		index("ledger_line_play_session_idx").on(t.playSessionId),
		index("ledger_line_transfer_idx").on(t.transferId),
		foreignKey({
			columns: [t.assetId, t.userId],
			foreignColumns: [currency.id, currency.userId],
			name: "ledger_line_asset_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.entryId, t.userId],
			foreignColumns: [entry.id, entry.userId],
			name: "ledger_line_entry_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.playSessionId, t.entryId, t.userId],
			foreignColumns: [playSession.id, playSession.entryId, playSession.userId],
			name: "ledger_line_play_session_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.sourceEventId, t.userId],
			foreignColumns: [playEvent.id, playEvent.userId],
			name: "ledger_line_source_event_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.categoryId, t.userId],
			foreignColumns: [ledgerCategory.id, ledgerCategory.userId],
			name: "ledger_line_category_owner_fk",
		}).onDelete("no action"),
		check("ledger_line_role_check", oneOf(t.role, LEDGER_ROLES)),
		check("ledger_line_effect_check", oneOf(t.effect, LEDGER_EFFECTS)),
		check(
			"ledger_line_quantity_check",
			sql`${t.quantity} <> 0 AND abs(${t.quantity}) <= ${sql.raw(String(LEDGER_MAX_QUANTITY))}`
		),
		check(
			"ledger_line_role_sign_check",
			sql`(${oneOf(t.role, LEDGER_PAYMENT_ROLES)} AND ${t.quantity} < 0) OR (${oneOf(t.role, LEDGER_RECEIPT_ROLES)} AND ${t.quantity} > 0) OR ${oneOf(t.role, LEDGER_WALLET_ROLES)}`
		),
		check(
			"ledger_line_role_entry_check",
			sql`(${oneOf(t.role, LEDGER_WALLET_ROLES)} AND ${t.entryId} IS NULL AND ${t.effect} = 'real') OR (NOT (${oneOf(t.role, LEDGER_WALLET_ROLES)}) AND ${t.entryId} IS NOT NULL)`
		),
		check(
			"ledger_line_exchange_transfer_check",
			sql`${t.role} <> 'exchange' OR ${t.transferId} IS NOT NULL`
		),
		check(
			"ledger_line_play_session_entry_check",
			sql`${t.playSessionId} IS NULL OR ${t.entryId} IS NOT NULL`
		),
	]
);

export const userSetting = sqliteTable(
	"user_setting",
	{
		userId: text("user_id")
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
		baseAssetId: text("base_asset_id"),
		timeZone: text("time_zone"),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		foreignKey({
			columns: [t.baseAssetId, t.userId],
			foreignColumns: [currency.id, currency.userId],
			name: "user_setting_base_asset_owner_fk",
		}).onDelete("no action"),
	]
);

export const assetRateRelations = relations(assetRate, ({ one }) => ({
	user: one(user, {
		fields: [assetRate.userId],
		references: [user.id],
	}),
	baseAsset: one(currency, {
		fields: [assetRate.baseAssetId, assetRate.userId],
		references: [currency.id, currency.userId],
	}),
	quoteAsset: one(currency, {
		fields: [assetRate.quoteAssetId, assetRate.userId],
		references: [currency.id, currency.userId],
	}),
}));

export const ledgerCategoryRelations = relations(
	ledgerCategory,
	({ one, many }) => ({
		user: one(user, {
			fields: [ledgerCategory.userId],
			references: [user.id],
		}),
		lines: many(ledgerLine),
	})
);

export const ledgerLineRelations = relations(ledgerLine, ({ one }) => ({
	user: one(user, {
		fields: [ledgerLine.userId],
		references: [user.id],
	}),
	asset: one(currency, {
		fields: [ledgerLine.assetId, ledgerLine.userId],
		references: [currency.id, currency.userId],
	}),
	entry: one(entry, {
		fields: [ledgerLine.entryId, ledgerLine.userId],
		references: [entry.id, entry.userId],
	}),
	playSession: one(playSession, {
		fields: [ledgerLine.playSessionId, ledgerLine.userId],
		references: [playSession.id, playSession.userId],
	}),
	sourceEvent: one(playEvent, {
		fields: [ledgerLine.sourceEventId, ledgerLine.userId],
		references: [playEvent.id, playEvent.userId],
	}),
	category: one(ledgerCategory, {
		fields: [ledgerLine.categoryId, ledgerLine.userId],
		references: [ledgerCategory.id, ledgerCategory.userId],
	}),
}));

export const userSettingRelations = relations(userSetting, ({ one }) => ({
	user: one(user, {
		fields: [userSetting.userId],
		references: [user.id],
	}),
	baseAsset: one(currency, {
		fields: [userSetting.baseAssetId, userSetting.userId],
		references: [currency.id, currency.userId],
	}),
}));
