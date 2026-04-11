CREATE TABLE IF NOT EXISTS `update_note_view` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`version` text NOT NULL,
	`viewed_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `update_note_view_user_id_idx` ON `update_note_view` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `update_note_view_user_version_idx` ON `update_note_view` (`user_id`,`version`);