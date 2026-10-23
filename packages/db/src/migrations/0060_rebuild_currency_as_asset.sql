-- Data model v2, B02 (SA2-386): rebuild currency with the final asset
-- constraints, then rename it to asset (data-model-v2.md §16.2).
--
-- D1 keeps foreign keys on and DROP TABLE fires every inbound CASCADE /
-- SET NULL, so the legacy children are staged and detached first: every
-- currency_transaction row and the currency_id links of game_session,
-- ring_game and tournament. The v2 children (entry, asset_rate, ledger_line,
-- user_setting, tournament_rule_price) are not staged; the first gate aborts
-- unless they are empty.
-- The table is rebuilt under its old name and renamed last, so SQLite
-- repoints every child foreign key at asset.
--
-- Names are unique per user after lower(trim(name)). Within a duplicate
-- group the first row in (created_at, id) order keeps its name; the r-th
-- later row takes trim(name) || ' (k)' with the r-th smallest k >= 2 whose
-- normalized name no row of that user already has. ids and every other
-- column are kept.
--
-- Each gate inserts NULL into its own NOT NULL column of __gate_0060 when
-- violated, so a failure names the gate. The stages are dropped after the
-- gates pass.
CREATE TABLE `__gate_0060` (
	`v2_children_empty` integer DEFAULT 1 NOT NULL,
	`asset_rows_restored` integer DEFAULT 1 NOT NULL,
	`transactions_restored` integer DEFAULT 1 NOT NULL,
	`links_restored` integer DEFAULT 1 NOT NULL,
	`names_unique` integer DEFAULT 1 NOT NULL,
	`foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
INSERT INTO `__gate_0060` (`v2_children_empty`) SELECT NULL WHERE
	EXISTS (SELECT 1 FROM `entry`)
	OR EXISTS (SELECT 1 FROM `asset_rate`)
	OR EXISTS (SELECT 1 FROM `ledger_line`)
	OR EXISTS (SELECT 1 FROM `user_setting`)
	OR EXISTS (SELECT 1 FROM `tournament_rule_price`);--> statement-breakpoint

CREATE TABLE `__stage_0060_currency` AS SELECT * FROM `currency`;--> statement-breakpoint
CREATE TABLE `__stage_0060_currency_transaction` AS SELECT * FROM `currency_transaction`;--> statement-breakpoint
CREATE TABLE `__stage_0060_currency_link` AS
SELECT 'game_session' AS `child`, `id`, `currency_id` FROM `game_session` WHERE `currency_id` IS NOT NULL
UNION ALL
SELECT 'ring_game', `id`, `currency_id` FROM `ring_game` WHERE `currency_id` IS NOT NULL
UNION ALL
SELECT 'tournament', `id`, `currency_id` FROM `tournament` WHERE `currency_id` IS NOT NULL;--> statement-breakpoint

UPDATE `game_session` SET `currency_id` = NULL WHERE `currency_id` IS NOT NULL;--> statement-breakpoint
UPDATE `ring_game` SET `currency_id` = NULL WHERE `currency_id` IS NOT NULL;--> statement-breakpoint
UPDATE `tournament` SET `currency_id` = NULL WHERE `currency_id` IS NOT NULL;--> statement-breakpoint
DELETE FROM `currency_transaction`;--> statement-breakpoint
DROP TABLE `currency`;--> statement-breakpoint

CREATE TABLE `currency` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`unit` text,
	`description` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`kind` text DEFAULT 'currency' NOT NULL,
	`decimals` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "asset_is_favorite_check" CHECK("is_favorite" IN (0, 1)),
	CONSTRAINT "asset_kind_check" CHECK("kind" IN ('currency', 'item')),
	CONSTRAINT "asset_decimals_check" CHECK("decimals" BETWEEN 0 AND 4)
);--> statement-breakpoint
CREATE UNIQUE INDEX `asset_id_user_id_unique` ON `currency` (`id`,`user_id`);--> statement-breakpoint
WITH RECURSIVE
`ranked` AS (
	SELECT `s`.*, lower(trim(`s`.`name`)) AS `norm`,
		ROW_NUMBER() OVER (
			PARTITION BY `s`.`user_id`, lower(trim(`s`.`name`))
			ORDER BY `s`.`created_at`, `s`.`id`
		) AS `dup`,
		COUNT(*) OVER (PARTITION BY `s`.`user_id`) AS `owned`
	FROM `__stage_0060_currency` AS `s`
),
`n`(`k`) AS (
	SELECT 2
	UNION ALL
	SELECT `k` + 1 FROM `n` WHERE `k` <= (SELECT COUNT(*) FROM `__stage_0060_currency`)
),
`free` AS (
	SELECT `g`.`user_id`, `g`.`norm`, `n`.`k`,
		ROW_NUMBER() OVER (PARTITION BY `g`.`user_id`, `g`.`norm` ORDER BY `n`.`k`) + 1 AS `dup`
	FROM (SELECT DISTINCT `user_id`, `norm`, `owned` FROM `ranked` WHERE `dup` > 1) AS `g`
	JOIN `n` ON `n`.`k` <= `g`.`owned` + 1
	WHERE NOT EXISTS (
		SELECT 1 FROM `__stage_0060_currency` AS `e`
		WHERE `e`.`user_id` = `g`.`user_id`
			AND lower(trim(`e`.`name`)) = lower(trim(`g`.`norm` || ' (' || `n`.`k` || ')'))
	)
)
INSERT INTO `currency` (
	`id`, `user_id`, `name`, `unit`, `description`, `is_favorite`, `kind`,
	`decimals`, `archived_at`, `created_at`, `updated_at`
) SELECT
	`r`.`id`, `r`.`user_id`,
	CASE WHEN `r`.`dup` = 1 THEN `r`.`name` ELSE trim(`r`.`name`) || ' (' || `f`.`k` || ')' END,
	`r`.`unit`, `r`.`description`, `r`.`is_favorite` <> 0, `r`.`kind`,
	`r`.`decimals`, `r`.`archived_at`, `r`.`created_at`, `r`.`updated_at`
FROM `ranked` AS `r`
LEFT JOIN `free` AS `f`
	ON `f`.`user_id` = `r`.`user_id` AND `f`.`norm` = `r`.`norm` AND `f`.`dup` = `r`.`dup`;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_name_uq` ON `currency` (`user_id`,lower(trim("name")));--> statement-breakpoint
CREATE INDEX `asset_user_kind_idx` ON `currency` (`user_id`,`kind`);--> statement-breakpoint

INSERT INTO `currency_transaction` (
	`id`, `currency_id`, `transaction_type_id`, `session_id`, `amount`,
	`transacted_at`, `memo`, `created_at`
) SELECT
	`id`, `currency_id`, `transaction_type_id`, `session_id`, `amount`,
	`transacted_at`, `memo`, `created_at`
FROM `__stage_0060_currency_transaction`;--> statement-breakpoint
UPDATE `game_session` SET `currency_id` = (
	SELECT `l`.`currency_id` FROM `__stage_0060_currency_link` AS `l`
	WHERE `l`.`child` = 'game_session' AND `l`.`id` = `game_session`.`id`
)
WHERE `id` IN (
	SELECT `id` FROM `__stage_0060_currency_link` WHERE `child` = 'game_session'
);--> statement-breakpoint
UPDATE `ring_game` SET `currency_id` = (
	SELECT `l`.`currency_id` FROM `__stage_0060_currency_link` AS `l`
	WHERE `l`.`child` = 'ring_game' AND `l`.`id` = `ring_game`.`id`
)
WHERE `id` IN (
	SELECT `id` FROM `__stage_0060_currency_link` WHERE `child` = 'ring_game'
);--> statement-breakpoint
UPDATE `tournament` SET `currency_id` = (
	SELECT `l`.`currency_id` FROM `__stage_0060_currency_link` AS `l`
	WHERE `l`.`child` = 'tournament' AND `l`.`id` = `tournament`.`id`
)
WHERE `id` IN (
	SELECT `id` FROM `__stage_0060_currency_link` WHERE `child` = 'tournament'
);--> statement-breakpoint

ALTER TABLE `currency` RENAME TO `asset`;--> statement-breakpoint

INSERT INTO `__gate_0060` (`asset_rows_restored`) SELECT NULL WHERE EXISTS (
	SELECT `id`, `user_id`, `unit`, `description`, `is_favorite` <> 0, `kind`,
		`decimals`, `archived_at`, `created_at`, `updated_at`
	FROM `__stage_0060_currency`
	EXCEPT
	SELECT `id`, `user_id`, `unit`, `description`, `is_favorite`, `kind`,
		`decimals`, `archived_at`, `created_at`, `updated_at`
	FROM `asset`
) OR EXISTS (
	SELECT `id`, `user_id`, `unit`, `description`, `is_favorite`, `kind`,
		`decimals`, `archived_at`, `created_at`, `updated_at`
	FROM `asset`
	EXCEPT
	SELECT `id`, `user_id`, `unit`, `description`, `is_favorite` <> 0, `kind`,
		`decimals`, `archived_at`, `created_at`, `updated_at`
	FROM `__stage_0060_currency`
);--> statement-breakpoint
INSERT INTO `__gate_0060` (`transactions_restored`) SELECT NULL WHERE EXISTS (
	SELECT `id`, `currency_id`, `transaction_type_id`, `session_id`, `amount`,
		`transacted_at`, `memo`, `created_at`
	FROM `__stage_0060_currency_transaction`
	EXCEPT
	SELECT `id`, `currency_id`, `transaction_type_id`, `session_id`, `amount`,
		`transacted_at`, `memo`, `created_at`
	FROM `currency_transaction`
) OR EXISTS (
	SELECT `id`, `currency_id`, `transaction_type_id`, `session_id`, `amount`,
		`transacted_at`, `memo`, `created_at`
	FROM `currency_transaction`
	EXCEPT
	SELECT `id`, `currency_id`, `transaction_type_id`, `session_id`, `amount`,
		`transacted_at`, `memo`, `created_at`
	FROM `__stage_0060_currency_transaction`
);--> statement-breakpoint
INSERT INTO `__gate_0060` (`links_restored`) SELECT NULL WHERE EXISTS (
	SELECT `child`, `id`, `currency_id` FROM `__stage_0060_currency_link`
	EXCEPT
	SELECT * FROM (
		SELECT 'game_session', `id`, `currency_id` FROM `game_session` WHERE `currency_id` IS NOT NULL
		UNION ALL
		SELECT 'ring_game', `id`, `currency_id` FROM `ring_game` WHERE `currency_id` IS NOT NULL
		UNION ALL
		SELECT 'tournament', `id`, `currency_id` FROM `tournament` WHERE `currency_id` IS NOT NULL
	)
) OR EXISTS (
	SELECT * FROM (
		SELECT 'game_session', `id`, `currency_id` FROM `game_session` WHERE `currency_id` IS NOT NULL
		UNION ALL
		SELECT 'ring_game', `id`, `currency_id` FROM `ring_game` WHERE `currency_id` IS NOT NULL
		UNION ALL
		SELECT 'tournament', `id`, `currency_id` FROM `tournament` WHERE `currency_id` IS NOT NULL
	)
	EXCEPT
	SELECT `child`, `id`, `currency_id` FROM `__stage_0060_currency_link`
);--> statement-breakpoint
INSERT INTO `__gate_0060` (`names_unique`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `asset` GROUP BY `user_id`, lower(trim(`name`)) HAVING COUNT(*) > 1
);--> statement-breakpoint
INSERT INTO `__gate_0060` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM pragma_foreign_key_check
);--> statement-breakpoint

DROP TABLE `__stage_0060_currency_link`;--> statement-breakpoint
DROP TABLE `__stage_0060_currency_transaction`;--> statement-breakpoint
DROP TABLE `__stage_0060_currency`;--> statement-breakpoint
DROP TABLE `__gate_0060`;
