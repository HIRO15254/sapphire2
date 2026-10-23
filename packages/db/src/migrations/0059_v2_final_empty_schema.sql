-- Data model v2, B01 (SA2-385): the final empty schema. Creates the lineup and
-- immutable rule-version tables and rebuilds the still-empty v2 tables whose
-- keys change (G1-G7, docs/design/data-model-v2.md §4-§10, game-lineups.md).
--
-- v2 migration exception (.claude/rules/db-migrations.md): no row is copied.
-- 0054-0058 are unreleased and nothing writes these tables before B06, so every
-- replay of a production copy reaches this file with them empty. D1 keeps
-- foreign keys on and DROP TABLE fires inbound CASCADE / SET NULL, so the first
-- gate aborts before any DROP if a target holds a row; a local database with
-- test rows is reset instead. A failed gate is fixed on dev and the whole chain
-- rerun on a fresh copy, not retried from the middle.
--
-- Children are dropped before their parents. Tables whose own DDL is unchanged
-- (entry, play_session, hand, hand_seat, ledger_category) keep their table and
-- only gain the referenced UNIQUE keys their new children need.
CREATE TABLE `_gate_0059_v2_targets_empty` (`v` integer NOT NULL);
--> statement-breakpoint
INSERT INTO `_gate_0059_v2_targets_empty` (`v`) SELECT NULL WHERE EXISTS (SELECT 1 FROM `entry`)
  OR EXISTS (SELECT 1 FROM `entry_cash`)
  OR EXISTS (SELECT 1 FROM `entry_tournament`)
  OR EXISTS (SELECT 1 FROM `play_session`)
  OR EXISTS (SELECT 1 FROM `play_event`)
  OR EXISTS (SELECT 1 FROM `hand`)
  OR EXISTS (SELECT 1 FROM `hand_board`)
  OR EXISTS (SELECT 1 FROM `hand_seat`)
  OR EXISTS (SELECT 1 FROM `hand_action`)
  OR EXISTS (SELECT 1 FROM `asset_rate`)
  OR EXISTS (SELECT 1 FROM `ledger_category`)
  OR EXISTS (SELECT 1 FROM `ledger_line`)
  OR EXISTS (SELECT 1 FROM `user_setting`);
--> statement-breakpoint
DROP TABLE `_gate_0059_v2_targets_empty`;
--> statement-breakpoint
DROP TABLE `ledger_line`;
--> statement-breakpoint
DROP TABLE `play_event`;
--> statement-breakpoint
DROP TABLE `hand_action`;
--> statement-breakpoint
DROP TABLE `entry_cash`;
--> statement-breakpoint
DROP TABLE `entry_tournament`;
--> statement-breakpoint
DROP TABLE `asset_rate`;
--> statement-breakpoint
DROP INDEX `ledger_category_user_name_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_category_user_name_unique` ON `ledger_category` (`user_id`,lower(trim("name")));
--> statement-breakpoint
CREATE UNIQUE INDEX `entry_id_source_user_id_unique` ON `entry` (`id`,`source`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_group_id_user_id_unique` ON `game_group` (`id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `hand_id_play_session_user_unique` ON `hand` (`id`,`play_session_id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `hand_seat_hand_seat_user_unique` ON `hand_seat` (`hand_id`,`seat`,`user_id`);
--> statement-breakpoint
CREATE TABLE `game_lineup` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_mix_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_mix_id`,`user_id`) REFERENCES `game_mix`(`id`,`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_lineup_id_user_id_unique` ON `game_lineup` (`id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `game_lineup_game_mix_idx` ON `game_lineup` (`game_mix_id`);
--> statement-breakpoint
CREATE TABLE `game_lineup_group` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lineup_id` text NOT NULL,
	`position` integer NOT NULL,
	`game_group_id` text NOT NULL,
	`name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lineup_id`,`user_id`) REFERENCES `game_lineup`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_group_id`,`user_id`) REFERENCES `game_group`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "game_lineup_group_position_check" CHECK("game_lineup_group"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_lineup_group_id_user_id_unique` ON `game_lineup_group` (`id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_lineup_group_lineup_id_id_unique` ON `game_lineup_group` (`lineup_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_lineup_group_lineup_position_unique` ON `game_lineup_group` (`lineup_id`,`position`);
--> statement-breakpoint
CREATE INDEX `game_lineup_group_game_group_idx` ON `game_lineup_group` (`game_group_id`);
--> statement-breakpoint
CREATE TABLE `game_lineup_variant` (
	`user_id` text NOT NULL,
	`lineup_id` text NOT NULL,
	`lineup_group_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`lineup_group_id`, `variant_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lineup_group_id`,`user_id`) REFERENCES `game_lineup_group`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lineup_id`,`lineup_group_id`) REFERENCES `game_lineup_group`(`lineup_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`,`user_id`) REFERENCES `game_variant`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "game_lineup_variant_position_check" CHECK("game_lineup_variant"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_lineup_variant_group_position_unique` ON `game_lineup_variant` (`lineup_group_id`,`position`);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_lineup_variant_lineup_variant_unique` ON `game_lineup_variant` (`lineup_id`,`variant_id`);
--> statement-breakpoint
CREATE INDEX `game_lineup_variant_variant_idx` ON `game_lineup_variant` (`variant_id`);
--> statement-breakpoint
CREATE TABLE `cash_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`ring_game_id` text,
	`parent_rule_id` text,
	`lineup_id` text NOT NULL,
	`min_buy_in` integer,
	`max_buy_in` integer,
	`table_size` integer,
	`house_rules` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ring_game_id`,`user_id`) REFERENCES `ring_game`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_rule_id`,`user_id`) REFERENCES `cash_rule`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_rule_id`,`ring_game_id`) REFERENCES `cash_rule`(`id`,`ring_game_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lineup_id`,`user_id`) REFERENCES `game_lineup`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cash_rule_min_buy_in_check" CHECK("cash_rule"."min_buy_in" >= 0),
	CONSTRAINT "cash_rule_max_buy_in_check" CHECK("cash_rule"."max_buy_in" >= 0),
	CONSTRAINT "cash_rule_buy_in_range_check" CHECK("cash_rule"."min_buy_in" <= "cash_rule"."max_buy_in"),
	CONSTRAINT "cash_rule_table_size_check" CHECK("cash_rule"."table_size" BETWEEN 2 AND 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_rule_id_user_id_unique` ON `cash_rule` (`id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_rule_id_ring_game_id_unique` ON `cash_rule` (`id`,`ring_game_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_rule_id_lineup_id_unique` ON `cash_rule` (`id`,`lineup_id`);
--> statement-breakpoint
CREATE INDEX `cash_rule_ring_game_idx` ON `cash_rule` (`ring_game_id`);
--> statement-breakpoint
CREATE INDEX `cash_rule_parent_idx` ON `cash_rule` (`parent_rule_id`);
--> statement-breakpoint
CREATE INDEX `cash_rule_lineup_idx` ON `cash_rule` (`lineup_id`);
--> statement-breakpoint
CREATE TABLE `cash_rule_stake` (
	`user_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`lineup_group_id` text NOT NULL,
	`lineup_id` text NOT NULL,
	`blind1` integer,
	`blind2` integer,
	`blind3` integer,
	`ante` integer,
	`ante_type` text,
	PRIMARY KEY(`rule_id`, `lineup_group_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`,`user_id`) REFERENCES `cash_rule`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`,`lineup_id`) REFERENCES `cash_rule`(`id`,`lineup_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lineup_group_id`,`user_id`) REFERENCES `game_lineup_group`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lineup_id`,`lineup_group_id`) REFERENCES `game_lineup_group`(`lineup_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cash_rule_stake_blind1_check" CHECK("cash_rule_stake"."blind1" >= 0),
	CONSTRAINT "cash_rule_stake_blind2_check" CHECK("cash_rule_stake"."blind2" >= 0),
	CONSTRAINT "cash_rule_stake_blind3_check" CHECK("cash_rule_stake"."blind3" >= 0),
	CONSTRAINT "cash_rule_stake_ante_check" CHECK("cash_rule_stake"."ante" >= 0),
	CONSTRAINT "cash_rule_stake_ante_type_check" CHECK("cash_rule_stake"."ante_type" IN ('none', 'all', 'bb'))
);
--> statement-breakpoint
CREATE INDEX `cash_rule_stake_lineup_group_idx` ON `cash_rule_stake` (`lineup_group_id`);
--> statement-breakpoint
CREATE TABLE `tournament_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tournament_id` text,
	`parent_rule_id` text,
	`lineup_id` text NOT NULL,
	`starting_stack` integer,
	`table_size` integer,
	`bounty_amount` integer,
	`house_rules` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`,`user_id`) REFERENCES `tournament`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_rule_id`,`user_id`) REFERENCES `tournament_rule`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_rule_id`,`tournament_id`) REFERENCES `tournament_rule`(`id`,`tournament_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lineup_id`,`user_id`) REFERENCES `game_lineup`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tournament_rule_starting_stack_check" CHECK("tournament_rule"."starting_stack" >= 0),
	CONSTRAINT "tournament_rule_bounty_amount_check" CHECK("tournament_rule"."bounty_amount" >= 0),
	CONSTRAINT "tournament_rule_table_size_check" CHECK("tournament_rule"."table_size" BETWEEN 2 AND 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_rule_id_user_id_unique` ON `tournament_rule` (`id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_rule_id_tournament_id_unique` ON `tournament_rule` (`id`,`tournament_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_rule_id_lineup_id_unique` ON `tournament_rule` (`id`,`lineup_id`);
--> statement-breakpoint
CREATE INDEX `tournament_rule_tournament_idx` ON `tournament_rule` (`tournament_id`);
--> statement-breakpoint
CREATE INDEX `tournament_rule_parent_idx` ON `tournament_rule` (`parent_rule_id`);
--> statement-breakpoint
CREATE INDEX `tournament_rule_lineup_idx` ON `tournament_rule` (`lineup_id`);
--> statement-breakpoint
CREATE TABLE `tournament_rule_level` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`level` integer,
	`is_break` integer DEFAULT false NOT NULL,
	`minutes` integer,
	`lineup_id` text NOT NULL,
	`inherits_lineup` integer NOT NULL,
	`inherited_lineup_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`,`user_id`) REFERENCES `tournament_rule`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`,`inherited_lineup_id`) REFERENCES `tournament_rule`(`id`,`lineup_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lineup_id`,`user_id`) REFERENCES `game_lineup`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tournament_rule_level_ordinal_check" CHECK("tournament_rule_level"."ordinal" >= 1),
	CONSTRAINT "tournament_rule_level_is_break_check" CHECK("tournament_rule_level"."is_break" IN (0, 1)),
	CONSTRAINT "tournament_rule_level_minutes_check" CHECK("tournament_rule_level"."minutes" >= 1),
	CONSTRAINT "tournament_rule_level_inherits_lineup_check" CHECK("tournament_rule_level"."inherits_lineup" IN (0, 1)),
	CONSTRAINT "tournament_rule_level_inherited_lineup_check" CHECK(("tournament_rule_level"."inherits_lineup" = 1 AND "tournament_rule_level"."inherited_lineup_id" IS NOT NULL AND "tournament_rule_level"."inherited_lineup_id" = "tournament_rule_level"."lineup_id") OR ("tournament_rule_level"."inherits_lineup" = 0 AND "tournament_rule_level"."inherited_lineup_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_rule_level_id_user_id_unique` ON `tournament_rule_level` (`id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_rule_level_id_lineup_id_unique` ON `tournament_rule_level` (`id`,`lineup_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_rule_level_rule_ordinal_unique` ON `tournament_rule_level` (`rule_id`,`ordinal`);
--> statement-breakpoint
CREATE INDEX `tournament_rule_level_lineup_idx` ON `tournament_rule_level` (`lineup_id`);
--> statement-breakpoint
CREATE TABLE `tournament_rule_level_stake` (
	`user_id` text NOT NULL,
	`level_id` text NOT NULL,
	`lineup_group_id` text NOT NULL,
	`lineup_id` text NOT NULL,
	`blind1` integer,
	`blind2` integer,
	`blind3` integer,
	`ante` integer,
	`ante_type` text,
	PRIMARY KEY(`level_id`, `lineup_group_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`,`user_id`) REFERENCES `tournament_rule_level`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`,`lineup_id`) REFERENCES `tournament_rule_level`(`id`,`lineup_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lineup_group_id`,`user_id`) REFERENCES `game_lineup_group`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lineup_id`,`lineup_group_id`) REFERENCES `game_lineup_group`(`lineup_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tournament_rule_level_stake_blind1_check" CHECK("tournament_rule_level_stake"."blind1" >= 0),
	CONSTRAINT "tournament_rule_level_stake_blind2_check" CHECK("tournament_rule_level_stake"."blind2" >= 0),
	CONSTRAINT "tournament_rule_level_stake_blind3_check" CHECK("tournament_rule_level_stake"."blind3" >= 0),
	CONSTRAINT "tournament_rule_level_stake_ante_check" CHECK("tournament_rule_level_stake"."ante" >= 0),
	CONSTRAINT "tournament_rule_level_stake_ante_type_check" CHECK("tournament_rule_level_stake"."ante_type" IN ('none', 'all', 'bb'))
);
--> statement-breakpoint
CREATE INDEX `tournament_rule_level_stake_lineup_group_idx` ON `tournament_rule_level_stake` (`lineup_group_id`);
--> statement-breakpoint
CREATE TABLE `tournament_rule_price` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`asset_id` text NOT NULL,
	`amount` integer NOT NULL,
	`fee` integer DEFAULT 0 NOT NULL,
	`chips` integer,
	`ordinal` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`,`user_id`) REFERENCES `tournament_rule`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`,`user_id`) REFERENCES `currency`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tournament_rule_price_kind_check" CHECK("tournament_rule_price"."kind" IN ('entry', 'reentry', 'addon')),
	CONSTRAINT "tournament_rule_price_amount_check" CHECK("tournament_rule_price"."amount" >= 0),
	CONSTRAINT "tournament_rule_price_fee_check" CHECK("tournament_rule_price"."fee" >= 0),
	CONSTRAINT "tournament_rule_price_chips_check" CHECK("tournament_rule_price"."chips" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_rule_price_id_user_id_unique` ON `tournament_rule_price` (`id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_rule_price_rule_ordinal_unique` ON `tournament_rule_price` (`rule_id`,`ordinal`);
--> statement-breakpoint
CREATE INDEX `tournament_rule_price_asset_idx` ON `tournament_rule_price` (`asset_id`);
--> statement-breakpoint
CREATE TABLE `entry_cash` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`ring_game_id` text,
	`cash_rule_id` text,
	`ev_diff` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`,`kind`,`user_id`) REFERENCES `entry`(`id`,`kind`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ring_game_id`,`user_id`) REFERENCES `ring_game`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cash_rule_id`,`user_id`) REFERENCES `cash_rule`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cash_rule_id`,`ring_game_id`) REFERENCES `cash_rule`(`id`,`ring_game_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entry_cash_kind_check" CHECK("entry_cash"."kind" = 'cash')
);
--> statement-breakpoint
CREATE INDEX `entry_cash_ring_game_idx` ON `entry_cash` (`ring_game_id`);
--> statement-breakpoint
CREATE INDEX `entry_cash_cash_rule_idx` ON `entry_cash` (`cash_rule_id`);
--> statement-breakpoint
CREATE TABLE `entry_tournament` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`tournament_id` text,
	`tournament_rule_id` text,
	`placement` integer,
	`total_entries` integer,
	`before_deadline` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`,`kind`,`user_id`) REFERENCES `entry`(`id`,`kind`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`,`user_id`) REFERENCES `tournament`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tournament_rule_id`,`user_id`) REFERENCES `tournament_rule`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tournament_rule_id`,`tournament_id`) REFERENCES `tournament_rule`(`id`,`tournament_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entry_tournament_kind_check" CHECK("entry_tournament"."kind" = 'tournament'),
	CONSTRAINT "entry_tournament_placement_check" CHECK("entry_tournament"."placement" >= 1),
	CONSTRAINT "entry_tournament_total_entries_check" CHECK("entry_tournament"."total_entries" >= 1),
	CONSTRAINT "entry_tournament_placement_within_total_check" CHECK("entry_tournament"."placement" <= "entry_tournament"."total_entries"),
	CONSTRAINT "entry_tournament_before_deadline_check" CHECK("entry_tournament"."before_deadline" IN (0, 1)),
	CONSTRAINT "entry_tournament_before_deadline_placement_check" CHECK("entry_tournament"."before_deadline" = 0 OR "entry_tournament"."placement" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `entry_tournament_tournament_idx` ON `entry_tournament` (`tournament_id`);
--> statement-breakpoint
CREATE INDEX `entry_tournament_tournament_rule_idx` ON `entry_tournament` (`tournament_rule_id`);
--> statement-breakpoint
CREATE TABLE `play_event` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`entry_source` text NOT NULL,
	`play_session_id` text NOT NULL,
	`type` text NOT NULL,
	`schema_version` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	`hand_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`,`entry_source`,`user_id`) REFERENCES `entry`(`id`,`source`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`play_session_id`,`entry_id`,`user_id`) REFERENCES `play_session`(`id`,`entry_id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hand_id`,`play_session_id`,`user_id`) REFERENCES `hand`(`id`,`play_session_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "play_event_entry_source_check" CHECK("play_event"."entry_source" = 'live'),
	CONSTRAINT "play_event_schema_version_check" CHECK("play_event"."schema_version" >= 1),
	CONSTRAINT "play_event_payload_json_check" CHECK(json_valid("play_event"."payload"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `play_event_id_user_id_unique` ON `play_event` (`id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `play_event_id_entry_play_session_user_unique` ON `play_event` (`id`,`entry_id`,`play_session_id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `play_event_entry_sort_order_unique` ON `play_event` (`entry_id`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `play_event_play_session_sort_order_idx` ON `play_event` (`play_session_id`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `play_event_hand_idx` ON `play_event` (`hand_id`);
--> statement-breakpoint
CREATE TABLE `hand_action` (
	`hand_id` text NOT NULL,
	`user_id` text NOT NULL,
	`seq` integer NOT NULL,
	`street` integer NOT NULL,
	`seat` integer NOT NULL,
	`action` text NOT NULL,
	`amount` integer,
	`all_in` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`hand_id`, `seq`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hand_id`,`user_id`) REFERENCES `hand`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hand_id`,`seat`,`user_id`) REFERENCES `hand_seat`(`hand_id`,`seat`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "hand_action_seq_check" CHECK("hand_action"."seq" >= 1),
	CONSTRAINT "hand_action_street_check" CHECK("hand_action"."street" BETWEEN 0 AND 7),
	CONSTRAINT "hand_action_action_check" CHECK("hand_action"."action" IN ('post', 'straddle', 'bring_in', 'fold', 'check', 'call', 'bet', 'raise', 'draw', 'show', 'muck')),
	CONSTRAINT "hand_action_amount_check" CHECK("hand_action"."amount" >= 0),
	CONSTRAINT "hand_action_all_in_check" CHECK("hand_action"."all_in" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `ledger_line` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`role` text NOT NULL,
	`effect` text NOT NULL,
	`entry_id` text,
	`play_session_id` text,
	`source_event_id` text,
	`price_id` text,
	`category_id` text,
	`transfer_id` text,
	`occurred_at` integer NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`,`user_id`) REFERENCES `currency`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entry_id`,`user_id`) REFERENCES `entry`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`play_session_id`,`entry_id`,`user_id`) REFERENCES `play_session`(`id`,`entry_id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_event_id`,`entry_id`,`play_session_id`,`user_id`) REFERENCES `play_event`(`id`,`entry_id`,`play_session_id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`price_id`,`user_id`) REFERENCES `tournament_rule_price`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`,`user_id`) REFERENCES `ledger_category`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ledger_line_role_check" CHECK("ledger_line"."role" IN ('buy_in', 'reentry', 'fee', 'chip_purchase', 'addon', 'chip_remove', 'cash_out', 'prize', 'bounty', 'adjustment', 'exchange')),
	CONSTRAINT "ledger_line_effect_check" CHECK("ledger_line"."effect" IN ('real', 'virtual')),
	CONSTRAINT "ledger_line_quantity_check" CHECK("ledger_line"."quantity" <> 0 AND abs("ledger_line"."quantity") <= 1000000000000),
	CONSTRAINT "ledger_line_role_sign_check" CHECK(("ledger_line"."role" IN ('buy_in', 'reentry', 'fee', 'chip_purchase', 'addon') AND "ledger_line"."quantity" < 0) OR ("ledger_line"."role" IN ('chip_remove', 'cash_out', 'prize', 'bounty') AND "ledger_line"."quantity" > 0) OR "ledger_line"."role" IN ('adjustment', 'exchange')),
	CONSTRAINT "ledger_line_role_entry_check" CHECK(("ledger_line"."role" IN ('adjustment', 'exchange') AND "ledger_line"."entry_id" IS NULL AND "ledger_line"."effect" = 'real') OR (NOT ("ledger_line"."role" IN ('adjustment', 'exchange')) AND "ledger_line"."entry_id" IS NOT NULL)),
	CONSTRAINT "ledger_line_exchange_transfer_check" CHECK(("ledger_line"."role" = 'exchange') = ("ledger_line"."transfer_id" IS NOT NULL)),
	CONSTRAINT "ledger_line_play_session_entry_check" CHECK("ledger_line"."play_session_id" IS NULL OR "ledger_line"."entry_id" IS NOT NULL),
	CONSTRAINT "ledger_line_source_event_scope_check" CHECK("ledger_line"."source_event_id" IS NULL OR ("ledger_line"."entry_id" IS NOT NULL AND "ledger_line"."play_session_id" IS NOT NULL)),
	CONSTRAINT "ledger_line_category_role_check" CHECK("ledger_line"."category_id" IS NULL OR "ledger_line"."role" IN ('adjustment', 'exchange')),
	CONSTRAINT "ledger_line_price_role_check" CHECK("ledger_line"."price_id" IS NULL OR "ledger_line"."role" IN ('buy_in', 'reentry', 'fee', 'chip_purchase')),
	CONSTRAINT "ledger_line_wallet_links_check" CHECK(NOT ("ledger_line"."role" IN ('adjustment', 'exchange')) OR ("ledger_line"."play_session_id" IS NULL AND "ledger_line"."source_event_id" IS NULL AND "ledger_line"."price_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_line_id_user_id_unique` ON `ledger_line` (`id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `ledger_line_user_entry_idx` ON `ledger_line` (`user_id`,`entry_id`);
--> statement-breakpoint
CREATE INDEX `ledger_line_user_asset_occurred_at_idx` ON `ledger_line` (`user_id`,`asset_id`,`occurred_at`,`id`);
--> statement-breakpoint
CREATE INDEX `ledger_line_source_event_idx` ON `ledger_line` (`source_event_id`);
--> statement-breakpoint
CREATE INDEX `ledger_line_play_session_idx` ON `ledger_line` (`play_session_id`);
--> statement-breakpoint
CREATE INDEX `ledger_line_transfer_idx` ON `ledger_line` (`transfer_id`);
--> statement-breakpoint
CREATE INDEX `ledger_line_price_idx` ON `ledger_line` (`price_id`);
--> statement-breakpoint
CREATE INDEX `ledger_line_category_idx` ON `ledger_line` (`category_id`);
--> statement-breakpoint
CREATE TABLE `asset_rate` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`base_asset_id` text NOT NULL,
	`quote_asset_id` text NOT NULL,
	`rate_num` integer NOT NULL,
	`rate_den` integer NOT NULL,
	`effective_from` integer NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`base_asset_id`,`user_id`) REFERENCES `currency`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quote_asset_id`,`user_id`) REFERENCES `currency`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "asset_rate_distinct_assets_check" CHECK("asset_rate"."base_asset_id" <> "asset_rate"."quote_asset_id"),
	CONSTRAINT "asset_rate_rate_num_check" CHECK("asset_rate"."rate_num" BETWEEN 1 AND 1000000000000),
	CONSTRAINT "asset_rate_rate_den_check" CHECK("asset_rate"."rate_den" BETWEEN 1 AND 1000000000000),
	CONSTRAINT "asset_rate_effective_from_check" CHECK("asset_rate"."effective_from" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_rate_id_user_id_unique` ON `asset_rate` (`id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_rate_pair_effective_from_unique` ON `asset_rate` (`user_id`,`base_asset_id`,`quote_asset_id`,`effective_from`);
--> statement-breakpoint
CREATE INDEX `asset_rate_quote_asset_idx` ON `asset_rate` (`quote_asset_id`);
--> statement-breakpoint
CREATE TABLE `_gate_0059_tables_created` (`v` integer NOT NULL);
--> statement-breakpoint
INSERT INTO `_gate_0059_tables_created` (`v`) SELECT NULL WHERE (SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name IN ('game_lineup', 'game_lineup_group', 'game_lineup_variant', 'cash_rule', 'cash_rule_stake', 'tournament_rule', 'tournament_rule_level', 'tournament_rule_level_stake', 'tournament_rule_price', 'entry_cash', 'entry_tournament', 'play_event', 'hand_action', 'ledger_line', 'asset_rate')) <> 15;
--> statement-breakpoint
DROP TABLE `_gate_0059_tables_created`;
--> statement-breakpoint
CREATE TABLE `_gate_0059_indexes_created` (`v` integer NOT NULL);
--> statement-breakpoint
INSERT INTO `_gate_0059_indexes_created` (`v`) SELECT NULL WHERE (SELECT count(*) FROM sqlite_master WHERE type = 'index' AND name IN ('ledger_category_user_name_unique', 'entry_id_source_user_id_unique', 'game_group_id_user_id_unique', 'hand_id_play_session_user_unique', 'hand_seat_hand_seat_user_unique', 'game_lineup_id_user_id_unique', 'game_lineup_game_mix_idx', 'game_lineup_group_id_user_id_unique', 'game_lineup_group_lineup_id_id_unique', 'game_lineup_group_lineup_position_unique', 'game_lineup_group_game_group_idx', 'game_lineup_variant_group_position_unique', 'game_lineup_variant_lineup_variant_unique', 'game_lineup_variant_variant_idx', 'cash_rule_id_user_id_unique', 'cash_rule_id_ring_game_id_unique', 'cash_rule_id_lineup_id_unique', 'cash_rule_ring_game_idx', 'cash_rule_parent_idx', 'cash_rule_lineup_idx', 'cash_rule_stake_lineup_group_idx', 'tournament_rule_id_user_id_unique', 'tournament_rule_id_tournament_id_unique', 'tournament_rule_id_lineup_id_unique', 'tournament_rule_tournament_idx', 'tournament_rule_parent_idx', 'tournament_rule_lineup_idx', 'tournament_rule_level_id_user_id_unique', 'tournament_rule_level_id_lineup_id_unique', 'tournament_rule_level_rule_ordinal_unique', 'tournament_rule_level_lineup_idx', 'tournament_rule_level_stake_lineup_group_idx', 'tournament_rule_price_id_user_id_unique', 'tournament_rule_price_rule_ordinal_unique', 'tournament_rule_price_asset_idx', 'entry_cash_ring_game_idx', 'entry_cash_cash_rule_idx', 'entry_tournament_tournament_idx', 'entry_tournament_tournament_rule_idx', 'play_event_id_user_id_unique', 'play_event_id_entry_play_session_user_unique', 'play_event_entry_sort_order_unique', 'play_event_play_session_sort_order_idx', 'play_event_hand_idx', 'ledger_line_id_user_id_unique', 'ledger_line_user_entry_idx', 'ledger_line_user_asset_occurred_at_idx', 'ledger_line_source_event_idx', 'ledger_line_play_session_idx', 'ledger_line_transfer_idx', 'ledger_line_price_idx', 'ledger_line_category_idx', 'asset_rate_id_user_id_unique', 'asset_rate_pair_effective_from_unique', 'asset_rate_quote_asset_idx')) <> 55;
--> statement-breakpoint
DROP TABLE `_gate_0059_indexes_created`;
--> statement-breakpoint
CREATE TABLE `_gate_0059_foreign_keys_created` (`v` integer NOT NULL);
--> statement-breakpoint
INSERT INTO `_gate_0059_foreign_keys_created` (`v`) SELECT NULL WHERE (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('game_lineup')) <> 2
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('game_lineup_group')) <> 3
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('game_lineup_variant')) <> 4
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('cash_rule')) <> 5
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('cash_rule_stake')) <> 5
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('tournament_rule')) <> 5
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('tournament_rule_level')) <> 4
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('tournament_rule_level_stake')) <> 5
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('tournament_rule_price')) <> 3
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('entry_cash')) <> 5
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('entry_tournament')) <> 5
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('play_event')) <> 4
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('hand_action')) <> 3
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('ledger_line')) <> 7
  OR (SELECT count(DISTINCT id) FROM pragma_foreign_key_list('asset_rate')) <> 3;
--> statement-breakpoint
DROP TABLE `_gate_0059_foreign_keys_created`;
--> statement-breakpoint
CREATE TABLE `_gate_0059_foreign_key_check` (`v` integer NOT NULL);
--> statement-breakpoint
INSERT INTO `_gate_0059_foreign_key_check` (`v`) SELECT NULL WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check('entry'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('entry_cash'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('entry_tournament'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('play_session'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('play_event'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('hand'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('hand_board'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('hand_seat'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('hand_action'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('asset_rate'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('ledger_category'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('ledger_line'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('user_setting'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('game_lineup'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('game_lineup_group'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('game_lineup_variant'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('cash_rule'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('cash_rule_stake'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('tournament_rule'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('tournament_rule_level'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('tournament_rule_level_stake'))
  OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('tournament_rule_price'));
--> statement-breakpoint
DROP TABLE `_gate_0059_foreign_key_check`;
--> statement-breakpoint
CREATE TABLE `_gate_0059_v2_tables_empty` (`v` integer NOT NULL);
--> statement-breakpoint
INSERT INTO `_gate_0059_v2_tables_empty` (`v`) SELECT NULL WHERE EXISTS (SELECT 1 FROM `entry`)
  OR EXISTS (SELECT 1 FROM `entry_cash`)
  OR EXISTS (SELECT 1 FROM `entry_tournament`)
  OR EXISTS (SELECT 1 FROM `play_session`)
  OR EXISTS (SELECT 1 FROM `play_event`)
  OR EXISTS (SELECT 1 FROM `hand`)
  OR EXISTS (SELECT 1 FROM `hand_board`)
  OR EXISTS (SELECT 1 FROM `hand_seat`)
  OR EXISTS (SELECT 1 FROM `hand_action`)
  OR EXISTS (SELECT 1 FROM `asset_rate`)
  OR EXISTS (SELECT 1 FROM `ledger_category`)
  OR EXISTS (SELECT 1 FROM `ledger_line`)
  OR EXISTS (SELECT 1 FROM `user_setting`)
  OR EXISTS (SELECT 1 FROM `game_lineup`)
  OR EXISTS (SELECT 1 FROM `game_lineup_group`)
  OR EXISTS (SELECT 1 FROM `game_lineup_variant`)
  OR EXISTS (SELECT 1 FROM `cash_rule`)
  OR EXISTS (SELECT 1 FROM `cash_rule_stake`)
  OR EXISTS (SELECT 1 FROM `tournament_rule`)
  OR EXISTS (SELECT 1 FROM `tournament_rule_level`)
  OR EXISTS (SELECT 1 FROM `tournament_rule_level_stake`)
  OR EXISTS (SELECT 1 FROM `tournament_rule_price`);
--> statement-breakpoint
DROP TABLE `_gate_0059_v2_tables_empty`;
