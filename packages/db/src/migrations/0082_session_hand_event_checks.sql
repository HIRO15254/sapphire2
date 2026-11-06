CREATE TABLE `__gate_0082` (
 `values_valid` integer DEFAULT 1 NOT NULL,
 `rows_restored` integer DEFAULT 1 NOT NULL,
 `children_restored` integer DEFAULT 1 NOT NULL,
 `ledger_links_restored` integer DEFAULT 1 NOT NULL,
 `foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
INSERT INTO `__gate_0082` (`values_valid`) SELECT NULL WHERE EXISTS (SELECT 1 FROM `play_session` WHERE `clock_start_level` < 1)
 OR EXISTS (SELECT 1 FROM `hand` WHERE `level_ordinal` < 1)
 OR EXISTS (SELECT 1 FROM `play_event` WHERE `sort_order` < 0);--> statement-breakpoint
CREATE TABLE `__stage_0082_play_session` AS SELECT `id`, `user_id`, `entry_id`, `kind`, `seq`, `next_hand_seq`, `label`, `local_date`, `started_at`, `ended_at`, `break_minutes`, `status`, `end_state`, `end_stack`, `clock_started_at`, `clock_start_level`, `created_at`, `updated_at` FROM `play_session`;--> statement-breakpoint
CREATE TABLE `__stage_0082_hand` AS SELECT `id`, `user_id`, `play_session_id`, `hand_no`, `seq`, `played_at`, `detail`, `button_seat`, `table_size`, `level_ordinal`, `stakes`, `variant_id`, `pot`, `rake`, `memo`, `created_at`, `updated_at` FROM `hand`;--> statement-breakpoint
CREATE TABLE `__stage_0082_play_event` AS SELECT `id`, `user_id`, `entry_id`, `entry_source`, `play_session_id`, `type`, `schema_version`, `occurred_at`, `sort_order`, `payload`, `created_at`, `updated_at`, `hand_id` FROM `play_event`;--> statement-breakpoint
CREATE TABLE `__stage_0082_hand_board` AS SELECT `hand_id`, `user_id`, `board_no`, `cards` FROM `hand_board`;--> statement-breakpoint
CREATE TABLE `__stage_0082_hand_seat` AS SELECT `hand_id`, `user_id`, `seat`, `player_id`, `is_hero`, `start_stack`, `hole_cards`, `net`, `showed` FROM `hand_seat`;--> statement-breakpoint
CREATE TABLE `__stage_0082_hand_action` AS SELECT `hand_id`, `user_id`, `seq`, `street`, `seat`, `action`, `amount`, `all_in` FROM `hand_action`;--> statement-breakpoint
CREATE TABLE `__stage_0082_hand_tag_link` AS SELECT `user_id`, `hand_id`, `tag_id`, `reviewed_at` FROM `hand_tag_link`;--> statement-breakpoint
CREATE TABLE `__stage_0082_ledger_line` AS SELECT `id`, `play_session_id`, `source_event_id` FROM `ledger_line` WHERE `play_session_id` IS NOT NULL OR `source_event_id` IS NOT NULL;--> statement-breakpoint
UPDATE `ledger_line` SET `play_session_id` = NULL, `source_event_id` = NULL WHERE `play_session_id` IS NOT NULL OR `source_event_id` IS NOT NULL;--> statement-breakpoint
DELETE FROM `hand_action`;--> statement-breakpoint
DELETE FROM `hand_seat`;--> statement-breakpoint
DELETE FROM `hand_board`;--> statement-breakpoint
DELETE FROM `hand_tag_link`;--> statement-breakpoint
DELETE FROM `play_event`;--> statement-breakpoint
DELETE FROM `hand`;--> statement-breakpoint
DELETE FROM `play_session`;--> statement-breakpoint
DROP TABLE `play_session`;--> statement-breakpoint
CREATE TABLE `play_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`kind` text NOT NULL,
	`seq` integer NOT NULL,
	`next_hand_seq` integer DEFAULT 0 NOT NULL,
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
	CONSTRAINT "play_session_end_stack_required_check" CHECK("play_session"."end_stack" IS NOT NULL OR NOT ("play_session"."end_state" IN ('bagged', 'held'))),
	CONSTRAINT "play_session_clock_start_level_check" CHECK("play_session"."clock_start_level" >= 1)
);--> statement-breakpoint
CREATE UNIQUE INDEX `play_session_id_user_id_unique` ON `play_session` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `play_session_id_entry_id_user_id_unique` ON `play_session` (`id`,`entry_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `play_session_entry_seq_unique` ON `play_session` (`entry_id`,`seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `play_session_one_unfinished_per_user_idx` ON `play_session` (`user_id`) WHERE "play_session"."status" <> 'ended';--> statement-breakpoint
CREATE INDEX `play_session_user_local_date_idx` ON `play_session` (`user_id`,`local_date`);--> statement-breakpoint
INSERT INTO `play_session` (`id`, `user_id`, `entry_id`, `kind`, `seq`, `next_hand_seq`, `label`, `local_date`, `started_at`, `ended_at`, `break_minutes`, `status`, `end_state`, `end_stack`, `clock_started_at`, `clock_start_level`, `created_at`, `updated_at`)
SELECT `id`, `user_id`, `entry_id`, `kind`, `seq`, `next_hand_seq`, `label`, `local_date`, `started_at`, `ended_at`, `break_minutes`, `status`, `end_state`, `end_stack`, `clock_started_at`, `clock_start_level`, `created_at`, `updated_at` FROM `__stage_0082_play_session`;--> statement-breakpoint
DROP TABLE `hand`;--> statement-breakpoint
CREATE TABLE `hand` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`play_session_id` text NOT NULL,
	`hand_no` integer NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`played_at` integer,
	`detail` text NOT NULL,
	`button_seat` integer,
	`table_size` integer,
	`level_ordinal` integer,
	`stakes` text,
	`variant_id` text,
	`pot` integer,
	`rake` integer,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`play_session_id`,`user_id`) REFERENCES `play_session`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`,`user_id`) REFERENCES `game_variant`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "hand_hand_no_check" CHECK("hand"."hand_no" >= 1),
	CONSTRAINT "hand_detail_check" CHECK("hand"."detail" IN ('count', 'summary', 'full')),
	CONSTRAINT "hand_button_seat_check" CHECK("hand"."button_seat" BETWEEN 0 AND 9),
	CONSTRAINT "hand_table_size_check" CHECK("hand"."table_size" BETWEEN 2 AND 10),
	CONSTRAINT "hand_stakes_json_check" CHECK(json_valid("hand"."stakes")),
	CONSTRAINT "hand_pot_check" CHECK("hand"."pot" >= 0),
	CONSTRAINT "hand_rake_check" CHECK("hand"."rake" >= 0),
	CONSTRAINT "hand_level_ordinal_check" CHECK("hand"."level_ordinal" >= 1)
);--> statement-breakpoint
CREATE UNIQUE INDEX `hand_id_user_id_unique` ON `hand` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `hand_id_play_session_user_unique` ON `hand` (`id`,`play_session_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `hand_play_session_hand_no_unique` ON `hand` (`play_session_id`,`hand_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `hand_play_session_seq_unique` ON `hand` (`play_session_id`,`seq`);--> statement-breakpoint
CREATE INDEX `hand_user_played_at_idx` ON `hand` (`user_id`,`played_at`);--> statement-breakpoint
CREATE INDEX `hand_variant_idx` ON `hand` (`variant_id`);--> statement-breakpoint
INSERT INTO `hand` (`id`, `user_id`, `play_session_id`, `hand_no`, `seq`, `played_at`, `detail`, `button_seat`, `table_size`, `level_ordinal`, `stakes`, `variant_id`, `pot`, `rake`, `memo`, `created_at`, `updated_at`)
SELECT `id`, `user_id`, `play_session_id`, `hand_no`, `seq`, `played_at`, `detail`, `button_seat`, `table_size`, `level_ordinal`, `stakes`, `variant_id`, `pot`, `rake`, `memo`, `created_at`, `updated_at` FROM `__stage_0082_hand`;--> statement-breakpoint
DROP TABLE `play_event`;--> statement-breakpoint
CREATE TABLE `play_event` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`entry_source` text NOT NULL,
	`play_session_id` text NOT NULL,
	`type` text NOT NULL,
	`schema_version` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	`hand_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`,`entry_source`,`user_id`) REFERENCES `entry`(`id`,`source`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`play_session_id`,`entry_id`,`user_id`) REFERENCES `play_session`(`id`,`entry_id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hand_id`,`play_session_id`,`user_id`) REFERENCES `hand`(`id`,`play_session_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "play_event_entry_source_check" CHECK("play_event"."entry_source" = 'live'),
	CONSTRAINT "play_event_schema_version_check" CHECK("play_event"."schema_version" >= 1),
	CONSTRAINT "play_event_payload_json_check" CHECK(json_valid("play_event"."payload")),
	CONSTRAINT "play_event_sort_order_check" CHECK("play_event"."sort_order" >= 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX `play_event_id_user_id_unique` ON `play_event` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `play_event_id_entry_play_session_user_unique` ON `play_event` (`id`,`entry_id`,`play_session_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `play_event_entry_sort_order_unique` ON `play_event` (`entry_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `play_event_play_session_sort_order_idx` ON `play_event` (`play_session_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `play_event_hand_idx` ON `play_event` (`hand_id`);--> statement-breakpoint
CREATE INDEX `play_event_user_player_ref_idx` ON `play_event` (`user_id`,json_extract(payload, '$.playerId'));--> statement-breakpoint
INSERT INTO `play_event` (`id`, `user_id`, `entry_id`, `entry_source`, `play_session_id`, `type`, `schema_version`, `occurred_at`, `sort_order`, `payload`, `created_at`, `updated_at`, `hand_id`)
SELECT `id`, `user_id`, `entry_id`, `entry_source`, `play_session_id`, `type`, `schema_version`, `occurred_at`, `sort_order`, `payload`, `created_at`, `updated_at`, `hand_id` FROM `__stage_0082_play_event`;--> statement-breakpoint
INSERT INTO `hand_board` (`hand_id`, `user_id`, `board_no`, `cards`) SELECT `hand_id`, `user_id`, `board_no`, `cards` FROM `__stage_0082_hand_board`;--> statement-breakpoint
INSERT INTO `hand_seat` (`hand_id`, `user_id`, `seat`, `player_id`, `is_hero`, `start_stack`, `hole_cards`, `net`, `showed`) SELECT `hand_id`, `user_id`, `seat`, `player_id`, `is_hero`, `start_stack`, `hole_cards`, `net`, `showed` FROM `__stage_0082_hand_seat`;--> statement-breakpoint
INSERT INTO `hand_action` (`hand_id`, `user_id`, `seq`, `street`, `seat`, `action`, `amount`, `all_in`) SELECT `hand_id`, `user_id`, `seq`, `street`, `seat`, `action`, `amount`, `all_in` FROM `__stage_0082_hand_action`;--> statement-breakpoint
INSERT INTO `hand_tag_link` (`user_id`, `hand_id`, `tag_id`, `reviewed_at`) SELECT `user_id`, `hand_id`, `tag_id`, `reviewed_at` FROM `__stage_0082_hand_tag_link`;--> statement-breakpoint
UPDATE `ledger_line` SET
 `play_session_id` = (SELECT `s`.`play_session_id` FROM `__stage_0082_ledger_line` AS `s` WHERE `s`.`id` = `ledger_line`.`id`),
 `source_event_id` = (SELECT `s`.`source_event_id` FROM `__stage_0082_ledger_line` AS `s` WHERE `s`.`id` = `ledger_line`.`id`)
WHERE `id` IN (SELECT `id` FROM `__stage_0082_ledger_line`);--> statement-breakpoint
INSERT INTO `__gate_0082` (`rows_restored`) SELECT NULL WHERE 0
 OR EXISTS (SELECT `id`, `user_id`, `entry_id`, `kind`, `seq`, `next_hand_seq`, `label`, `local_date`, `started_at`, `ended_at`, `break_minutes`, `status`, `end_state`, `end_stack`, `clock_started_at`, `clock_start_level`, `created_at`, `updated_at` FROM `__stage_0082_play_session` EXCEPT SELECT `id`, `user_id`, `entry_id`, `kind`, `seq`, `next_hand_seq`, `label`, `local_date`, `started_at`, `ended_at`, `break_minutes`, `status`, `end_state`, `end_stack`, `clock_started_at`, `clock_start_level`, `created_at`, `updated_at` FROM `play_session`)
 OR (SELECT count(*) FROM `play_session`) <> (SELECT count(*) FROM `__stage_0082_play_session`)
 OR EXISTS (SELECT `id`, `user_id`, `play_session_id`, `hand_no`, `seq`, `played_at`, `detail`, `button_seat`, `table_size`, `level_ordinal`, `stakes`, `variant_id`, `pot`, `rake`, `memo`, `created_at`, `updated_at` FROM `__stage_0082_hand` EXCEPT SELECT `id`, `user_id`, `play_session_id`, `hand_no`, `seq`, `played_at`, `detail`, `button_seat`, `table_size`, `level_ordinal`, `stakes`, `variant_id`, `pot`, `rake`, `memo`, `created_at`, `updated_at` FROM `hand`)
 OR (SELECT count(*) FROM `hand`) <> (SELECT count(*) FROM `__stage_0082_hand`)
 OR EXISTS (SELECT `id`, `user_id`, `entry_id`, `entry_source`, `play_session_id`, `type`, `schema_version`, `occurred_at`, `sort_order`, `payload`, `created_at`, `updated_at`, `hand_id` FROM `__stage_0082_play_event` EXCEPT SELECT `id`, `user_id`, `entry_id`, `entry_source`, `play_session_id`, `type`, `schema_version`, `occurred_at`, `sort_order`, `payload`, `created_at`, `updated_at`, `hand_id` FROM `play_event`)
 OR (SELECT count(*) FROM `play_event`) <> (SELECT count(*) FROM `__stage_0082_play_event`);--> statement-breakpoint
INSERT INTO `__gate_0082` (`children_restored`) SELECT NULL WHERE 0
 OR EXISTS (SELECT `hand_id`, `user_id`, `board_no`, `cards` FROM `__stage_0082_hand_board` EXCEPT SELECT `hand_id`, `user_id`, `board_no`, `cards` FROM `hand_board`)
 OR (SELECT count(*) FROM `hand_board`) <> (SELECT count(*) FROM `__stage_0082_hand_board`)
 OR EXISTS (SELECT `hand_id`, `user_id`, `seat`, `player_id`, `is_hero`, `start_stack`, `hole_cards`, `net`, `showed` FROM `__stage_0082_hand_seat` EXCEPT SELECT `hand_id`, `user_id`, `seat`, `player_id`, `is_hero`, `start_stack`, `hole_cards`, `net`, `showed` FROM `hand_seat`)
 OR (SELECT count(*) FROM `hand_seat`) <> (SELECT count(*) FROM `__stage_0082_hand_seat`)
 OR EXISTS (SELECT `hand_id`, `user_id`, `seq`, `street`, `seat`, `action`, `amount`, `all_in` FROM `__stage_0082_hand_action` EXCEPT SELECT `hand_id`, `user_id`, `seq`, `street`, `seat`, `action`, `amount`, `all_in` FROM `hand_action`)
 OR (SELECT count(*) FROM `hand_action`) <> (SELECT count(*) FROM `__stage_0082_hand_action`)
 OR EXISTS (SELECT `user_id`, `hand_id`, `tag_id`, `reviewed_at` FROM `__stage_0082_hand_tag_link` EXCEPT SELECT `user_id`, `hand_id`, `tag_id`, `reviewed_at` FROM `hand_tag_link`)
 OR (SELECT count(*) FROM `hand_tag_link`) <> (SELECT count(*) FROM `__stage_0082_hand_tag_link`);--> statement-breakpoint
INSERT INTO `__gate_0082` (`ledger_links_restored`) SELECT NULL WHERE EXISTS (
 SELECT `id`, `play_session_id`, `source_event_id` FROM `__stage_0082_ledger_line`
 EXCEPT SELECT `id`, `play_session_id`, `source_event_id` FROM `ledger_line` WHERE `play_session_id` IS NOT NULL OR `source_event_id` IS NOT NULL
) OR (SELECT count(*) FROM `ledger_line` WHERE `play_session_id` IS NOT NULL OR `source_event_id` IS NOT NULL) <> (SELECT count(*) FROM `__stage_0082_ledger_line`);--> statement-breakpoint
INSERT INTO `__gate_0082` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check);--> statement-breakpoint
DROP TABLE `__stage_0082_play_session`;--> statement-breakpoint
DROP TABLE `__stage_0082_hand`;--> statement-breakpoint
DROP TABLE `__stage_0082_play_event`;--> statement-breakpoint
DROP TABLE `__stage_0082_hand_board`;--> statement-breakpoint
DROP TABLE `__stage_0082_hand_seat`;--> statement-breakpoint
DROP TABLE `__stage_0082_hand_action`;--> statement-breakpoint
DROP TABLE `__stage_0082_hand_tag_link`;--> statement-breakpoint
DROP TABLE `__stage_0082_ledger_line`;--> statement-breakpoint
DROP TABLE `__gate_0082`;
