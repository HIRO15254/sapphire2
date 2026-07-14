-- D1 keeps foreign-key enforcement enabled during migrations. Stage every
-- inbound child before rebuilding ring_game/tournament so DROP TABLE cannot
-- fire SET NULL/CASCADE actions against persisted data.
CREATE TABLE `__stage_0041_ring_game` AS SELECT * FROM `ring_game`;--> statement-breakpoint
CREATE TABLE `__stage_0041_session_cash_detail` AS SELECT * FROM `session_cash_detail`;--> statement-breakpoint
CREATE TABLE `__stage_0041_tournament` AS SELECT * FROM `tournament`;--> statement-breakpoint
CREATE TABLE `__stage_0041_blind_level` AS SELECT * FROM `blind_level`;--> statement-breakpoint
CREATE TABLE `__stage_0041_tournament_chip_purchase` AS SELECT * FROM `tournament_chip_purchase`;--> statement-breakpoint
CREATE TABLE `__stage_0041_tournament_tag` AS SELECT * FROM `tournament_tag`;--> statement-breakpoint
CREATE TABLE `__stage_0041_session_tournament_detail` AS SELECT * FROM `session_tournament_detail`;--> statement-breakpoint

DROP TABLE `session_cash_detail`;--> statement-breakpoint
DROP TABLE `blind_level`;--> statement-breakpoint
DROP TABLE `tournament_chip_purchase`;--> statement-breakpoint
DROP TABLE `tournament_tag`;--> statement-breakpoint
DROP TABLE `session_tournament_detail`;--> statement-breakpoint
DROP TABLE `ring_game`;--> statement-breakpoint
DROP TABLE `tournament`;--> statement-breakpoint

CREATE TABLE `ring_game` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text,
	`user_id` text,
	`name` text NOT NULL,
	`variant` text DEFAULT 'NL Hold''em' NOT NULL,
	`mix_games` text,
	`blind1` integer,
	`blind2` integer,
	`blind3` integer,
	`ante` integer,
	`ante_type` text,
	`min_buy_in` integer,
	`max_buy_in` integer,
	`table_size` integer,
	`currency_id` text,
	`memo` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `ring_game` (
	`id`, `room_id`, `user_id`, `name`, `variant`, `mix_games`, `blind1`,
	`blind2`, `blind3`, `ante`, `ante_type`, `min_buy_in`, `max_buy_in`,
	`table_size`, `currency_id`, `memo`, `archived_at`, `created_at`, `updated_at`
) SELECT
	`id`, `room_id`, `user_id`, `name`, `variant`, `mix_games`, `blind1`,
	`blind2`, `blind3`, `ante`, `ante_type`, `min_buy_in`, `max_buy_in`,
	`table_size`, `currency_id`, `memo`, `archived_at`, `created_at`, `updated_at`
FROM `__stage_0041_ring_game`;--> statement-breakpoint
CREATE INDEX `ringGame_roomId_idx` ON `ring_game` (`room_id`);--> statement-breakpoint
CREATE INDEX `ringGame_userId_idx` ON `ring_game` (`user_id`);--> statement-breakpoint

CREATE TABLE `tournament` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`name` text NOT NULL,
	`variant` text DEFAULT 'NL Hold''em' NOT NULL,
	`buy_in` integer,
	`entry_fee` integer,
	`starting_stack` integer,
	`bounty_amount` integer,
	`table_size` integer,
	`currency_id` text,
	`memo` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `tournament` (
	`id`, `room_id`, `name`, `variant`, `buy_in`, `entry_fee`, `starting_stack`,
	`bounty_amount`, `table_size`, `currency_id`, `memo`, `archived_at`,
	`created_at`, `updated_at`
) SELECT
	`id`, `room_id`, `name`, `variant`, `buy_in`, `entry_fee`, `starting_stack`,
	`bounty_amount`, `table_size`, `currency_id`, `memo`, `archived_at`,
	`created_at`, `updated_at`
FROM `__stage_0041_tournament`;--> statement-breakpoint
CREATE INDEX `tournament_roomId_idx` ON `tournament` (`room_id`);--> statement-breakpoint

CREATE TABLE `session_cash_detail` (
	`session_id` text PRIMARY KEY NOT NULL,
	`ring_game_id` text,
	`buy_in` integer,
	`cash_out` integer,
	`ev_cash_out` integer,
	`rule_name` text DEFAULT 'Untitled' NOT NULL,
	`variant` text DEFAULT 'NL Hold''em' NOT NULL,
	`mix_games` text,
	`blind1` integer,
	`blind2` integer,
	`blind3` integer,
	`ante` integer,
	`ante_type` text,
	`min_buy_in` integer,
	`max_buy_in` integer,
	`table_size` integer,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ring_game_id`) REFERENCES `ring_game`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `session_cash_detail` (
	`session_id`, `ring_game_id`, `buy_in`, `cash_out`, `ev_cash_out`,
	`rule_name`, `variant`, `mix_games`, `blind1`, `blind2`, `blind3`, `ante`,
	`ante_type`, `min_buy_in`, `max_buy_in`, `table_size`
) SELECT
	`session_id`, `ring_game_id`, `buy_in`, `cash_out`, `ev_cash_out`,
	`rule_name`, `variant`, `mix_games`, `blind1`, `blind2`, `blind3`, `ante`,
	`ante_type`, `min_buy_in`, `max_buy_in`, `table_size`
FROM `__stage_0041_session_cash_detail`;--> statement-breakpoint
CREATE INDEX `session_cash_ring_idx` ON `session_cash_detail` (`ring_game_id`);--> statement-breakpoint

CREATE TABLE `blind_level` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`level` integer NOT NULL,
	`is_break` integer DEFAULT false NOT NULL,
	`blind1` integer,
	`blind2` integer,
	`blind3` integer,
	`ante` integer,
	`minutes` integer,
	`games` text,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `blind_level` (
	`id`, `tournament_id`, `level`, `is_break`, `blind1`, `blind2`, `blind3`,
	`ante`, `minutes`, `games`
) SELECT
	`id`, `tournament_id`, `level`, `is_break`, `blind1`, `blind2`, `blind3`,
	`ante`, `minutes`, `games`
FROM `__stage_0041_blind_level`;--> statement-breakpoint
CREATE INDEX `blindLevel_tournamentId_idx` ON `blind_level` (`tournament_id`);--> statement-breakpoint

CREATE TABLE `tournament_chip_purchase` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`name` text NOT NULL,
	`cost` integer NOT NULL,
	`chips` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `tournament_chip_purchase` (
	`id`, `tournament_id`, `name`, `cost`, `chips`, `sort_order`
) SELECT `id`, `tournament_id`, `name`, `cost`, `chips`, `sort_order`
FROM `__stage_0041_tournament_chip_purchase`;--> statement-breakpoint
CREATE INDEX `tournamentChipPurchase_tournamentId_idx` ON `tournament_chip_purchase` (`tournament_id`);--> statement-breakpoint

CREATE TABLE `tournament_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `tournament_tag` (`id`, `tournament_id`, `name`, `created_at`)
SELECT `id`, `tournament_id`, `name`, `created_at`
FROM `__stage_0041_tournament_tag`;--> statement-breakpoint
CREATE INDEX `tournamentTag_tournamentId_idx` ON `tournament_tag` (`tournament_id`);--> statement-breakpoint

CREATE TABLE `session_tournament_detail` (
	`session_id` text PRIMARY KEY NOT NULL,
	`tournament_id` text,
	`tournament_buy_in` integer,
	`entry_fee` integer,
	`placement` integer,
	`total_entries` integer,
	`before_deadline` integer,
	`prize_money` integer,
	`bounty_prizes` integer,
	`timer_started_at` integer,
	`rule_name` text DEFAULT 'Untitled' NOT NULL,
	`variant` text DEFAULT 'NL Hold''em' NOT NULL,
	`starting_stack` integer,
	`bounty_amount` integer,
	`table_size` integer,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `session_tournament_detail` (
	`session_id`, `tournament_id`, `tournament_buy_in`, `entry_fee`, `placement`,
	`total_entries`, `before_deadline`, `prize_money`, `bounty_prizes`,
	`timer_started_at`, `rule_name`, `variant`, `starting_stack`, `bounty_amount`,
	`table_size`
) SELECT
	`session_id`, `tournament_id`, `tournament_buy_in`, `entry_fee`, `placement`,
	`total_entries`, `before_deadline`, `prize_money`, `bounty_prizes`,
	`timer_started_at`, `rule_name`, `variant`, `starting_stack`, `bounty_amount`,
	`table_size`
FROM `__stage_0041_session_tournament_detail`;--> statement-breakpoint
CREATE INDEX `session_tournament_tournament_idx` ON `session_tournament_detail` (`tournament_id`);--> statement-breakpoint

DROP TABLE `__stage_0041_ring_game`;--> statement-breakpoint
DROP TABLE `__stage_0041_session_cash_detail`;--> statement-breakpoint
DROP TABLE `__stage_0041_tournament`;--> statement-breakpoint
DROP TABLE `__stage_0041_blind_level`;--> statement-breakpoint
DROP TABLE `__stage_0041_tournament_chip_purchase`;--> statement-breakpoint
DROP TABLE `__stage_0041_tournament_tag`;--> statement-breakpoint
DROP TABLE `__stage_0041_session_tournament_detail`;--> statement-breakpoint

-- 0038 preserves the temporary custom variant table under this name. CREATE
-- IF NOT EXISTS also keeps 0041 deployable to a preview DB that already ran
-- the original destructive 0038 (that database has no recoverable rows).
CREATE TABLE IF NOT EXISTS `__legacy_custom_game_variant` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`blind1_label` text,
	`blind2_label` text,
	`blind3_label` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT OR IGNORE INTO `game_group` (
	`id`, `user_id`, `builtin_key`, `label`, `blind1_label`, `blind2_label`,
	`blind3_label`, `created_at`, `updated_at`
) SELECT
	'legacy-group-' || `id`, `user_id`, NULL,
	CASE
		WHEN EXISTS (
			SELECT 1 FROM `game_group`
			WHERE `game_group`.`user_id` = `legacy`.`user_id`
				AND `game_group`.`label` = substr(`legacy`.`label`, 1, 23) || ' Blinds'
		) THEN substr(`label`, 1, 13) || ' ' || substr(`id`, 1, 8) || ' Blinds'
		ELSE substr(`label`, 1, 23) || ' Blinds'
	END,
	`blind1_label`, `blind2_label`, `blind3_label`, `created_at`, `updated_at`
FROM `__legacy_custom_game_variant` AS `legacy`;--> statement-breakpoint
INSERT OR IGNORE INTO `game_variant` (
	`id`, `user_id`, `builtin_key`, `label`, `short_label`, `group_id`,
	`sort_order`, `created_at`, `updated_at`
) SELECT
	`id`, `user_id`, NULL, `label`, NULL, 'legacy-group-' || `id`,
	1000 + `rowid`, `created_at`, `updated_at`
FROM `__legacy_custom_game_variant`;--> statement-breakpoint
DROP TABLE `__legacy_custom_game_variant`;--> statement-breakpoint

-- Deduplicate groups in dependency order: first redirect every variant, then
-- remove the now-unreferenced duplicate group. Label and builtin-key passes
-- are separate so the second pass only sees survivors from the first.
CREATE TABLE `__dedup_0041_game_group` (
	`old_id` text PRIMARY KEY NOT NULL,
	`keep_id` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__dedup_0041_game_group` (`old_id`, `keep_id`)
SELECT `duplicate`.`id`, `canonical`.`id`
FROM `game_group` AS `duplicate`
JOIN `game_group` AS `canonical`
	ON `canonical`.`user_id` = `duplicate`.`user_id`
	AND trim(`canonical`.`label`) = trim(`duplicate`.`label`) COLLATE NOCASE
WHERE `canonical`.`rowid` = (
	SELECT MIN(`candidate`.`rowid`)
	FROM `game_group` AS `candidate`
	WHERE `candidate`.`user_id` = `duplicate`.`user_id`
		AND trim(`candidate`.`label`) = trim(`duplicate`.`label`) COLLATE NOCASE
)
	AND `duplicate`.`id` <> `canonical`.`id`;--> statement-breakpoint
UPDATE `game_variant`
SET `group_id` = (
	SELECT `keep_id` FROM `__dedup_0041_game_group`
	WHERE `old_id` = `game_variant`.`group_id`
)
WHERE `group_id` IN (SELECT `old_id` FROM `__dedup_0041_game_group`);--> statement-breakpoint
DELETE FROM `game_group`
WHERE `id` IN (SELECT `old_id` FROM `__dedup_0041_game_group`);--> statement-breakpoint
DELETE FROM `__dedup_0041_game_group`;--> statement-breakpoint
INSERT INTO `__dedup_0041_game_group` (`old_id`, `keep_id`)
SELECT `duplicate`.`id`, `canonical`.`id`
FROM `game_group` AS `duplicate`
JOIN `game_group` AS `canonical`
	ON `canonical`.`user_id` = `duplicate`.`user_id`
	AND `canonical`.`builtin_key` = `duplicate`.`builtin_key`
WHERE `duplicate`.`builtin_key` IS NOT NULL
	AND `canonical`.`rowid` = (
		SELECT MIN(`candidate`.`rowid`)
		FROM `game_group` AS `candidate`
		WHERE `candidate`.`user_id` = `duplicate`.`user_id`
			AND `candidate`.`builtin_key` = `duplicate`.`builtin_key`
	)
	AND `duplicate`.`id` <> `canonical`.`id`;--> statement-breakpoint
UPDATE `game_variant`
SET `group_id` = (
	SELECT `keep_id` FROM `__dedup_0041_game_group`
	WHERE `old_id` = `game_variant`.`group_id`
)
WHERE `group_id` IN (SELECT `old_id` FROM `__dedup_0041_game_group`);--> statement-breakpoint
DELETE FROM `game_group`
WHERE `id` IN (SELECT `old_id` FROM `__dedup_0041_game_group`);--> statement-breakpoint
DROP TABLE `__dedup_0041_game_group`;--> statement-breakpoint

-- Rewrite ordered JSON references before deleting duplicate variants. The
-- inner position column preserves the original mix order; GROUP BY removes a
-- duplicate id only when multiple legacy ids collapse to one canonical id.
CREATE TABLE `__dedup_0041_game_variant` (
	`old_id` text PRIMARY KEY NOT NULL,
	`keep_id` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__dedup_0041_game_variant` (`old_id`, `keep_id`)
SELECT `duplicate`.`id`, `canonical`.`id`
FROM `game_variant` AS `duplicate`
JOIN `game_variant` AS `canonical`
	ON `canonical`.`user_id` = `duplicate`.`user_id`
	AND trim(`canonical`.`label`) = trim(`duplicate`.`label`) COLLATE NOCASE
WHERE `canonical`.`rowid` = (
	SELECT MIN(`candidate`.`rowid`)
	FROM `game_variant` AS `candidate`
	WHERE `candidate`.`user_id` = `duplicate`.`user_id`
		AND trim(`candidate`.`label`) = trim(`duplicate`.`label`) COLLATE NOCASE
)
	AND `duplicate`.`id` <> `canonical`.`id`;--> statement-breakpoint
UPDATE `game_mix`
SET `games` = (
	SELECT json_group_array(`mapped_id`)
	FROM (
		SELECT `mapped_id`
		FROM (
			SELECT
				COALESCE(`mapping`.`keep_id`, CAST(`game`.`value` AS text)) AS `mapped_id`,
				CAST(`game`.`key` AS integer) AS `position`
			FROM json_each(`game_mix`.`games`) AS `game`
			LEFT JOIN `__dedup_0041_game_variant` AS `mapping`
				ON `mapping`.`old_id` = CAST(`game`.`value` AS text)
		)
		GROUP BY `mapped_id`
		ORDER BY MIN(`position`)
	)
)
WHERE EXISTS (
	SELECT 1
	FROM json_each(`game_mix`.`games`) AS `game`
	JOIN `__dedup_0041_game_variant` AS `mapping`
		ON `mapping`.`old_id` = CAST(`game`.`value` AS text)
);--> statement-breakpoint
DELETE FROM `game_variant`
WHERE `id` IN (SELECT `old_id` FROM `__dedup_0041_game_variant`);--> statement-breakpoint
DELETE FROM `__dedup_0041_game_variant`;--> statement-breakpoint
INSERT INTO `__dedup_0041_game_variant` (`old_id`, `keep_id`)
SELECT `duplicate`.`id`, `canonical`.`id`
FROM `game_variant` AS `duplicate`
JOIN `game_variant` AS `canonical`
	ON `canonical`.`user_id` = `duplicate`.`user_id`
	AND `canonical`.`builtin_key` = `duplicate`.`builtin_key`
WHERE `duplicate`.`builtin_key` IS NOT NULL
	AND `canonical`.`rowid` = (
		SELECT MIN(`candidate`.`rowid`)
		FROM `game_variant` AS `candidate`
		WHERE `candidate`.`user_id` = `duplicate`.`user_id`
			AND `candidate`.`builtin_key` = `duplicate`.`builtin_key`
	)
	AND `duplicate`.`id` <> `canonical`.`id`;--> statement-breakpoint
UPDATE `game_mix`
SET `games` = (
	SELECT json_group_array(`mapped_id`)
	FROM (
		SELECT `mapped_id`
		FROM (
			SELECT
				COALESCE(`mapping`.`keep_id`, CAST(`game`.`value` AS text)) AS `mapped_id`,
				CAST(`game`.`key` AS integer) AS `position`
			FROM json_each(`game_mix`.`games`) AS `game`
			LEFT JOIN `__dedup_0041_game_variant` AS `mapping`
				ON `mapping`.`old_id` = CAST(`game`.`value` AS text)
		)
		GROUP BY `mapped_id`
		ORDER BY MIN(`position`)
	)
)
WHERE EXISTS (
	SELECT 1
	FROM json_each(`game_mix`.`games`) AS `game`
	JOIN `__dedup_0041_game_variant` AS `mapping`
		ON `mapping`.`old_id` = CAST(`game`.`value` AS text)
);--> statement-breakpoint
DELETE FROM `game_variant`
WHERE `id` IN (SELECT `old_id` FROM `__dedup_0041_game_variant`);--> statement-breakpoint
DROP TABLE `__dedup_0041_game_variant`;--> statement-breakpoint

DELETE FROM `game_mix` WHERE `rowid` NOT IN (
	SELECT MIN(`rowid`) FROM `game_mix`
	GROUP BY `user_id`, trim(`label`) COLLATE NOCASE
);--> statement-breakpoint
DELETE FROM `game_mix` WHERE `builtin_key` IS NOT NULL AND `rowid` NOT IN (
	SELECT MIN(`rowid`) FROM `game_mix`
	WHERE `builtin_key` IS NOT NULL GROUP BY `user_id`, `builtin_key`
);--> statement-breakpoint

CREATE UNIQUE INDEX `gameGroup_userId_builtinKey_idx` ON `game_group` (`user_id`,`builtin_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `gameGroup_userId_label_idx` ON `game_group` (`user_id`,`label`);--> statement-breakpoint
CREATE UNIQUE INDEX `gameMix_userId_builtinKey_idx` ON `game_mix` (`user_id`,`builtin_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `gameMix_userId_label_idx` ON `game_mix` (`user_id`,`label`);--> statement-breakpoint
CREATE UNIQUE INDEX `gameVariant_userId_builtinKey_idx` ON `game_variant` (`user_id`,`builtin_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `gameVariant_userId_label_idx` ON `game_variant` (`user_id`,`label`);--> statement-breakpoint

-- Drizzle does not model SQLite triggers. These manual integrity triggers add
-- normalized label uniqueness without changing the generated schema ledger.
-- SQLite serializes writers, so the checks and their writes are atomic even
-- when two requests race past the API-level availability check.
CREATE TRIGGER `game_group_label_unique_insert`
BEFORE INSERT ON `game_group`
WHEN EXISTS (
	SELECT 1 FROM `game_group` AS `existing`
	WHERE `existing`.`user_id` = NEW.`user_id`
		AND trim(`existing`.`label`) = trim(NEW.`label`) COLLATE NOCASE
)
BEGIN
	SELECT RAISE(ABORT, 'game_group label already exists');
END;--> statement-breakpoint
CREATE TRIGGER `game_group_label_unique_update`
BEFORE UPDATE OF `user_id`, `label` ON `game_group`
WHEN EXISTS (
	SELECT 1 FROM `game_group` AS `existing`
	WHERE `existing`.`user_id` = NEW.`user_id`
		AND `existing`.`rowid` <> OLD.`rowid`
		AND trim(`existing`.`label`) = trim(NEW.`label`) COLLATE NOCASE
)
BEGIN
	SELECT RAISE(ABORT, 'game_group label already exists');
END;--> statement-breakpoint

CREATE TRIGGER `game_variant_label_unique_insert`
BEFORE INSERT ON `game_variant`
WHEN EXISTS (
	SELECT 1 FROM `game_variant` AS `existing`
	WHERE `existing`.`user_id` = NEW.`user_id`
		AND trim(`existing`.`label`) = trim(NEW.`label`) COLLATE NOCASE
) OR EXISTS (
	SELECT 1 FROM `game_mix` AS `existing`
	WHERE `existing`.`user_id` = NEW.`user_id`
		AND trim(`existing`.`label`) = trim(NEW.`label`) COLLATE NOCASE
)
BEGIN
	SELECT RAISE(ABORT, 'game master label already exists');
END;--> statement-breakpoint
CREATE TRIGGER `game_variant_label_unique_update`
BEFORE UPDATE OF `user_id`, `label` ON `game_variant`
WHEN EXISTS (
	SELECT 1 FROM `game_variant` AS `existing`
	WHERE `existing`.`user_id` = NEW.`user_id`
		AND `existing`.`rowid` <> OLD.`rowid`
		AND trim(`existing`.`label`) = trim(NEW.`label`) COLLATE NOCASE
) OR EXISTS (
	SELECT 1 FROM `game_mix` AS `existing`
	WHERE `existing`.`user_id` = NEW.`user_id`
		AND trim(`existing`.`label`) = trim(NEW.`label`) COLLATE NOCASE
)
BEGIN
	SELECT RAISE(ABORT, 'game master label already exists');
END;--> statement-breakpoint

CREATE TRIGGER `game_mix_label_unique_insert`
BEFORE INSERT ON `game_mix`
WHEN EXISTS (
	SELECT 1 FROM `game_mix` AS `existing`
	WHERE `existing`.`user_id` = NEW.`user_id`
		AND trim(`existing`.`label`) = trim(NEW.`label`) COLLATE NOCASE
) OR EXISTS (
	SELECT 1 FROM `game_variant` AS `existing`
	WHERE `existing`.`user_id` = NEW.`user_id`
		AND trim(`existing`.`label`) = trim(NEW.`label`) COLLATE NOCASE
)
BEGIN
	SELECT RAISE(ABORT, 'game master label already exists');
END;--> statement-breakpoint
CREATE TRIGGER `game_mix_label_unique_update`
BEFORE UPDATE OF `user_id`, `label` ON `game_mix`
WHEN EXISTS (
	SELECT 1 FROM `game_mix` AS `existing`
	WHERE `existing`.`user_id` = NEW.`user_id`
		AND `existing`.`rowid` <> OLD.`rowid`
		AND trim(`existing`.`label`) = trim(NEW.`label`) COLLATE NOCASE
) OR EXISTS (
	SELECT 1 FROM `game_variant` AS `existing`
	WHERE `existing`.`user_id` = NEW.`user_id`
		AND trim(`existing`.`label`) = trim(NEW.`label`) COLLATE NOCASE
)
BEGIN
	SELECT RAISE(ABORT, 'game master label already exists');
END;--> statement-breakpoint

-- JSON arrays cannot carry native foreign keys. Validate every element at the
-- write boundary, including ownership, and guard referenced variants against
-- id/owner changes or deletion.
CREATE TRIGGER `game_mix_games_reference_insert`
BEFORE INSERT ON `game_mix`
WHEN json_valid(NEW.`games`) = 0
	OR json_type(
		CASE WHEN json_valid(NEW.`games`) THEN NEW.`games` ELSE '[]' END
	) <> 'array'
	OR EXISTS (
		SELECT 1
		FROM json_each(
			CASE WHEN json_valid(NEW.`games`) THEN NEW.`games` ELSE '[]' END
		) AS `game`
		LEFT JOIN `game_variant` AS `available`
			ON `available`.`id` = CAST(`game`.`value` AS text)
			AND `available`.`user_id` = NEW.`user_id`
		WHERE `game`.`type` <> 'text' OR `available`.`id` IS NULL
	)
BEGIN
	SELECT RAISE(ABORT, 'game_mix contains an unavailable variant');
END;--> statement-breakpoint
CREATE TRIGGER `game_mix_games_reference_update`
BEFORE UPDATE OF `user_id`, `games` ON `game_mix`
WHEN json_valid(NEW.`games`) = 0
	OR json_type(
		CASE WHEN json_valid(NEW.`games`) THEN NEW.`games` ELSE '[]' END
	) <> 'array'
	OR EXISTS (
		SELECT 1
		FROM json_each(
			CASE WHEN json_valid(NEW.`games`) THEN NEW.`games` ELSE '[]' END
		) AS `game`
		LEFT JOIN `game_variant` AS `available`
			ON `available`.`id` = CAST(`game`.`value` AS text)
			AND `available`.`user_id` = NEW.`user_id`
		WHERE `game`.`type` <> 'text' OR `available`.`id` IS NULL
	)
BEGIN
	SELECT RAISE(ABORT, 'game_mix contains an unavailable variant');
END;--> statement-breakpoint
CREATE TRIGGER `game_variant_mix_reference_delete`
BEFORE DELETE ON `game_variant`
WHEN EXISTS (
	SELECT 1
	FROM `game_mix` AS `mix`
	JOIN json_each(
		CASE WHEN json_valid(`mix`.`games`) THEN `mix`.`games` ELSE '[]' END
	) AS `game`
		ON CAST(`game`.`value` AS text) = OLD.`id`
)
BEGIN
	SELECT RAISE(ABORT, 'game_variant is referenced by a mix');
END;--> statement-breakpoint
CREATE TRIGGER `game_variant_mix_reference_update`
BEFORE UPDATE OF `id`, `user_id` ON `game_variant`
WHEN (NEW.`id` <> OLD.`id` OR NEW.`user_id` <> OLD.`user_id`)
	AND EXISTS (
		SELECT 1
		FROM `game_mix` AS `mix`
		JOIN json_each(
			CASE WHEN json_valid(`mix`.`games`) THEN `mix`.`games` ELSE '[]' END
		) AS `game`
			ON CAST(`game`.`value` AS text) = OLD.`id`
	)
BEGIN
	SELECT RAISE(ABORT, 'game_variant is referenced by a mix');
END;
