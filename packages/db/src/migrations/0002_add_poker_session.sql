CREATE TABLE `poker_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`session_date` integer NOT NULL,
	`store_id` text,
	`ring_game_id` text,
	`tournament_id` text,
	`currency_id` text,
	`buy_in` integer,
	`cash_out` integer,
	`ev_cash_out` integer,
	`tournament_buy_in` integer,
	`entry_fee` integer,
	`placement` integer,
	`total_entries` integer,
	`prize_money` integer,
	`rebuy_count` integer,
	`rebuy_cost` integer,
	`addon_cost` integer,
	`bounty_prizes` integer,
	`started_at` integer,
	`ended_at` integer,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ring_game_id`) REFERENCES `ring_game`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pokerSession_userId_idx` ON `poker_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `pokerSession_sessionDate_idx` ON `poker_session` (`session_date`);--> statement-breakpoint
CREATE INDEX `pokerSession_storeId_idx` ON `poker_session` (`store_id`);--> statement-breakpoint
CREATE INDEX `pokerSession_currencyId_idx` ON `poker_session` (`currency_id`);--> statement-breakpoint
ALTER TABLE `currency_transaction` ADD `session_id` text REFERENCES poker_session(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `currencyTransaction_sessionId_idx` ON `currency_transaction` (`session_id`);
