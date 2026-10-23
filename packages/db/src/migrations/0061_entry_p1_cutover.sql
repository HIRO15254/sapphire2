-- Data model v2, B06 (SA2-391): move every game_session, its kind detail and
-- its session_event rows into entry, entry_cash / entry_tournament, the seq-1
-- play_session and play_event, keeping their ids (data-model-v2.md §16.5).
-- The legacy tables stay as migration sources until B25.
--
-- Normalization never aborts on legacy dirt: owner-mismatched room, asset and
-- master links become NULL; an entry without an owned master keeps its rule
-- name as title; a session with events is live; live dates are the JST date
-- of started_at; invalid placement / total_entries become NULL;
-- before_deadline is 0/1; ended_at before started_at becomes NULL; a
-- negative break becomes 0; a negative cash end_stack becomes NULL; settled
-- cash ev_diff is rounded like Math.round; malformed payloads become '{}'.
--
-- Each gate inserts NULL into its own NOT NULL column of __gate_0061 when
-- violated, so a failure names the gate: ids_match is A-3, seq1_matches is
-- A-4, foreign_keys_valid is PRAGMA foreign_key_check.
CREATE TABLE `__stage_0061_source` AS
SELECT `gs`.`id`, `gs`.`user_id`,
	CASE WHEN `gs`.`source` = 'live' OR EXISTS (
		SELECT 1 FROM `session_event` AS `se` WHERE `se`.`session_id` = `gs`.`id`
	) THEN 'live' ELSE `gs`.`source` END AS `source`
FROM `game_session` AS `gs`;--> statement-breakpoint

INSERT INTO `entry` (
	`id`, `user_id`, `kind`, `source`, `status`, `room_id`, `asset_id`, `title`,
	`played_on`, `memo`, `created_at`, `updated_at`
) SELECT
	`gs`.`id`, `gs`.`user_id`,
	CASE `gs`.`kind` WHEN 'cash_game' THEN 'cash' ELSE 'tournament' END,
	`s`.`source`,
	CASE `gs`.`status` WHEN 'completed' THEN 'settled' ELSE 'open' END,
	`r`.`id`, `a`.`id`,
	CASE WHEN `rg`.`id` IS NULL AND `t`.`id` IS NULL
		THEN COALESCE(`scd`.`rule_name`, `std`.`rule_name`) END,
	CASE `s`.`source`
		WHEN 'live' THEN strftime('%Y-%m-%d', COALESCE(`gs`.`started_at`, `gs`.`session_date`), 'unixepoch', '+9 hours')
		ELSE strftime('%Y-%m-%d', `gs`.`session_date`, 'unixepoch') END,
	`gs`.`memo`, `gs`.`created_at`, `gs`.`updated_at`
FROM `game_session` AS `gs`
JOIN `__stage_0061_source` AS `s` ON `s`.`id` = `gs`.`id`
LEFT JOIN `room` AS `r` ON `r`.`id` = `gs`.`room_id` AND `r`.`user_id` = `gs`.`user_id`
LEFT JOIN `asset` AS `a` ON `a`.`id` = `gs`.`currency_id` AND `a`.`user_id` = `gs`.`user_id`
LEFT JOIN `session_cash_detail` AS `scd` ON `scd`.`session_id` = `gs`.`id`
LEFT JOIN `ring_game` AS `rg` ON `rg`.`id` = `scd`.`ring_game_id` AND `rg`.`user_id` = `gs`.`user_id`
LEFT JOIN `session_tournament_detail` AS `std` ON `std`.`session_id` = `gs`.`id`
LEFT JOIN `tournament` AS `t` ON `t`.`id` = `std`.`tournament_id` AND `t`.`user_id` = `gs`.`user_id`;--> statement-breakpoint

INSERT INTO `entry_cash` (`entry_id`, `user_id`, `kind`, `ring_game_id`, `ev_diff`)
SELECT `e`.`id`, `e`.`user_id`, 'cash', `rg`.`id`,
	CASE WHEN `e`.`status` = 'settled' AND `scd`.`ev_cash_out` IS NOT NULL
		THEN CAST(floor(`scd`.`ev_cash_out` - `scd`.`cash_out` + 0.5) AS INTEGER) END
FROM `entry` AS `e`
LEFT JOIN `session_cash_detail` AS `scd` ON `scd`.`session_id` = `e`.`id`
LEFT JOIN `ring_game` AS `rg` ON `rg`.`id` = `scd`.`ring_game_id` AND `rg`.`user_id` = `e`.`user_id`
WHERE `e`.`kind` = 'cash';--> statement-breakpoint

INSERT INTO `entry_tournament` (
	`entry_id`, `user_id`, `kind`, `tournament_id`, `placement`, `total_entries`, `before_deadline`
) SELECT `e`.`id`, `e`.`user_id`, 'tournament', `t`.`id`,
	CASE WHEN `std`.`before_deadline` = 1 THEN NULL
		WHEN `std`.`placement` >= 1
			AND (`std`.`total_entries` IS NULL OR `std`.`total_entries` < 1 OR `std`.`placement` <= `std`.`total_entries`)
		THEN `std`.`placement` END,
	CASE WHEN `std`.`total_entries` >= 1 THEN `std`.`total_entries` END,
	CASE WHEN `std`.`before_deadline` = 1 THEN 1 ELSE 0 END
FROM `entry` AS `e`
LEFT JOIN `session_tournament_detail` AS `std` ON `std`.`session_id` = `e`.`id`
LEFT JOIN `tournament` AS `t` ON `t`.`id` = `std`.`tournament_id` AND `t`.`user_id` = `e`.`user_id`
WHERE `e`.`kind` = 'tournament';--> statement-breakpoint

INSERT INTO `play_session` (
	`id`, `user_id`, `entry_id`, `kind`, `seq`, `local_date`, `started_at`, `ended_at`,
	`break_minutes`, `status`, `end_state`, `end_stack`, `clock_started_at`, `created_at`, `updated_at`
) SELECT `gs`.`id`, `gs`.`user_id`, `e`.`id`, `e`.`kind`, 1, `e`.`played_on`, `gs`.`started_at`,
	CASE WHEN `gs`.`ended_at` >= `gs`.`started_at` OR `gs`.`started_at` IS NULL THEN `gs`.`ended_at` END,
	CASE WHEN `gs`.`break_minutes` >= 0 THEN `gs`.`break_minutes` ELSE 0 END,
	CASE `gs`.`status` WHEN 'completed' THEN 'ended' WHEN 'paused' THEN 'paused' ELSE 'active' END,
	CASE WHEN `gs`.`status` <> 'completed' THEN NULL
		WHEN `e`.`kind` = 'cash' THEN 'cashed_out'
		WHEN `et`.`placement` = 1 THEN 'finished'
		WHEN `e`.`source` = 'live' OR `et`.`placement` > 1 THEN 'busted'
		ELSE 'finished' END,
	CASE WHEN `e`.`kind` = 'cash' AND `gs`.`status` = 'completed' AND `scd`.`cash_out` >= 0
		THEN `scd`.`cash_out` END,
	`std`.`timer_started_at`, `gs`.`created_at`, `gs`.`updated_at`
FROM `game_session` AS `gs`
JOIN `entry` AS `e` ON `e`.`id` = `gs`.`id` AND `e`.`user_id` = `gs`.`user_id`
LEFT JOIN `entry_tournament` AS `et` ON `et`.`entry_id` = `e`.`id` AND `et`.`user_id` = `e`.`user_id`
LEFT JOIN `session_cash_detail` AS `scd` ON `scd`.`session_id` = `gs`.`id`
LEFT JOIN `session_tournament_detail` AS `std` ON `std`.`session_id` = `gs`.`id`;--> statement-breakpoint

INSERT INTO `play_event` (
	`id`, `user_id`, `entry_id`, `entry_source`, `play_session_id`, `type`, `schema_version`,
	`occurred_at`, `sort_order`, `payload`, `created_at`, `updated_at`
) SELECT `se`.`id`, `e`.`user_id`, `e`.`id`, `e`.`source`, `e`.`id`, `se`.`event_type`, 1,
	`se`.`occurred_at`, `se`.`sort_order`,
	CASE WHEN json_valid(`se`.`payload`) THEN `se`.`payload` ELSE '{}' END,
	`se`.`created_at`, `se`.`updated_at`
FROM `session_event` AS `se`
JOIN `entry` AS `e` ON `e`.`id` = `se`.`session_id`;--> statement-breakpoint

CREATE TABLE `__gate_0061` (
	`ids_match` integer DEFAULT 1 NOT NULL,
	`seq1_matches` integer DEFAULT 1 NOT NULL,
	`foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
INSERT INTO `__gate_0061` (`ids_match`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `game_session` AS `gs`
	LEFT JOIN `entry` AS `e` ON `e`.`id` = `gs`.`id` AND `e`.`user_id` = `gs`.`user_id`
	LEFT JOIN `play_session` AS `p`
		ON `p`.`id` = `gs`.`id` AND `p`.`entry_id` = `gs`.`id` AND `p`.`user_id` = `gs`.`user_id` AND `p`.`seq` = 1
	WHERE `e`.`id` IS NULL OR `p`.`id` IS NULL
) OR EXISTS (
	SELECT 1 FROM `entry` AS `e`
	WHERE NOT EXISTS (SELECT 1 FROM `game_session` AS `gs` WHERE `gs`.`id` = `e`.`id` AND `gs`.`user_id` = `e`.`user_id`)
) OR EXISTS (
	SELECT 1 FROM `play_session` AS `p`
	WHERE NOT EXISTS (
		SELECT 1 FROM `game_session` AS `gs`
		WHERE `gs`.`id` = `p`.`id` AND `gs`.`id` = `p`.`entry_id` AND `gs`.`user_id` = `p`.`user_id` AND `p`.`seq` = 1
	)
) OR EXISTS (
	SELECT 1 FROM `session_event` AS `se`
	JOIN `game_session` AS `gs` ON `gs`.`id` = `se`.`session_id`
	WHERE NOT EXISTS (
		SELECT 1 FROM `play_event` AS `pe`
		WHERE `pe`.`id` = `se`.`id` AND `pe`.`entry_id` = `gs`.`id` AND `pe`.`play_session_id` = `gs`.`id` AND `pe`.`user_id` = `gs`.`user_id`
	)
) OR EXISTS (
	SELECT 1 FROM `play_event` AS `pe`
	WHERE NOT EXISTS (
		SELECT 1 FROM `session_event` AS `se` JOIN `game_session` AS `gs` ON `gs`.`id` = `se`.`session_id`
		WHERE `se`.`id` = `pe`.`id` AND `gs`.`id` = `pe`.`entry_id` AND `gs`.`user_id` = `pe`.`user_id`
	)
) OR EXISTS (
	SELECT 1 FROM `entry` AS `e` JOIN `__stage_0061_source` AS `s` ON `s`.`id` = `e`.`id`
	WHERE `e`.`source` IS NOT `s`.`source`
);--> statement-breakpoint
INSERT INTO `__gate_0061` (`seq1_matches`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `game_session` AS `gs`
	JOIN `play_session` AS `p` ON `p`.`id` = `gs`.`id` AND `p`.`user_id` = `gs`.`user_id` AND `p`.`seq` = 1
	WHERE `p`.`started_at` IS NOT `gs`.`started_at`
		OR `p`.`ended_at` IS NOT (CASE WHEN `gs`.`ended_at` >= `gs`.`started_at` OR `gs`.`started_at` IS NULL THEN `gs`.`ended_at` END)
		OR `p`.`break_minutes` IS NOT (CASE WHEN `gs`.`break_minutes` >= 0 THEN `gs`.`break_minutes` ELSE 0 END)
		OR `p`.`status` IS NOT (CASE `gs`.`status` WHEN 'completed' THEN 'ended' WHEN 'paused' THEN 'paused' ELSE 'active' END)
);--> statement-breakpoint
INSERT INTO `__gate_0061` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM pragma_foreign_key_check
);--> statement-breakpoint

DROP TABLE `__stage_0061_source`;--> statement-breakpoint
DROP TABLE `__gate_0061`;
