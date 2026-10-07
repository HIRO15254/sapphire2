-- Rebuild ring_game and tournament with user_id NOT NULL and a composite FK
-- to room(id, user_id). D1 keeps foreign-key enforcement on during
-- migrations, so DROP TABLE fires the CASCADE / SET NULL actions of every
-- inbound child: the child rows and links are staged first and restored after
-- the rebuild.
--
-- Replay safety: a stage is created once and refreshed only while its source
-- table still has the pre-0054 shape, so a retry after a failure before the
-- drop picks up rows the old Worker wrote in between, and a retry after the
-- drop keeps the staged copy. The leading CREATE TABLE IF NOT EXISTS only acts
-- when a failure fell between a DROP and its CREATE, so the refresh statements
-- always find their source table; they name the pre-0054 columns because a
-- column-count mismatch fails at prepare time even when no row qualifies.
-- Stages are dropped only after every restore.
CREATE UNIQUE INDEX IF NOT EXISTS `room_id_user_id_unique` ON `room` (`id`,`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ring_game` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text,
	`user_id` text NOT NULL,
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
	`house_rules` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`room_id`,`user_id`) REFERENCES `room`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tournament` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
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
	`house_rules` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`room_id`,`user_id`) REFERENCES `room`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `__stage_0054_ring_game` AS SELECT * FROM `ring_game`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__stage_0054_session_cash_detail` AS
SELECT `session_id`, `ring_game_id` FROM `session_cash_detail` WHERE `ring_game_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__stage_0054_tournament` AS SELECT * FROM `tournament`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__stage_0054_blind_level` AS SELECT * FROM `blind_level`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__stage_0054_tournament_chip_purchase` AS SELECT * FROM `tournament_chip_purchase`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__stage_0054_tournament_tag` AS SELECT * FROM `tournament_tag`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__stage_0054_session_tournament_detail` AS
SELECT `session_id`, `tournament_id` FROM `session_tournament_detail` WHERE `tournament_id` IS NOT NULL;--> statement-breakpoint

DELETE FROM `__stage_0054_ring_game` WHERE EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'ring_game'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
INSERT INTO `__stage_0054_ring_game` (
	`id`, `room_id`, `user_id`, `name`, `variant`, `mix_games`, `blind1`,
	`blind2`, `blind3`, `ante`, `ante_type`, `min_buy_in`, `max_buy_in`,
	`table_size`, `currency_id`, `memo`, `house_rules`, `archived_at`,
	`created_at`, `updated_at`
) SELECT
	`id`, `room_id`, `user_id`, `name`, `variant`, `mix_games`, `blind1`,
	`blind2`, `blind3`, `ante`, `ante_type`, `min_buy_in`, `max_buy_in`,
	`table_size`, `currency_id`, `memo`, `house_rules`, `archived_at`,
	`created_at`, `updated_at`
FROM `ring_game` WHERE EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'ring_game'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
DELETE FROM `__stage_0054_session_cash_detail` WHERE EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'ring_game'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
INSERT INTO `__stage_0054_session_cash_detail`
SELECT `session_id`, `ring_game_id` FROM `session_cash_detail`
WHERE `ring_game_id` IS NOT NULL AND EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'ring_game'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
DELETE FROM `__stage_0054_tournament` WHERE EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'tournament'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
INSERT INTO `__stage_0054_tournament` (
	`id`, `room_id`, `name`, `variant`, `buy_in`, `entry_fee`,
	`starting_stack`, `bounty_amount`, `table_size`, `currency_id`, `memo`,
	`house_rules`, `archived_at`, `created_at`, `updated_at`
) SELECT
	`id`, `room_id`, `name`, `variant`, `buy_in`, `entry_fee`,
	`starting_stack`, `bounty_amount`, `table_size`, `currency_id`, `memo`,
	`house_rules`, `archived_at`, `created_at`, `updated_at`
FROM `tournament` WHERE EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'tournament'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
DELETE FROM `__stage_0054_blind_level` WHERE EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'tournament'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
INSERT INTO `__stage_0054_blind_level` SELECT * FROM `blind_level` WHERE EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'tournament'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
DELETE FROM `__stage_0054_tournament_chip_purchase` WHERE EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'tournament'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
INSERT INTO `__stage_0054_tournament_chip_purchase` SELECT * FROM `tournament_chip_purchase` WHERE EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'tournament'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
DELETE FROM `__stage_0054_tournament_tag` WHERE EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'tournament'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
INSERT INTO `__stage_0054_tournament_tag` SELECT * FROM `tournament_tag` WHERE EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'tournament'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
DELETE FROM `__stage_0054_session_tournament_detail` WHERE EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'tournament'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint
INSERT INTO `__stage_0054_session_tournament_detail`
SELECT `session_id`, `tournament_id` FROM `session_tournament_detail`
WHERE `tournament_id` IS NOT NULL AND EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` = 'table' AND `name` = 'tournament'
		AND `sql` NOT LIKE '%REFERENCES `room`(`id`,`user_id`)%'
);--> statement-breakpoint

DROP TABLE IF EXISTS `ring_game`;--> statement-breakpoint
CREATE TABLE `ring_game` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text,
	`user_id` text NOT NULL,
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
	`house_rules` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`room_id`,`user_id`) REFERENCES `room`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
-- Owner: the row's own user_id, else its room's owner, else the owner of the
-- oldest session that links it. A row with no owner is linked by no session
-- and is dropped. A room owned by someone other than the owner is unlinked.
INSERT INTO `ring_game` (
	`id`, `room_id`, `user_id`, `name`, `variant`, `mix_games`, `blind1`,
	`blind2`, `blind3`, `ante`, `ante_type`, `min_buy_in`, `max_buy_in`,
	`table_size`, `currency_id`, `memo`, `house_rules`, `archived_at`,
	`created_at`, `updated_at`
) SELECT
	`id`, CASE WHEN `room_owner` = `owner` THEN `room_id` END, `owner`, `name`,
	`variant`, `mix_games`, `blind1`, `blind2`, `blind3`, `ante`, `ante_type`,
	`min_buy_in`, `max_buy_in`, `table_size`, `currency_id`, `memo`,
	`house_rules`, `archived_at`, `created_at`, `updated_at`
FROM (
	SELECT `staged`.*, `room`.`user_id` AS `room_owner`, COALESCE(
		`staged`.`user_id`,
		`room`.`user_id`,
		(
			SELECT `game_session`.`user_id`
			FROM `__stage_0054_session_cash_detail` AS `link`
			JOIN `game_session` ON `game_session`.`id` = `link`.`session_id`
			WHERE `link`.`ring_game_id` = `staged`.`id`
			ORDER BY `game_session`.`created_at`, `game_session`.`id`
			LIMIT 1
		)
	) AS `owner`
	FROM `__stage_0054_ring_game` AS `staged`
	LEFT JOIN `room` ON `room`.`id` = `staged`.`room_id`
)
WHERE `owner` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `ring_game_id_user_id_unique` ON `ring_game` (`id`,`user_id`);--> statement-breakpoint
CREATE INDEX `ringGame_roomId_idx` ON `ring_game` (`room_id`);--> statement-breakpoint
CREATE INDEX `ringGame_userId_idx` ON `ring_game` (`user_id`);--> statement-breakpoint
CREATE INDEX `ringGame_currencyId_idx` ON `ring_game` (`currency_id`);--> statement-breakpoint
UPDATE `session_cash_detail`
SET `ring_game_id` = (
	SELECT `link`.`ring_game_id` FROM `__stage_0054_session_cash_detail` AS `link`
	WHERE `link`.`session_id` = `session_cash_detail`.`session_id`
)
WHERE `session_id` IN (
	SELECT `session_id` FROM `__stage_0054_session_cash_detail`
	WHERE `ring_game_id` IN (SELECT `id` FROM `ring_game`)
);--> statement-breakpoint

DROP TABLE IF EXISTS `tournament`;--> statement-breakpoint
CREATE TABLE `tournament` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
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
	`house_rules` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`room_id`,`user_id`) REFERENCES `room`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `tournament` (
	`id`, `user_id`, `room_id`, `name`, `variant`, `buy_in`, `entry_fee`,
	`starting_stack`, `bounty_amount`, `table_size`, `currency_id`, `memo`,
	`house_rules`, `archived_at`, `created_at`, `updated_at`
) SELECT
	`staged`.`id`, `room`.`user_id`, `staged`.`room_id`, `staged`.`name`,
	`staged`.`variant`, `staged`.`buy_in`, `staged`.`entry_fee`,
	`staged`.`starting_stack`, `staged`.`bounty_amount`, `staged`.`table_size`,
	`staged`.`currency_id`, `staged`.`memo`, `staged`.`house_rules`,
	`staged`.`archived_at`, `staged`.`created_at`, `staged`.`updated_at`
FROM `__stage_0054_tournament` AS `staged`
JOIN `room` ON `room`.`id` = `staged`.`room_id`;--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_id_user_id_unique` ON `tournament` (`id`,`user_id`);--> statement-breakpoint
CREATE INDEX `tournament_userId_idx` ON `tournament` (`user_id`);--> statement-breakpoint
CREATE INDEX `tournament_roomId_idx` ON `tournament` (`room_id`);--> statement-breakpoint
CREATE INDEX `tournament_currencyId_idx` ON `tournament` (`currency_id`);--> statement-breakpoint
INSERT INTO `blind_level` (
	`id`, `tournament_id`, `level`, `is_break`, `blind1`, `blind2`, `blind3`,
	`ante`, `minutes`, `games`
) SELECT
	`id`, `tournament_id`, `level`, `is_break`, `blind1`, `blind2`, `blind3`,
	`ante`, `minutes`, `games`
FROM `__stage_0054_blind_level`
WHERE `tournament_id` IN (SELECT `id` FROM `tournament`);--> statement-breakpoint
INSERT INTO `tournament_chip_purchase` (
	`id`, `tournament_id`, `name`, `cost`, `chips`, `sort_order`
) SELECT `id`, `tournament_id`, `name`, `cost`, `chips`, `sort_order`
FROM `__stage_0054_tournament_chip_purchase`
WHERE `tournament_id` IN (SELECT `id` FROM `tournament`);--> statement-breakpoint
INSERT INTO `tournament_tag` (`id`, `tournament_id`, `name`, `created_at`)
SELECT `id`, `tournament_id`, `name`, `created_at`
FROM `__stage_0054_tournament_tag`
WHERE `tournament_id` IN (SELECT `id` FROM `tournament`);--> statement-breakpoint
UPDATE `session_tournament_detail`
SET `tournament_id` = (
	SELECT `link`.`tournament_id` FROM `__stage_0054_session_tournament_detail` AS `link`
	WHERE `link`.`session_id` = `session_tournament_detail`.`session_id`
)
WHERE `session_id` IN (
	SELECT `session_id` FROM `__stage_0054_session_tournament_detail`
	WHERE `tournament_id` IN (SELECT `id` FROM `tournament`)
);--> statement-breakpoint

DROP TABLE IF EXISTS `__stage_0054_ring_game`;--> statement-breakpoint
DROP TABLE IF EXISTS `__stage_0054_session_cash_detail`;--> statement-breakpoint
DROP TABLE IF EXISTS `__stage_0054_tournament`;--> statement-breakpoint
DROP TABLE IF EXISTS `__stage_0054_blind_level`;--> statement-breakpoint
DROP TABLE IF EXISTS `__stage_0054_tournament_chip_purchase`;--> statement-breakpoint
DROP TABLE IF EXISTS `__stage_0054_tournament_tag`;--> statement-breakpoint
DROP TABLE IF EXISTS `__stage_0054_session_tournament_detail`;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `currency_id_user_id_unique` ON `currency` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `player_id_user_id_unique` ON `player` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `player_tag_id_user_id_unique` ON `player_tag` (`id`,`user_id`);
