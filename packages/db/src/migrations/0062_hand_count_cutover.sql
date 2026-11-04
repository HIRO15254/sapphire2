-- Data model v2, B10 (SA2-395): expand every legacy game_session.hand_count
-- into that many count hands on its seq-1 play_session (data-model-v2.md §9,
-- §16.5). Ids are `h:<play_session_id>:<n>`, hand_no runs from 1, played_at
-- is NULL and only the last hand carries the legacy dealer_seat as its
-- button. Released entries are single-day, so seq 1 receives every hand.
--
-- A non-positive or NULL hand_count creates no hand; a dealer_seat outside
-- 0-9 becomes a NULL button. The expansion stops at 5,000 hands per play
-- session: a larger hand_count is not truncated into success, because the
-- hands_match gate (A-10) then sees fewer hands than the source and fails.
--
-- Each gate inserts NULL into its own NOT NULL column of __gate_0062 when
-- violated, so a failure names the gate: hands_match is A-10,
-- foreign_keys_valid is PRAGMA foreign_key_check.
INSERT INTO `hand`
	(`id`, `user_id`, `play_session_id`, `hand_no`, `played_at`, `detail`, `button_seat`, `created_at`, `updated_at`)
WITH RECURSIVE `source` AS (
	SELECT `p`.`id` AS `play_session_id`, `p`.`user_id` AS `user_id`,
		min(`gs`.`hand_count`, 5000) AS `hands`,
		CASE WHEN `gs`.`dealer_seat` BETWEEN 0 AND 9 THEN `gs`.`dealer_seat` END AS `button_seat`
	FROM `game_session` AS `gs`
	JOIN `play_session` AS `p` ON `p`.`id` = `gs`.`id` AND `p`.`user_id` = `gs`.`user_id` AND `p`.`seq` = 1
	WHERE `gs`.`hand_count` > 0
), `expanded` (`play_session_id`, `user_id`, `hands`, `button_seat`, `hand_no`) AS (
	SELECT `play_session_id`, `user_id`, `hands`, `button_seat`, 1 FROM `source`
	UNION ALL
	SELECT `play_session_id`, `user_id`, `hands`, `button_seat`, `hand_no` + 1
	FROM `expanded` WHERE `hand_no` + 1 <= `hands`
)
SELECT 'h:' || `play_session_id` || ':' || `hand_no`, `user_id`, `play_session_id`, `hand_no`, NULL, 'count',
	CASE WHEN `hand_no` = `hands` THEN `button_seat` END, unixepoch(), unixepoch()
FROM `expanded`;--> statement-breakpoint

CREATE TABLE `__gate_0062` (
	`hands_match` integer DEFAULT 1 NOT NULL,
	`foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
INSERT INTO `__gate_0062` (`hands_match`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `game_session` AS `gs`
	JOIN `play_session` AS `p` ON `p`.`id` = `gs`.`id` AND `p`.`user_id` = `gs`.`user_id` AND `p`.`seq` = 1
	WHERE (SELECT count(*) FROM `hand` AS `h` WHERE `h`.`play_session_id` = `p`.`id` AND `h`.`user_id` = `p`.`user_id`)
		<> (CASE WHEN `gs`.`hand_count` > 0 THEN `gs`.`hand_count` ELSE 0 END)
	OR (`gs`.`hand_count` > 0 AND (
		SELECT `h`.`button_seat` FROM `hand` AS `h`
		WHERE `h`.`play_session_id` = `p`.`id` AND `h`.`user_id` = `p`.`user_id`
		ORDER BY `h`.`hand_no` DESC LIMIT 1
	) IS NOT (CASE WHEN `gs`.`dealer_seat` BETWEEN 0 AND 9 THEN `gs`.`dealer_seat` END))
);--> statement-breakpoint
INSERT INTO `__gate_0062` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM pragma_foreign_key_check
);--> statement-breakpoint

DROP TABLE `__gate_0062`;
