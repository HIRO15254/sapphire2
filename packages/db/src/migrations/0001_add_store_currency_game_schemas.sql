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
CREATE TABLE `currency_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`currency_id` text NOT NULL,
	`transaction_type_id` text NOT NULL,
	`amount` integer NOT NULL,
	`transacted_at` integer NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_type_id`) REFERENCES `transaction_type`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `currencyTransaction_currencyId_idx` ON `currency_transaction` (`currency_id`);--> statement-breakpoint
CREATE TABLE `ring_game` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`variant` text DEFAULT 'nlh' NOT NULL,
	`blind1` integer,
	`blind2` integer,
	`blind3` integer,
	`ante` integer,
	`ante_type` text,
	`min_buy_in` integer,
	`max_buy_in` integer,
	`table_size` integer,
	`currency_id` text,
	`memo` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ringGame_storeId_idx` ON `ring_game` (`store_id`);--> statement-breakpoint
CREATE TABLE `tournament` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`variant` text DEFAULT 'nlh' NOT NULL,
	`buy_in` integer,
	`entry_fee` integer,
	`starting_stack` integer,
	`rebuy_allowed` integer DEFAULT false NOT NULL,
	`rebuy_cost` integer,
	`rebuy_chips` integer,
	`addon_allowed` integer DEFAULT false NOT NULL,
	`addon_cost` integer,
	`addon_chips` integer,
	`bounty_amount` integer,
	`table_size` integer,
	`currency_id` text,
	`memo` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tournament_storeId_idx` ON `tournament` (`store_id`);--> statement-breakpoint
CREATE TABLE `blind_level` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`level` integer NOT NULL,
	`is_break` integer DEFAULT false NOT NULL,
	`blind1` integer,
	`blind2` integer,
	`blind3` integer,
	`ante` integer,
	`minutes` integer,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `blindLevel_tournamentId_idx` ON `blind_level` (`tournament_id`);
