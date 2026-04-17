CREATE TABLE `dashboard_widget` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device` text NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL DEFAULT '{}',
	`x` integer NOT NULL DEFAULT 0,
	`y` integer NOT NULL DEFAULT 0,
	`w` integer NOT NULL DEFAULT 2,
	`h` integer NOT NULL DEFAULT 1,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dashboard_widget_user_device_idx` ON `dashboard_widget` (`user_id`,`device`);
