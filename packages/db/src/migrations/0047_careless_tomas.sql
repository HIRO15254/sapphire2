CREATE TABLE `item` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`currency_id` text NOT NULL,
	`unit_value` integer NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `item_userId_idx` ON `item` (`user_id`);--> statement-breakpoint
CREATE INDEX `item_currencyId_idx` ON `item` (`currency_id`);--> statement-breakpoint
CREATE TABLE `item_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`session_id` text,
	`count` integer NOT NULL,
	`transacted_at` integer NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `itemTransaction_itemId_idx` ON `item_transaction` (`item_id`);--> statement-breakpoint
CREATE INDEX `itemTransaction_sessionId_idx` ON `item_transaction` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `itemTransaction_session_item_idx` ON `item_transaction` (`session_id`,`item_id`) WHERE "item_transaction"."session_id" is not null;--> statement-breakpoint
CREATE TABLE `session_item_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`item_id` text,
	`direction` text NOT NULL,
	`count` integer NOT NULL,
	`item_name` text NOT NULL,
	`unit_value` integer NOT NULL,
	`currency_id` text,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sessionItemUsage_sessionId_idx` ON `session_item_usage` (`session_id`);--> statement-breakpoint
CREATE INDEX `sessionItemUsage_itemId_idx` ON `session_item_usage` (`item_id`);--> statement-breakpoint
ALTER TABLE `session_cash_detail` ADD `virtual_buy_in` integer;--> statement-breakpoint
ALTER TABLE `session_cash_detail` ADD `virtual_cash_out` integer;--> statement-breakpoint
ALTER TABLE `session_tournament_detail` ADD `virtual_buy_in` integer;--> statement-breakpoint
ALTER TABLE `session_tournament_detail` ADD `virtual_cash_out` integer;