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
	FOREIGN KEY (`session_id`) REFERENCES `poker_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_tag_id`) REFERENCES `session_tag`(`id`) ON UPDATE no action ON DELETE cascade
);
