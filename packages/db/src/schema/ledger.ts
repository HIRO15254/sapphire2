import { sql } from "drizzle-orm";
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
	LEDGER_PRICE_ROLES,
	LEDGER_RECEIPT_ROLES,
	LEDGER_ROLES,
	LEDGER_WALLET_ROLES,
} from "../constants/ledger";
import { asset } from "./asset";
import { user } from "./auth";
import { entry, playEvent, playSession } from "./entry";
import { tournamentRulePrice } from "./rule";
import { oneOf } from "./sql-checks";

export const assetRate = sqliteTable(
	"asset_rate",
	{
		baseAssetId: text("base_asset_id").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		effectiveFrom: integer("effective_from", { mode: "timestamp" }).notNull(),
		id: text("id").primaryKey(),
		memo: text("memo"),
		quoteAssetId: text("quote_asset_id").notNull(),
		rateDen: integer("rate_den").notNull(),
		rateNum: integer("rate_num").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(t) => [
		uniqueIndex("asset_rate_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("asset_rate_pair_effective_from_unique").on(
			t.userId,
			t.baseAssetId,
			t.quoteAssetId,
			t.effectiveFrom
		),
		index("asset_rate_quote_asset_idx").on(t.quoteAssetId),
		foreignKey({
			columns: [t.baseAssetId, t.userId],
			foreignColumns: [asset.id, asset.userId],
			name: "asset_rate_base_asset_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.quoteAssetId, t.userId],
			foreignColumns: [asset.id, asset.userId],
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
		check("asset_rate_effective_from_check", sql`${t.effectiveFrom} >= 0`),
	]
);

export const ledgerCategory = sqliteTable(
	"ledger_category",
	{
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		icon: text("icon"),
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(t) => [
		uniqueIndex("ledger_category_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("ledger_category_user_name_unique").on(
			t.userId,
			sql`lower(trim(${t.name}))`
		),
	]
);

export const ledgerLine = sqliteTable(
	"ledger_line",
	{
		assetId: text("asset_id").notNull(),
		categoryId: text("category_id"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		effect: text("effect", { enum: LEDGER_EFFECTS }).notNull(),
		entryId: text("entry_id"),
		id: text("id").primaryKey(),
		memo: text("memo"),
		occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
		playSessionId: text("play_session_id"),
		priceId: text("price_id"),
		quantity: integer("quantity").notNull(),
		role: text("role", { enum: LEDGER_ROLES }).notNull(),
		sourceEventId: text("source_event_id"),
		transferId: text("transfer_id"),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(t) => [
		uniqueIndex("ledger_line_id_user_id_unique").on(t.id, t.userId),
		index("ledger_line_user_entry_idx").on(t.userId, t.entryId),
		index("ledger_line_user_asset_occurred_at_idx").on(
			t.userId,
			t.assetId,
			t.occurredAt,
			t.id
		),
		index("ledger_line_source_event_idx").on(t.sourceEventId),
		index("ledger_line_play_session_idx").on(t.playSessionId),
		index("ledger_line_transfer_idx").on(t.transferId),
		index("ledger_line_price_idx").on(t.priceId),
		index("ledger_line_category_idx").on(t.categoryId),
		foreignKey({
			columns: [t.assetId, t.userId],
			foreignColumns: [asset.id, asset.userId],
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
			columns: [t.sourceEventId, t.entryId, t.playSessionId, t.userId],
			foreignColumns: [
				playEvent.id,
				playEvent.entryId,
				playEvent.playSessionId,
				playEvent.userId,
			],
			name: "ledger_line_source_event_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.priceId, t.userId],
			foreignColumns: [tournamentRulePrice.id, tournamentRulePrice.userId],
			name: "ledger_line_price_owner_fk",
		}).onDelete("no action"),
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
			sql`(${t.role} = 'exchange') = (${t.transferId} IS NOT NULL)`
		),
		check(
			"ledger_line_play_session_entry_check",
			sql`${t.playSessionId} IS NULL OR ${t.entryId} IS NOT NULL`
		),
		check(
			"ledger_line_source_event_scope_check",
			sql`${t.sourceEventId} IS NULL OR (${t.entryId} IS NOT NULL AND ${t.playSessionId} IS NOT NULL)`
		),
		check(
			"ledger_line_category_role_check",
			sql`${t.categoryId} IS NULL OR ${oneOf(t.role, LEDGER_WALLET_ROLES)}`
		),
		check(
			"ledger_line_price_role_check",
			sql`${t.priceId} IS NULL OR ${oneOf(t.role, LEDGER_PRICE_ROLES)}`
		),
		check(
			"ledger_line_wallet_links_check",
			sql`NOT (${oneOf(t.role, LEDGER_WALLET_ROLES)}) OR (${t.playSessionId} IS NULL AND ${t.sourceEventId} IS NULL AND ${t.priceId} IS NULL)`
		),
	]
);

export const userSetting = sqliteTable(
	"user_setting",
	{
		baseAssetId: text("base_asset_id"),
		timeZone: text("time_zone"),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		userId: text("user_id")
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(t) => [
		foreignKey({
			columns: [t.baseAssetId, t.userId],
			foreignColumns: [asset.id, asset.userId],
			name: "user_setting_base_asset_owner_fk",
		}).onDelete("no action"),
	]
);
