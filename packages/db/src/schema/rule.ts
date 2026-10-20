import { relations, type SQL, sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	type SQLiteColumn,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
	ANTE_TYPES,
	MAX_RULE_TABLE_SIZE,
	MIN_RULE_TABLE_SIZE,
	RULE_PRICE_KINDS,
} from "../constants/rule";
import { user } from "./auth";
import { currency } from "./currency";
import { gameLineup, gameLineupGroup } from "./game-lineup";
import { ringGame } from "./ring-game";
import { oneOf } from "./sql-checks";
import { tournament } from "./tournament";

function tableSizeCheck(column: SQLiteColumn): SQL {
	return sql`${column} BETWEEN ${sql.raw(`${MIN_RULE_TABLE_SIZE}`)} AND ${sql.raw(`${MAX_RULE_TABLE_SIZE}`)}`;
}

const stakeColumns = {
	blind1: integer("blind1"),
	blind2: integer("blind2"),
	blind3: integer("blind3"),
	ante: integer("ante"),
	anteType: text("ante_type", { enum: ANTE_TYPES }),
};

function stakeChecks(
	table: string,
	t: {
		ante: SQLiteColumn;
		anteType: SQLiteColumn;
		blind1: SQLiteColumn;
		blind2: SQLiteColumn;
		blind3: SQLiteColumn;
	}
) {
	return [
		check(`${table}_blind1_check`, sql`${t.blind1} >= 0`),
		check(`${table}_blind2_check`, sql`${t.blind2} >= 0`),
		check(`${table}_blind3_check`, sql`${t.blind3} >= 0`),
		check(`${table}_ante_check`, sql`${t.ante} >= 0`),
		check(`${table}_ante_type_check`, oneOf(t.anteType, ANTE_TYPES)),
	];
}

export const cashRule = sqliteTable(
	"cash_rule",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		ringGameId: text("ring_game_id"),
		parentRuleId: text("parent_rule_id"),
		lineupId: text("lineup_id").notNull(),
		minBuyIn: integer("min_buy_in"),
		maxBuyIn: integer("max_buy_in"),
		tableSize: integer("table_size"),
		houseRules: text("house_rules"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [
		uniqueIndex("cash_rule_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("cash_rule_id_ring_game_id_unique").on(t.id, t.ringGameId),
		uniqueIndex("cash_rule_id_lineup_id_unique").on(t.id, t.lineupId),
		index("cash_rule_ring_game_idx").on(t.ringGameId),
		index("cash_rule_parent_idx").on(t.parentRuleId),
		index("cash_rule_lineup_idx").on(t.lineupId),
		foreignKey({
			columns: [t.ringGameId, t.userId],
			foreignColumns: [ringGame.id, ringGame.userId],
			name: "cash_rule_ring_game_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.parentRuleId, t.userId],
			foreignColumns: [t.id, t.userId],
			name: "cash_rule_parent_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.parentRuleId, t.ringGameId],
			foreignColumns: [t.id, t.ringGameId],
			name: "cash_rule_parent_master_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.lineupId, t.userId],
			foreignColumns: [gameLineup.id, gameLineup.userId],
			name: "cash_rule_lineup_owner_fk",
		}).onDelete("no action"),
		check("cash_rule_min_buy_in_check", sql`${t.minBuyIn} >= 0`),
		check("cash_rule_max_buy_in_check", sql`${t.maxBuyIn} >= 0`),
		check("cash_rule_buy_in_range_check", sql`${t.minBuyIn} <= ${t.maxBuyIn}`),
		check("cash_rule_table_size_check", tableSizeCheck(t.tableSize)),
	]
);

export const cashRuleStake = sqliteTable(
	"cash_rule_stake",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		ruleId: text("rule_id").notNull(),
		lineupGroupId: text("lineup_group_id").notNull(),
		lineupId: text("lineup_id").notNull(),
		...stakeColumns,
	},
	(t) => [
		primaryKey({ columns: [t.ruleId, t.lineupGroupId] }),
		index("cash_rule_stake_lineup_group_idx").on(t.lineupGroupId),
		foreignKey({
			columns: [t.ruleId, t.userId],
			foreignColumns: [cashRule.id, cashRule.userId],
			name: "cash_rule_stake_rule_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.ruleId, t.lineupId],
			foreignColumns: [cashRule.id, cashRule.lineupId],
			name: "cash_rule_stake_rule_lineup_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.lineupGroupId, t.userId],
			foreignColumns: [gameLineupGroup.id, gameLineupGroup.userId],
			name: "cash_rule_stake_group_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.lineupId, t.lineupGroupId],
			foreignColumns: [gameLineupGroup.lineupId, gameLineupGroup.id],
			name: "cash_rule_stake_group_lineup_fk",
		}).onDelete("no action"),
		...stakeChecks("cash_rule_stake", t),
	]
);

export const tournamentRule = sqliteTable(
	"tournament_rule",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tournamentId: text("tournament_id"),
		parentRuleId: text("parent_rule_id"),
		lineupId: text("lineup_id").notNull(),
		startingStack: integer("starting_stack"),
		tableSize: integer("table_size"),
		bountyAmount: integer("bounty_amount"),
		houseRules: text("house_rules"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [
		uniqueIndex("tournament_rule_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("tournament_rule_id_tournament_id_unique").on(
			t.id,
			t.tournamentId
		),
		uniqueIndex("tournament_rule_id_lineup_id_unique").on(t.id, t.lineupId),
		index("tournament_rule_tournament_idx").on(t.tournamentId),
		index("tournament_rule_parent_idx").on(t.parentRuleId),
		index("tournament_rule_lineup_idx").on(t.lineupId),
		foreignKey({
			columns: [t.tournamentId, t.userId],
			foreignColumns: [tournament.id, tournament.userId],
			name: "tournament_rule_tournament_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.parentRuleId, t.userId],
			foreignColumns: [t.id, t.userId],
			name: "tournament_rule_parent_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.parentRuleId, t.tournamentId],
			foreignColumns: [t.id, t.tournamentId],
			name: "tournament_rule_parent_master_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.lineupId, t.userId],
			foreignColumns: [gameLineup.id, gameLineup.userId],
			name: "tournament_rule_lineup_owner_fk",
		}).onDelete("no action"),
		check("tournament_rule_starting_stack_check", sql`${t.startingStack} >= 0`),
		check("tournament_rule_bounty_amount_check", sql`${t.bountyAmount} >= 0`),
		check("tournament_rule_table_size_check", tableSizeCheck(t.tableSize)),
	]
);

export const tournamentRuleLevel = sqliteTable(
	"tournament_rule_level",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		ruleId: text("rule_id").notNull(),
		ordinal: integer("ordinal").notNull(),
		level: integer("level"),
		isBreak: integer("is_break", { mode: "boolean" }).notNull().default(false),
		minutes: integer("minutes"),
		lineupId: text("lineup_id").notNull(),
		inheritsLineup: integer("inherits_lineup", { mode: "boolean" }).notNull(),
		inheritedLineupId: text("inherited_lineup_id"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [
		uniqueIndex("tournament_rule_level_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("tournament_rule_level_id_lineup_id_unique").on(
			t.id,
			t.lineupId
		),
		uniqueIndex("tournament_rule_level_rule_ordinal_unique").on(
			t.ruleId,
			t.ordinal
		),
		index("tournament_rule_level_lineup_idx").on(t.lineupId),
		foreignKey({
			columns: [t.ruleId, t.userId],
			foreignColumns: [tournamentRule.id, tournamentRule.userId],
			name: "tournament_rule_level_rule_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.ruleId, t.inheritedLineupId],
			foreignColumns: [tournamentRule.id, tournamentRule.lineupId],
			name: "tournament_rule_level_inherited_lineup_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.lineupId, t.userId],
			foreignColumns: [gameLineup.id, gameLineup.userId],
			name: "tournament_rule_level_lineup_owner_fk",
		}).onDelete("no action"),
		check("tournament_rule_level_ordinal_check", sql`${t.ordinal} >= 1`),
		check("tournament_rule_level_is_break_check", sql`${t.isBreak} IN (0, 1)`),
		check("tournament_rule_level_minutes_check", sql`${t.minutes} >= 1`),
		check(
			"tournament_rule_level_inherits_lineup_check",
			sql`${t.inheritsLineup} IN (0, 1)`
		),
		check(
			"tournament_rule_level_inherited_lineup_check",
			sql`(${t.inheritsLineup} = 1 AND ${t.inheritedLineupId} IS NOT NULL AND ${t.inheritedLineupId} = ${t.lineupId}) OR (${t.inheritsLineup} = 0 AND ${t.inheritedLineupId} IS NULL)`
		),
	]
);

export const tournamentRuleLevelStake = sqliteTable(
	"tournament_rule_level_stake",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		levelId: text("level_id").notNull(),
		lineupGroupId: text("lineup_group_id").notNull(),
		lineupId: text("lineup_id").notNull(),
		...stakeColumns,
	},
	(t) => [
		primaryKey({ columns: [t.levelId, t.lineupGroupId] }),
		index("tournament_rule_level_stake_lineup_group_idx").on(t.lineupGroupId),
		foreignKey({
			columns: [t.levelId, t.userId],
			foreignColumns: [tournamentRuleLevel.id, tournamentRuleLevel.userId],
			name: "tournament_rule_level_stake_level_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.levelId, t.lineupId],
			foreignColumns: [tournamentRuleLevel.id, tournamentRuleLevel.lineupId],
			name: "tournament_rule_level_stake_level_lineup_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.lineupGroupId, t.userId],
			foreignColumns: [gameLineupGroup.id, gameLineupGroup.userId],
			name: "tournament_rule_level_stake_group_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.lineupId, t.lineupGroupId],
			foreignColumns: [gameLineupGroup.lineupId, gameLineupGroup.id],
			name: "tournament_rule_level_stake_group_lineup_fk",
		}).onDelete("no action"),
		...stakeChecks("tournament_rule_level_stake", t),
	]
);

export const tournamentRulePrice = sqliteTable(
	"tournament_rule_price",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		ruleId: text("rule_id").notNull(),
		kind: text("kind", { enum: RULE_PRICE_KINDS }).notNull(),
		label: text("label").notNull(),
		assetId: text("asset_id").notNull(),
		amount: integer("amount").notNull(),
		fee: integer("fee").notNull().default(0),
		chips: integer("chips"),
		ordinal: integer("ordinal").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [
		uniqueIndex("tournament_rule_price_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("tournament_rule_price_rule_ordinal_unique").on(
			t.ruleId,
			t.ordinal
		),
		index("tournament_rule_price_asset_idx").on(t.assetId),
		foreignKey({
			columns: [t.ruleId, t.userId],
			foreignColumns: [tournamentRule.id, tournamentRule.userId],
			name: "tournament_rule_price_rule_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.assetId, t.userId],
			foreignColumns: [currency.id, currency.userId],
			name: "tournament_rule_price_asset_owner_fk",
		}).onDelete("no action"),
		check("tournament_rule_price_kind_check", oneOf(t.kind, RULE_PRICE_KINDS)),
		check("tournament_rule_price_amount_check", sql`${t.amount} >= 0`),
		check("tournament_rule_price_fee_check", sql`${t.fee} >= 0`),
		check("tournament_rule_price_chips_check", sql`${t.chips} >= 0`),
	]
);

export const cashRuleRelations = relations(cashRule, ({ one, many }) => ({
	ringGame: one(ringGame, {
		fields: [cashRule.ringGameId, cashRule.userId],
		references: [ringGame.id, ringGame.userId],
	}),
	lineup: one(gameLineup, {
		fields: [cashRule.lineupId, cashRule.userId],
		references: [gameLineup.id, gameLineup.userId],
	}),
	stakes: many(cashRuleStake),
}));

export const cashRuleStakeRelations = relations(cashRuleStake, ({ one }) => ({
	rule: one(cashRule, {
		fields: [cashRuleStake.ruleId, cashRuleStake.userId],
		references: [cashRule.id, cashRule.userId],
	}),
	lineupGroup: one(gameLineupGroup, {
		fields: [cashRuleStake.lineupGroupId, cashRuleStake.userId],
		references: [gameLineupGroup.id, gameLineupGroup.userId],
	}),
}));

export const tournamentRuleRelations = relations(
	tournamentRule,
	({ one, many }) => ({
		tournament: one(tournament, {
			fields: [tournamentRule.tournamentId, tournamentRule.userId],
			references: [tournament.id, tournament.userId],
		}),
		lineup: one(gameLineup, {
			fields: [tournamentRule.lineupId, tournamentRule.userId],
			references: [gameLineup.id, gameLineup.userId],
		}),
		levels: many(tournamentRuleLevel),
		prices: many(tournamentRulePrice),
	})
);

export const tournamentRuleLevelRelations = relations(
	tournamentRuleLevel,
	({ one, many }) => ({
		rule: one(tournamentRule, {
			fields: [tournamentRuleLevel.ruleId, tournamentRuleLevel.userId],
			references: [tournamentRule.id, tournamentRule.userId],
		}),
		lineup: one(gameLineup, {
			fields: [tournamentRuleLevel.lineupId, tournamentRuleLevel.userId],
			references: [gameLineup.id, gameLineup.userId],
		}),
		stakes: many(tournamentRuleLevelStake),
	})
);

export const tournamentRuleLevelStakeRelations = relations(
	tournamentRuleLevelStake,
	({ one }) => ({
		level: one(tournamentRuleLevel, {
			fields: [
				tournamentRuleLevelStake.levelId,
				tournamentRuleLevelStake.userId,
			],
			references: [tournamentRuleLevel.id, tournamentRuleLevel.userId],
		}),
		lineupGroup: one(gameLineupGroup, {
			fields: [
				tournamentRuleLevelStake.lineupGroupId,
				tournamentRuleLevelStake.userId,
			],
			references: [gameLineupGroup.id, gameLineupGroup.userId],
		}),
	})
);

export const tournamentRulePriceRelations = relations(
	tournamentRulePrice,
	({ one }) => ({
		rule: one(tournamentRule, {
			fields: [tournamentRulePrice.ruleId, tournamentRulePrice.userId],
			references: [tournamentRule.id, tournamentRule.userId],
		}),
		asset: one(currency, {
			fields: [tournamentRulePrice.assetId, tournamentRulePrice.userId],
			references: [currency.id, currency.userId],
		}),
	})
);
