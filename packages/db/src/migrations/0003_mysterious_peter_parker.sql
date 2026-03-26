PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ring_game` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text,
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
INSERT INTO `__new_ring_game`("id", "store_id", "name", "variant", "blind1", "blind2", "blind3", "ante", "ante_type", "min_buy_in", "max_buy_in", "table_size", "currency_id", "memo", "archived_at", "created_at", "updated_at") SELECT "id", "store_id", "name", "variant", "blind1", "blind2", "blind3", "ante", "ante_type", "min_buy_in", "max_buy_in", "table_size", "currency_id", "memo", "archived_at", "created_at", "updated_at" FROM `ring_game`;--> statement-breakpoint
DROP TABLE `ring_game`;--> statement-breakpoint
ALTER TABLE `__new_ring_game` RENAME TO `ring_game`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `ringGame_storeId_idx` ON `ring_game` (`store_id`);