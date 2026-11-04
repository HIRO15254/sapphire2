-- Data model v2, B09 (SA2-394): move transaction_type into ledger_category and
-- every legacy money amount into ledger_line (data-model-v2.md §7, §16.5).
-- Nothing reads the ledger yet; the legacy tables stay as sources until B25.
--
-- Categories keep their ids. The reserved Session Result type is not a
-- category; types whose lower(trim(name)) repeat for one user merge into the
-- oldest (created_at, id) row, and every line uses that row's id.
--
-- A manual entry's lines come from its legacy amount columns, with ids
-- m:<entry_id>:<role>:<n>, one chip_purchase line per purchased unit in
-- (sort_order, id) order, dated at the day's start or noon UTC of its date.
-- A live entry's lines fold its v1 events as projectEntry does, with ids
-- <event_id>:<n>: every cash session_start pays its buy-in, the entry's first
-- tournament session_start pays buy-in and fee (the session's own values,
-- else its tournament's), chips_add_remove is an addon or a chip_remove,
-- purchase_chips pays its cost, and only the closing session_end of the day
-- receives cash_out or a parseable tournament result's prize and bounty.
-- Zero amounts write no line. Every line pays in the entry's asset; an entry
-- with lines and no asset gets the user's ordinary Unassigned asset
-- (unassigned:<user_id>), and an entry without lines keeps no asset.
-- A currency_transaction without a session becomes the same-id adjustment
-- line; a zero amount moves nothing, and a row typed Session Result keeps its
-- amount with no category. Session-linked rows are the old per-session
-- result, which the entry lines replace.
--
-- Each gate inserts NULL into its own NOT NULL column of __gate_0062 when
-- violated: categories_match, wallet_lines_match, line_assets_match,
-- profit_loss_matches (A-5) and foreign_keys_valid.
CREATE TABLE `__stage_0062_category` AS
SELECT `t`.`id`, `t`.`user_id`,
	CASE WHEN lower(trim(`t`.`name`)) <> 'session result' THEN first_value(`t`.`id`) OVER (
		PARTITION BY `t`.`user_id`, lower(trim(`t`.`name`)) ORDER BY `t`.`created_at`, `t`.`id`
	) END AS `category_id`
FROM `transaction_type` AS `t`;--> statement-breakpoint

INSERT INTO `ledger_category` (`id`, `user_id`, `created_at`, `updated_at`, `name`)
SELECT `t`.`id`, `t`.`user_id`, `t`.`created_at`, `t`.`updated_at`, `t`.`name`
FROM `transaction_type` AS `t`
JOIN `__stage_0062_category` AS `c` ON `c`.`id` = `t`.`id`
WHERE `c`.`category_id` = `t`.`id`;--> statement-breakpoint

CREATE TABLE `__stage_0062_line` (
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`play_session_id` text NOT NULL,
	`source_event_id` text,
	`role` text NOT NULL,
	`amount` integer,
	`occurred_at` integer NOT NULL
);--> statement-breakpoint

INSERT INTO `__stage_0062_line` (
	`id`, `user_id`, `entry_id`, `play_session_id`, `role`, `amount`, `occurred_at`
) SELECT 'm:' || `e`.`id` || ':' || `r`.`column1` || ':0', `e`.`user_id`, `e`.`id`, `p`.`id`, `r`.`column1`,
	CASE `r`.`column1` WHEN 'buy_in' THEN `scd`.`buy_in` WHEN 'chip_remove' THEN `scd`.`chip_remove_total` ELSE `scd`.`cash_out` END,
	COALESCE(`p`.`started_at`, CAST(strftime('%s', `p`.`local_date` || ' 12:00:00') AS INTEGER))
FROM `entry` AS `e`
JOIN `play_session` AS `p` ON `p`.`entry_id` = `e`.`id` AND `p`.`user_id` = `e`.`user_id` AND `p`.`seq` = 1
JOIN `session_cash_detail` AS `scd` ON `scd`.`session_id` = `e`.`id`
CROSS JOIN (VALUES ('buy_in'), ('chip_remove'), ('cash_out')) AS `r`
WHERE `e`.`source` = 'manual' AND `e`.`kind` = 'cash';--> statement-breakpoint

INSERT INTO `__stage_0062_line` (
	`id`, `user_id`, `entry_id`, `play_session_id`, `role`, `amount`, `occurred_at`
) SELECT 'm:' || `e`.`id` || ':' || `r`.`column1` || ':0', `e`.`user_id`, `e`.`id`, `p`.`id`, `r`.`column1`,
	CASE `r`.`column1` WHEN 'buy_in' THEN `std`.`tournament_buy_in` WHEN 'fee' THEN `std`.`entry_fee`
		WHEN 'prize' THEN `std`.`prize_money` ELSE `std`.`bounty_prizes` END,
	COALESCE(`p`.`started_at`, CAST(strftime('%s', `p`.`local_date` || ' 12:00:00') AS INTEGER))
FROM `entry` AS `e`
JOIN `play_session` AS `p` ON `p`.`entry_id` = `e`.`id` AND `p`.`user_id` = `e`.`user_id` AND `p`.`seq` = 1
JOIN `session_tournament_detail` AS `std` ON `std`.`session_id` = `e`.`id`
CROSS JOIN (VALUES ('buy_in'), ('fee'), ('prize'), ('bounty')) AS `r`
WHERE `e`.`source` = 'manual' AND `e`.`kind` = 'tournament';--> statement-breakpoint

WITH RECURSIVE `purchase` AS (
	SELECT `cp`.`session_id`, `cp`.`cost`, `r`.`count`,
		COALESCE(sum(`r`.`count`) OVER (
			PARTITION BY `cp`.`session_id` ORDER BY `cp`.`sort_order`, `cp`.`id`
			ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
		), 0) AS `first_n`
	FROM `session_chip_purchase` AS `cp`
	JOIN `session_chip_purchase_result` AS `r` ON `r`.`session_chip_purchase_id` = `cp`.`id`
	WHERE `cp`.`cost` > 0 AND `r`.`count` > 0
), `purchase_unit` (`session_id`, `cost`, `n`, `last_n`) AS (
	SELECT `session_id`, `cost`, `first_n`, `first_n` + `count` - 1 FROM `purchase`
	UNION ALL
	SELECT `session_id`, `cost`, `n` + 1, `last_n` FROM `purchase_unit` WHERE `n` < `last_n`
)
INSERT INTO `__stage_0062_line` (
	`id`, `user_id`, `entry_id`, `play_session_id`, `role`, `amount`, `occurred_at`
) SELECT 'm:' || `e`.`id` || ':chip_purchase:' || `u`.`n`, `e`.`user_id`, `e`.`id`, `p`.`id`, 'chip_purchase', `u`.`cost`,
	COALESCE(`p`.`started_at`, CAST(strftime('%s', `p`.`local_date` || ' 12:00:00') AS INTEGER))
FROM `entry` AS `e`
JOIN `play_session` AS `p` ON `p`.`entry_id` = `e`.`id` AND `p`.`user_id` = `e`.`user_id` AND `p`.`seq` = 1
JOIN `purchase_unit` AS `u` ON `u`.`session_id` = `e`.`id`
WHERE `e`.`source` = 'manual' AND `e`.`kind` = 'tournament';--> statement-breakpoint

CREATE TABLE `__stage_0062_event` AS
WITH `event` AS (
	SELECT `pe`.`id`, `pe`.`user_id`, `pe`.`entry_id`, `pe`.`play_session_id`, `pe`.`type`, `pe`.`occurred_at`,
		CASE WHEN json_valid(`pe`.`payload`) THEN `pe`.`payload` ELSE '{}' END AS `payload`,
		row_number() OVER (
			PARTITION BY `pe`.`play_session_id` ORDER BY `pe`.`occurred_at`, `pe`.`sort_order`, `pe`.`id`
		) AS `n`
	FROM `play_event` AS `pe`
	WHERE `pe`.`schema_version` = 1
), `lifecycle` AS (
	SELECT `id`, `type`,
		row_number() OVER (PARTITION BY `play_session_id` ORDER BY `n` DESC) AS `from_last`
	FROM `event`
	WHERE `type` IN ('session_start', 'session_pause', 'session_resume', 'session_end', 'day_end')
), `entry_start` AS (
	SELECT `ev`.`id`,
		row_number() OVER (PARTITION BY `ev`.`entry_id` ORDER BY `ev`.`n`) AS `k`
	FROM `event` AS `ev`
	JOIN `play_session` AS `p` ON `p`.`id` = `ev`.`play_session_id` AND `p`.`user_id` = `ev`.`user_id`
	WHERE `ev`.`type` = 'session_start'
		AND `p`.`seq` = (SELECT min(`q`.`seq`) FROM `play_session` AS `q` WHERE `q`.`entry_id` = `p`.`entry_id` AND `q`.`user_id` = `p`.`user_id`)
)
SELECT `ev`.`id`, `ev`.`user_id`, `ev`.`entry_id`, `ev`.`play_session_id`, `ev`.`type`, `ev`.`occurred_at`,
	`e`.`kind`, `ev`.`payload`,
	`c`.`id` IS NOT NULL AS `is_closing`,
	`s`.`id` IS NOT NULL AS `is_entry_start`,
	COALESCE(`std`.`tournament_buy_in`, `t`.`buy_in`) AS `tournament_buy_in`,
	COALESCE(`std`.`entry_fee`, `t`.`entry_fee`) AS `tournament_fee`,
	json_type(`ev`.`payload`, '$.prizeMoney') = 'integer' AND json_extract(`ev`.`payload`, '$.prizeMoney') >= 0
		AND json_type(`ev`.`payload`, '$.bountyPrizes') = 'integer' AND json_extract(`ev`.`payload`, '$.bountyPrizes') >= 0
		AND (json_type(`ev`.`payload`, '$.beforeDeadline') = 'true' OR (
			json_type(`ev`.`payload`, '$.beforeDeadline') = 'false'
			AND json_type(`ev`.`payload`, '$.placement') = 'integer' AND json_type(`ev`.`payload`, '$.totalEntries') = 'integer'
			AND json_extract(`ev`.`payload`, '$.placement') >= 1
			AND json_extract(`ev`.`payload`, '$.placement') <= json_extract(`ev`.`payload`, '$.totalEntries')
		)) AS `is_tournament_result`
FROM `event` AS `ev`
JOIN `entry` AS `e` ON `e`.`id` = `ev`.`entry_id` AND `e`.`user_id` = `ev`.`user_id`
LEFT JOIN `lifecycle` AS `c` ON `c`.`id` = `ev`.`id` AND `c`.`from_last` = 1 AND `c`.`type` = 'session_end'
LEFT JOIN `entry_start` AS `s` ON `s`.`id` = `ev`.`id` AND `s`.`k` = 1
LEFT JOIN `entry_tournament` AS `et` ON `et`.`entry_id` = `e`.`id` AND `et`.`user_id` = `e`.`user_id`
LEFT JOIN `session_tournament_detail` AS `std` ON `std`.`session_id` = `e`.`id`
LEFT JOIN `tournament` AS `t` ON `t`.`id` = `et`.`tournament_id` AND `t`.`user_id` = `e`.`user_id`
WHERE `e`.`source` = 'live';--> statement-breakpoint

INSERT INTO `__stage_0062_line` (
	`id`, `user_id`, `entry_id`, `play_session_id`, `source_event_id`, `role`, `amount`, `occurred_at`
) SELECT `ev`.`id` || ':' || `pay`.`n`, `ev`.`user_id`, `ev`.`entry_id`, `ev`.`play_session_id`, `ev`.`id`,
	`pay`.`role`, `pay`.`amount`, `ev`.`occurred_at`
FROM (
	SELECT `id`, 0 AS `n`, 'buy_in' AS `role`, json_extract(`payload`, '$.buyInAmount') AS `amount`
	FROM `__stage_0062_event`
	WHERE `type` = 'session_start' AND `kind` = 'cash' AND json_type(`payload`, '$.buyInAmount') = 'integer'
	UNION ALL
	SELECT `id`, 0, 'buy_in', `tournament_buy_in` FROM `__stage_0062_event`
	WHERE `type` = 'session_start' AND `kind` = 'tournament' AND `is_entry_start`
	UNION ALL
	SELECT `id`, CASE WHEN `tournament_buy_in` > 0 THEN 1 ELSE 0 END, 'fee', `tournament_fee` FROM `__stage_0062_event`
	WHERE `type` = 'session_start' AND `kind` = 'tournament' AND `is_entry_start`
	UNION ALL
	SELECT `id`, 0, CASE WHEN json_extract(`payload`, '$.amount') > 0 THEN 'addon' ELSE 'chip_remove' END,
		abs(json_extract(`payload`, '$.amount'))
	FROM `__stage_0062_event`
	WHERE `type` = 'chips_add_remove' AND json_type(`payload`, '$.amount') = 'integer'
) AS `pay`
JOIN `__stage_0062_event` AS `ev` ON `ev`.`id` = `pay`.`id`;--> statement-breakpoint

INSERT INTO `__stage_0062_line` (
	`id`, `user_id`, `entry_id`, `play_session_id`, `source_event_id`, `role`, `amount`, `occurred_at`
) SELECT `ev`.`id` || ':' || `pay`.`n`, `ev`.`user_id`, `ev`.`entry_id`, `ev`.`play_session_id`, `ev`.`id`,
	`pay`.`role`, `pay`.`amount`, `ev`.`occurred_at`
FROM (
	SELECT `id`, 0 AS `n`, 'chip_purchase' AS `role`, json_extract(`payload`, '$.cost') AS `amount`
	FROM `__stage_0062_event`
	WHERE `type` = 'purchase_chips' AND json_type(`payload`, '$.cost') = 'integer'
	UNION ALL
	SELECT `id`, 0, 'cash_out', json_extract(`payload`, '$.cashOutAmount') FROM `__stage_0062_event`
	WHERE `type` = 'session_end' AND `kind` = 'cash' AND `is_closing`
		AND json_type(`payload`, '$.cashOutAmount') = 'integer'
	UNION ALL
	SELECT `id`, 0, 'prize', json_extract(`payload`, '$.prizeMoney') FROM `__stage_0062_event`
	WHERE `type` = 'session_end' AND `kind` = 'tournament' AND `is_closing` AND `is_tournament_result`
	UNION ALL
	SELECT `id`, CASE WHEN json_extract(`payload`, '$.prizeMoney') > 0 THEN 1 ELSE 0 END, 'bounty',
		json_extract(`payload`, '$.bountyPrizes')
	FROM `__stage_0062_event`
	WHERE `type` = 'session_end' AND `kind` = 'tournament' AND `is_closing` AND `is_tournament_result`
) AS `pay`
JOIN `__stage_0062_event` AS `ev` ON `ev`.`id` = `pay`.`id`;--> statement-breakpoint

DELETE FROM `__stage_0062_line` WHERE `amount` IS NULL OR `amount` NOT BETWEEN 1 AND 1000000000000;--> statement-breakpoint

INSERT INTO `asset` (`id`, `user_id`, `name`, `kind`, `decimals`, `created_at`, `updated_at`)
SELECT 'unassigned:' || `u`.`user_id`, `u`.`user_id`,
	CASE WHEN EXISTS (
		SELECT 1 FROM `asset` AS `a` WHERE `a`.`user_id` = `u`.`user_id` AND lower(trim(`a`.`name`)) = 'unassigned'
	) THEN 'Unassigned (migrated)' ELSE 'Unassigned' END,
	'currency', 0, unixepoch(), unixepoch()
FROM (
	SELECT DISTINCT `l`.`user_id` FROM `__stage_0062_line` AS `l`
	JOIN `entry` AS `e` ON `e`.`id` = `l`.`entry_id` AND `e`.`user_id` = `l`.`user_id`
	WHERE `e`.`asset_id` IS NULL
) AS `u`;--> statement-breakpoint

UPDATE `entry` SET `asset_id` = 'unassigned:' || `user_id`
WHERE `asset_id` IS NULL AND EXISTS (
	SELECT 1 FROM `__stage_0062_line` AS `l` WHERE `l`.`entry_id` = `entry`.`id` AND `l`.`user_id` = `entry`.`user_id`
);--> statement-breakpoint

INSERT INTO `ledger_line` (
	`id`, `user_id`, `created_at`, `updated_at`, `asset_id`, `quantity`, `role`, `effect`,
	`entry_id`, `play_session_id`, `source_event_id`, `occurred_at`
) SELECT `l`.`id`, `l`.`user_id`, unixepoch(), unixepoch(), `e`.`asset_id`,
	CASE WHEN `l`.`role` IN ('buy_in', 'fee', 'chip_purchase', 'addon') THEN -`l`.`amount` ELSE `l`.`amount` END,
	`l`.`role`, 'real',
	`l`.`entry_id`, `l`.`play_session_id`, `l`.`source_event_id`, `l`.`occurred_at`
FROM `__stage_0062_line` AS `l`
JOIN `entry` AS `e` ON `e`.`id` = `l`.`entry_id` AND `e`.`user_id` = `l`.`user_id`;--> statement-breakpoint

INSERT INTO `ledger_line` (
	`id`, `user_id`, `created_at`, `updated_at`, `asset_id`, `quantity`, `role`, `effect`,
	`category_id`, `occurred_at`, `memo`
) SELECT `ct`.`id`, `a`.`user_id`, `ct`.`created_at`, `ct`.`created_at`, `a`.`id`, `ct`.`amount`, 'adjustment', 'real',
	`c`.`category_id`, `ct`.`transacted_at`, `ct`.`memo`
FROM `currency_transaction` AS `ct`
JOIN `asset` AS `a` ON `a`.`id` = `ct`.`currency_id`
LEFT JOIN `__stage_0062_category` AS `c` ON `c`.`id` = `ct`.`transaction_type_id` AND `c`.`user_id` = `a`.`user_id`
WHERE `ct`.`session_id` IS NULL AND `ct`.`amount` <> 0 AND abs(`ct`.`amount`) <= 1000000000000;--> statement-breakpoint

CREATE TABLE `__gate_0062` (
	`categories_match` integer DEFAULT 1 NOT NULL,
	`wallet_lines_match` integer DEFAULT 1 NOT NULL,
	`line_assets_match` integer DEFAULT 1 NOT NULL,
	`profit_loss_matches` integer DEFAULT 1 NOT NULL,
	`foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
INSERT INTO `__gate_0062` (`categories_match`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `transaction_type` AS `t`
	LEFT JOIN `ledger_category` AS `c`
		ON `c`.`user_id` = `t`.`user_id` AND lower(trim(`c`.`name`)) = lower(trim(`t`.`name`))
	WHERE lower(trim(`t`.`name`)) <> 'session result'
		AND (`c`.`id` IS NULL OR `c`.`id` <> (
			SELECT `o`.`id` FROM `transaction_type` AS `o`
			WHERE `o`.`user_id` = `t`.`user_id` AND lower(trim(`o`.`name`)) = lower(trim(`t`.`name`))
			ORDER BY `o`.`created_at`, `o`.`id` LIMIT 1
		))
) OR EXISTS (
	SELECT 1 FROM `ledger_category` AS `c`
	WHERE lower(trim(`c`.`name`)) = 'session result' OR NOT EXISTS (
		SELECT 1 FROM `transaction_type` AS `t`
		WHERE `t`.`id` = `c`.`id` AND `t`.`user_id` = `c`.`user_id` AND `t`.`name` = `c`.`name`
	)
);--> statement-breakpoint
INSERT INTO `__gate_0062` (`wallet_lines_match`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `currency_transaction` AS `ct`
	JOIN `asset` AS `a` ON `a`.`id` = `ct`.`currency_id`
	JOIN `transaction_type` AS `t` ON `t`.`id` = `ct`.`transaction_type_id`
	LEFT JOIN `ledger_line` AS `l` ON `l`.`id` = `ct`.`id`
	WHERE `ct`.`session_id` IS NULL AND `ct`.`amount` <> 0 AND (
		`l`.`id` IS NULL OR `l`.`user_id` IS NOT `a`.`user_id` OR `l`.`asset_id` IS NOT `a`.`id`
		OR `l`.`quantity` IS NOT `ct`.`amount` OR `l`.`role` IS NOT 'adjustment' OR `l`.`effect` IS NOT 'real'
		OR `l`.`occurred_at` IS NOT `ct`.`transacted_at` OR `l`.`memo` IS NOT `ct`.`memo`
		OR `l`.`category_id` IS NOT (
			SELECT `o`.`id` FROM `transaction_type` AS `o`
			WHERE `o`.`user_id` = `a`.`user_id` AND `t`.`user_id` = `a`.`user_id`
				AND lower(trim(`t`.`name`)) <> 'session result'
				AND lower(trim(`o`.`name`)) = lower(trim(`t`.`name`))
			ORDER BY `o`.`created_at`, `o`.`id` LIMIT 1
		)
	)
) OR (SELECT count(*) FROM `ledger_line` WHERE `entry_id` IS NULL) <> (
	SELECT count(*) FROM `currency_transaction` WHERE `session_id` IS NULL AND `amount` <> 0
);--> statement-breakpoint
INSERT INTO `__gate_0062` (`line_assets_match`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `ledger_line` AS `l`
	JOIN `entry` AS `e` ON `e`.`id` = `l`.`entry_id` AND `e`.`user_id` = `l`.`user_id`
	WHERE `l`.`asset_id` IS NOT `e`.`asset_id`
) OR EXISTS (
	SELECT 1 FROM `asset` AS `a`
	WHERE `a`.`id` = 'unassigned:' || `a`.`user_id` AND NOT EXISTS (
		SELECT 1 FROM `ledger_line` AS `l` WHERE `l`.`asset_id` = `a`.`id` AND `l`.`user_id` = `a`.`user_id`
	)
) OR (SELECT count(*) FROM `ledger_line` WHERE `entry_id` IS NOT NULL) <> (SELECT count(*) FROM `__stage_0062_line`);--> statement-breakpoint
INSERT INTO `__gate_0062` (`profit_loss_matches`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `game_session` AS `gs`
	JOIN `entry` AS `e` ON `e`.`id` = `gs`.`id` AND `e`.`user_id` = `gs`.`user_id`
	LEFT JOIN `session_cash_detail` AS `scd` ON `scd`.`session_id` = `gs`.`id`
	LEFT JOIN `session_tournament_detail` AS `std` ON `std`.`session_id` = `gs`.`id`
	WHERE `e`.`status` = 'settled' AND (
		SELECT COALESCE(sum(`l`.`quantity`), 0) FROM `ledger_line` AS `l`
		WHERE `l`.`entry_id` = `e`.`id` AND `l`.`user_id` = `e`.`user_id` AND `l`.`effect` = 'real'
	) <> CASE `gs`.`kind` WHEN 'cash_game'
		THEN COALESCE(`scd`.`cash_out`, 0) + COALESCE(`scd`.`chip_remove_total`, 0) - COALESCE(`scd`.`buy_in`, 0)
		ELSE COALESCE(`std`.`prize_money`, 0) + COALESCE(`std`.`bounty_prizes`, 0)
			- COALESCE(`std`.`tournament_buy_in`, 0) - COALESCE(`std`.`entry_fee`, 0)
			- COALESCE((
				SELECT sum(`cp`.`cost` * COALESCE(`r`.`count`, 0)) FROM `session_chip_purchase` AS `cp`
				LEFT JOIN `session_chip_purchase_result` AS `r` ON `r`.`session_chip_purchase_id` = `cp`.`id`
				WHERE `cp`.`session_id` = `gs`.`id`
			), 0)
		END
);--> statement-breakpoint
INSERT INTO `__gate_0062` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM pragma_foreign_key_check
);--> statement-breakpoint

DROP TABLE `__stage_0062_category`;--> statement-breakpoint
DROP TABLE `__stage_0062_line`;--> statement-breakpoint
DROP TABLE `__stage_0062_event`;--> statement-breakpoint
DROP TABLE `__gate_0062`;
