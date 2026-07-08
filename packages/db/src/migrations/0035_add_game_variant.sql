CREATE TABLE `game_variant` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`blind_label_1` text,
	`blind_label_2` text,
	`blind_label_3` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gameVariant_userId_idx` ON `game_variant` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `gameVariant_userId_name_unique` ON `game_variant` (`user_id`,`name`);--> statement-breakpoint
ALTER TABLE `ring_game` ADD `variant_id` text REFERENCES `game_variant`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
ALTER TABLE `tournament` ADD `variant_id` text REFERENCES `game_variant`(`id`) ON UPDATE no action ON DELETE set null;