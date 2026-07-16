CREATE TABLE `filter_preset` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`screen_key` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `filterPreset_userId_idx` ON `filter_preset` (`user_id`);--> statement-breakpoint
CREATE INDEX `filterPreset_userId_screenKey_idx` ON `filter_preset` (`user_id`,`screen_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `filterPreset_userId_screenKey_name_idx` ON `filter_preset` (`user_id`,`screen_key`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `filterPreset_userId_screenKey_defaultUnique_idx` ON `filter_preset` (`user_id`,`screen_key`) WHERE "filter_preset"."is_default" = 1;