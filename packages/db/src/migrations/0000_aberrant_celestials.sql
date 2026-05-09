CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `dashboard_widget` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device` text NOT NULL,
	`type` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`x` integer DEFAULT 0 NOT NULL,
	`y` integer DEFAULT 0 NOT NULL,
	`w` integer DEFAULT 2 NOT NULL,
	`h` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dashboard_widget_user_device_idx` ON `dashboard_widget` (`user_id`,`device`);--> statement-breakpoint
CREATE TABLE `limit_format` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`blind1_label` text NOT NULL,
	`blind2_label` text NOT NULL,
	`blind3_label` text,
	`blind4_label` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `player` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`memo` text,
	`is_temporary` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_userId_idx` ON `player` (`user_id`);--> statement-breakpoint
CREATE TABLE `player_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'gray' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `playerTag_userId_idx` ON `player_tag` (`user_id`);--> statement-breakpoint
CREATE TABLE `player_to_player_tag` (
	`player_id` text NOT NULL,
	`player_tag_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`player_id`, `player_tag_id`),
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_tag_id`) REFERENCES `player_tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ring_game_blind_set` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ring_game_id` text NOT NULL,
	`limit_format_id` integer NOT NULL,
	`blind1` integer NOT NULL,
	`blind2` integer NOT NULL,
	`blind3` integer,
	`blind4` integer,
	`ante` integer,
	`ante_type` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`ring_game_id`) REFERENCES `ring_game`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`limit_format_id`) REFERENCES `limit_format`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `ringGameBlindSet_ringGameId_idx` ON `ring_game_blind_set` (`ring_game_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ringGameBlindSet_ringGameId_sortOrder_uniq` ON `ring_game_blind_set` (`ring_game_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `ring_game` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text,
	`name` text NOT NULL,
	`variant_id` integer,
	`min_buy_in` integer,
	`max_buy_in` integer,
	`table_size` integer,
	`currency_id` text,
	`memo` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `variant`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ringGame_storeId_idx` ON `ring_game` (`store_id`);--> statement-breakpoint
CREATE TABLE `session_blind_level` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`level_index` integer NOT NULL,
	`is_break` integer DEFAULT false NOT NULL,
	`minutes` integer,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessionBlindLevel_sessionId_idx` ON `session_blind_level` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessionBlindLevel_sessionId_sortOrder_uniq` ON `session_blind_level` (`session_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `session_cash_blind_set` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`limit_format_id` integer NOT NULL,
	`blind1` integer NOT NULL,
	`blind2` integer NOT NULL,
	`blind3` integer,
	`blind4` integer,
	`ante` integer,
	`ante_type` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`limit_format_id`) REFERENCES `limit_format`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `sessionCashBlindSet_sessionId_idx` ON `session_cash_blind_set` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessionCashBlindSet_sessionId_sortOrder_uniq` ON `session_cash_blind_set` (`session_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `session_cash_detail` (
	`session_id` text PRIMARY KEY NOT NULL,
	`ring_game_id` text,
	`rule_name` text NOT NULL,
	`min_buy_in` integer,
	`max_buy_in` integer,
	`table_size` integer,
	`variant_id` integer NOT NULL,
	`buy_in` integer,
	`cash_out` integer,
	`ev_cash_out` integer,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ring_game_id`) REFERENCES `ring_game`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`variant_id`) REFERENCES `variant`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `session_cash_ring_idx` ON `session_cash_detail` (`ring_game_id`);--> statement-breakpoint
CREATE TABLE `session_chip_purchase_option` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`name` text NOT NULL,
	`cost` integer NOT NULL,
	`chips` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessionChipPurchaseOption_sessionId_idx` ON `session_chip_purchase_option` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessionChipPurchaseOption_sessionId_sortOrder_uniq` ON `session_chip_purchase_option` (`session_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `session_chip_purchase_record` (
	`session_id` text NOT NULL,
	`chip_purchase_option_id` integer NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`session_id`, `chip_purchase_option_id`),
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chip_purchase_option_id`) REFERENCES `session_chip_purchase_option`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sessionChipPurchaseRecord_count_nonneg" CHECK("session_chip_purchase_record"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE `session_event` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessionEvent_sessionId_idx` ON `session_event` (`session_id`);--> statement-breakpoint
CREATE INDEX `sessionEvent_eventType_idx` ON `session_event` (`event_type`);--> statement-breakpoint
CREATE INDEX `sessionEvent_sessionId_occurredAt_sortOrder_idx` ON `session_event` (`session_id`,`occurred_at`,`sort_order`);--> statement-breakpoint
CREATE INDEX `sessionEvent_sessionId_eventType_idx` ON `session_event` (`session_id`,`event_type`);--> statement-breakpoint
CREATE TABLE `session_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessionTag_userId_idx` ON `session_tag` (`user_id`);--> statement-breakpoint
CREATE TABLE `session_to_session_tag` (
	`session_id` text NOT NULL,
	`session_tag_id` text NOT NULL,
	PRIMARY KEY(`session_id`, `session_tag_id`),
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_tag_id`) REFERENCES `session_tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session_tournament_blind_set` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_blind_level_id` integer NOT NULL,
	`limit_format_id` integer NOT NULL,
	`blind1` integer NOT NULL,
	`blind2` integer NOT NULL,
	`blind3` integer,
	`blind4` integer,
	`ante` integer,
	`ante_type` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_blind_level_id`) REFERENCES `session_blind_level`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`limit_format_id`) REFERENCES `limit_format`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `sessionTournamentBlindSet_levelId_idx` ON `session_tournament_blind_set` (`session_blind_level_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessionTournamentBlindSet_levelId_sortOrder_uniq` ON `session_tournament_blind_set` (`session_blind_level_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `session_tournament_detail` (
	`session_id` text PRIMARY KEY NOT NULL,
	`tournament_id` text,
	`rule_name` text NOT NULL,
	`starting_stack` integer,
	`bounty_amount` integer,
	`table_size` integer,
	`buy_in` integer NOT NULL,
	`entry_fee` integer DEFAULT 0 NOT NULL,
	`variant_id` integer NOT NULL,
	`placement` integer,
	`total_entries` integer,
	`before_deadline` integer,
	`prize_money` integer,
	`bounty_prizes` integer,
	`timer_started_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`variant_id`) REFERENCES `variant`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "session_tournament_before_deadline_check" CHECK((before_deadline != 1) OR (placement IS NULL AND total_entries IS NULL))
);
--> statement-breakpoint
CREATE INDEX `session_tournament_tournament_idx` ON `session_tournament_detail` (`tournament_id`);--> statement-breakpoint
CREATE TABLE `game_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`session_date` integer NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`break_minutes` integer,
	`memo` text,
	`store_id` text,
	`currency_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "session_manual_completed_check" CHECK((source != 'manual') OR (status = 'completed')),
	CONSTRAINT "session_manual_started_at_check" CHECK((source != 'manual') OR (started_at IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `session_user_kind_status_idx` ON `game_session` (`user_id`,`kind`,`status`);--> statement-breakpoint
CREATE INDEX `session_user_date_idx` ON `game_session` (`user_id`,`session_date`);--> statement-breakpoint
CREATE INDEX `session_store_idx` ON `game_session` (`store_id`);--> statement-breakpoint
CREATE INDEX `session_currency_idx` ON `game_session` (`currency_id`);--> statement-breakpoint
CREATE TABLE `currency` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`unit` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `currency_userId_idx` ON `currency` (`user_id`);--> statement-breakpoint
CREATE TABLE `currency_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`currency_id` text NOT NULL,
	`transaction_type_id` text NOT NULL,
	`session_id` text,
	`amount` integer NOT NULL,
	`transacted_at` integer NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_type_id`) REFERENCES `transaction_type`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `currencyTransaction_currencyId_idx` ON `currency_transaction` (`currency_id`);--> statement-breakpoint
CREATE INDEX `currencyTransaction_sessionId_idx` ON `currency_transaction` (`session_id`);--> statement-breakpoint
CREATE TABLE `store` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `store_userId_idx` ON `store` (`user_id`);--> statement-breakpoint
CREATE TABLE `transaction_type` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transactionType_userId_idx` ON `transaction_type` (`user_id`);--> statement-breakpoint
CREATE TABLE `tournament_blind_level` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` text NOT NULL,
	`level_index` integer NOT NULL,
	`is_break` integer DEFAULT false NOT NULL,
	`minutes` integer,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tournamentBlindLevel_tournamentId_idx` ON `tournament_blind_level` (`tournament_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tournamentBlindLevel_tournamentId_sortOrder_uniq` ON `tournament_blind_level` (`tournament_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `tournament_blind_set` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_blind_level_id` integer NOT NULL,
	`limit_format_id` integer NOT NULL,
	`blind1` integer NOT NULL,
	`blind2` integer NOT NULL,
	`blind3` integer,
	`blind4` integer,
	`ante` integer,
	`ante_type` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tournament_blind_level_id`) REFERENCES `tournament_blind_level`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`limit_format_id`) REFERENCES `limit_format`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `tournamentBlindSet_levelId_idx` ON `tournament_blind_set` (`tournament_blind_level_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tournamentBlindSet_levelId_sortOrder_uniq` ON `tournament_blind_set` (`tournament_blind_level_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `tournament_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tournamentTag_tournamentId_idx` ON `tournament_tag` (`tournament_id`);--> statement-breakpoint
CREATE TABLE `tournament` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`variant_id` integer,
	`buy_in` integer,
	`entry_fee` integer,
	`starting_stack` integer,
	`bounty_amount` integer,
	`table_size` integer,
	`currency_id` text,
	`memo` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `variant`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tournament_storeId_idx` ON `tournament` (`store_id`);--> statement-breakpoint
CREATE TABLE `tournament_chip_purchase` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`name` text NOT NULL,
	`cost` integer NOT NULL,
	`chips` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tournamentChipPurchase_tournamentId_idx` ON `tournament_chip_purchase` (`tournament_id`);--> statement-breakpoint
CREATE TABLE `update_note_view` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`version` text NOT NULL,
	`viewed_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `update_note_view_user_id_idx` ON `update_note_view` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `update_note_view_user_version_idx` ON `update_note_view` (`user_id`,`version`);--> statement-breakpoint
CREATE TABLE `variant` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
