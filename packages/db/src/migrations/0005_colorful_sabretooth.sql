CREATE TABLE `player` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`memo` text,
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
	PRIMARY KEY(`player_id`, `player_tag_id`),
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_tag_id`) REFERENCES `player_tag`(`id`) ON UPDATE no action ON DELETE cascade
);
