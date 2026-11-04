-- Data model v2, B12 (SA2-397): ev_diff is projected while a live cash entry
-- is still open, so the settled-only bridge of 0061 ends here
-- (data-model-v2.md §12.3). An open live cash entry takes the projector's
-- value: its all_in terms added one at a time in (occurred_at, sort_order, id)
-- order, then rounded like Math.round; 0 without an all_in. A-6's open cash EV
-- comparison is the end gate.
WITH RECURSIVE `all_in` AS (
	SELECT `pe`.`entry_id`,
		row_number() OVER (PARTITION BY `pe`.`entry_id` ORDER BY `pe`.`occurred_at`, `pe`.`sort_order`, `pe`.`id`) AS `n`,
		count(*) OVER (PARTITION BY `pe`.`entry_id`) AS `events`,
		json_extract(`pe`.`payload`, '$.potSize') * (json_extract(`pe`.`payload`, '$.equity') / 100.0)
			- (CAST(json_extract(`pe`.`payload`, '$.potSize') AS REAL) / json_extract(`pe`.`payload`, '$.trials'))
				* json_extract(`pe`.`payload`, '$.wins') AS `ev`
	FROM `play_event` AS `pe`
	JOIN `entry` AS `e` ON `e`.`id` = `pe`.`entry_id` AND `e`.`user_id` = `pe`.`user_id`
	WHERE `pe`.`type` = 'all_in' AND `e`.`kind` = 'cash' AND `e`.`source` = 'live' AND `e`.`status` = 'open'
), `ev_sum` AS (
	SELECT `entry_id`, `n`, `events`, `ev` AS `total` FROM `all_in` WHERE `n` = 1
	UNION ALL
	SELECT `a`.`entry_id`, `a`.`n`, `a`.`events`, `s`.`total` + `a`.`ev`
	FROM `ev_sum` AS `s`
	JOIN `all_in` AS `a` ON `a`.`entry_id` = `s`.`entry_id` AND `a`.`n` = `s`.`n` + 1
)
UPDATE `entry_cash`
SET `ev_diff` = COALESCE((
	SELECT CAST(floor(`s`.`total` + 0.5) AS INTEGER)
	FROM `ev_sum` AS `s`
	WHERE `s`.`entry_id` = `entry_cash`.`entry_id` AND `s`.`n` = `s`.`events`
), 0)
WHERE `entry_id` IN (
	SELECT `e`.`id` FROM `entry` AS `e`
	WHERE `e`.`user_id` = `entry_cash`.`user_id` AND `e`.`kind` = 'cash'
		AND `e`.`source` = 'live' AND `e`.`status` = 'open'
);
