-- Data model v2, P1 expand (SA2-299): the entry aggregate. Nothing reads or
-- writes these tables yet; the dual writes start in T06 / T07.
--
-- A parent table and its UNIQUE indexes come before every child that
-- references them, so the composite FKs of a child never name a parent key
-- that is missing. Every statement is IF NOT EXISTS because a migration file
-- is not one transaction in production (.claude/rules/db-migrations.md): a
-- retry after a failure halfway re-runs the file from the top.
CREATE TABLE IF NOT EXISTS `entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`room_id` text,
	`asset_id` text,
	`title` text,
	`played_on` text NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`,`user_id`) REFERENCES `room`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`,`user_id`) REFERENCES `currency`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entry_kind_check" CHECK("entry"."kind" IN ('cash', 'tournament')),
	CONSTRAINT "entry_source_check" CHECK("entry"."source" IN ('live', 'manual', 'import')),
	CONSTRAINT "entry_status_check" CHECK("entry"."status" IN ('open', 'settled')),
	CONSTRAINT "entry_manual_settled_check" CHECK("entry"."source" <> 'manual' OR "entry"."status" = 'settled'),
	CONSTRAINT "entry_played_on_check" CHECK("entry"."played_on" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `entry_id_user_id_unique` ON `entry` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `entry_id_kind_user_id_unique` ON `entry` (`id`,`kind`,`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entry_user_played_on_idx` ON `entry` (`user_id`,`played_on`,`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entry_user_kind_status_idx` ON `entry` (`user_id`,`kind`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entry_room_idx` ON `entry` (`room_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entry_asset_idx` ON `entry` (`asset_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `entry_cash` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`ring_game_id` text,
	`ev_diff` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`,`user_id`) REFERENCES `entry`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ring_game_id`,`user_id`) REFERENCES `ring_game`(`id`,`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entry_cash_ring_game_idx` ON `entry_cash` (`ring_game_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `entry_tournament` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tournament_id` text,
	`placement` integer,
	`total_entries` integer,
	`before_deadline` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`,`user_id`) REFERENCES `entry`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`,`user_id`) REFERENCES `tournament`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entry_tournament_placement_check" CHECK("entry_tournament"."placement" >= 1),
	CONSTRAINT "entry_tournament_total_entries_check" CHECK("entry_tournament"."total_entries" >= 1),
	CONSTRAINT "entry_tournament_placement_within_total_check" CHECK("entry_tournament"."placement" <= "entry_tournament"."total_entries"),
	CONSTRAINT "entry_tournament_before_deadline_check" CHECK("entry_tournament"."before_deadline" IN (0, 1)),
	CONSTRAINT "entry_tournament_before_deadline_placement_check" CHECK("entry_tournament"."before_deadline" = 0 OR "entry_tournament"."placement" IS NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entry_tournament_tournament_idx` ON `entry_tournament` (`tournament_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `play_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`kind` text NOT NULL,
	`seq` integer NOT NULL,
	`label` text,
	`local_date` text NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`break_minutes` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`end_state` text,
	`end_stack` integer,
	`clock_started_at` integer,
	`clock_start_level` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`,`kind`,`user_id`) REFERENCES `entry`(`id`,`kind`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "play_session_seq_check" CHECK("play_session"."seq" >= 1),
	CONSTRAINT "play_session_local_date_check" CHECK("play_session"."local_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "play_session_time_order_check" CHECK("play_session"."ended_at" >= "play_session"."started_at"),
	CONSTRAINT "play_session_break_minutes_check" CHECK("play_session"."break_minutes" >= 0),
	CONSTRAINT "play_session_status_check" CHECK("play_session"."status" IN ('active', 'paused', 'ended')),
	CONSTRAINT "play_session_end_state_presence_check" CHECK(("play_session"."status" = 'ended') = ("play_session"."end_state" IS NOT NULL)),
	CONSTRAINT "play_session_end_state_kind_check" CHECK("play_session"."end_state" IS NULL OR ("play_session"."kind" = 'cash' AND "play_session"."end_state" IN ('held', 'cashed_out', 'finished')) OR ("play_session"."kind" = 'tournament' AND "play_session"."end_state" IN ('bagged', 'busted', 'finished'))),
	CONSTRAINT "play_session_end_stack_check" CHECK("play_session"."end_stack" >= 0),
	CONSTRAINT "play_session_end_stack_required_check" CHECK("play_session"."end_stack" IS NOT NULL OR NOT ("play_session"."end_state" IN ('bagged', 'held')))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `play_session_id_user_id_unique` ON `play_session` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `play_session_id_entry_id_user_id_unique` ON `play_session` (`id`,`entry_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `play_session_entry_seq_unique` ON `play_session` (`entry_id`,`seq`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `play_session_one_unfinished_per_user_idx` ON `play_session` (`user_id`) WHERE "play_session"."status" <> 'ended';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `play_session_user_local_date_idx` ON `play_session` (`user_id`,`local_date`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `play_event` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`play_session_id` text NOT NULL,
	`type` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`occurred_at` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`,`user_id`) REFERENCES `entry`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`play_session_id`,`entry_id`,`user_id`) REFERENCES `play_session`(`id`,`entry_id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "play_event_payload_json_check" CHECK(json_valid("play_event"."payload"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `play_event_id_user_id_unique` ON `play_event` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `play_event_entry_sort_order_unique` ON `play_event` (`entry_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `play_event_play_session_sort_order_idx` ON `play_event` (`play_session_id`,`sort_order`);
