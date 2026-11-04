-- Data model v2, B05 (SA2-389): final game master DDL (data-model-v2.md §5.2,
-- §16.3; game-lineups.md).
--
-- The 0041 label and JSON-reference triggers and the 0049 games-mirror
-- synchronization triggers are dropped. Label uniqueness becomes one
-- (user_id, lower(trim(label))) expression UNIQUE index per table, archived
-- rows included; variants and mixes no longer share a namespace.
-- game_group and game_mix gain archived_at in place. game_variant is rebuilt
-- with archived_at, the owned (group_id, user_id) -> game_group NO ACTION
-- foreign key and the sort_order CHECK; ids and every other column are kept.
--
-- Inbound references to game_variant in the schema are all NO ACTION:
-- game_mix_variant(variant_id, user_id), game_lineup_variant(variant_id,
-- user_id) and hand(variant_id, user_id). None of those tables has a child of
-- its own. Before the DROP every junction row is staged and removed and every
-- hand link is staged and cleared; all are restored after the rebuild.
--
-- Each gate inserts NULL into its own NOT NULL column of __gate_0065 when
-- violated, so a failure names the gate. The stages are dropped after the
-- gates pass.
CREATE TABLE `__gate_0065` (
	`labels_unique` integer DEFAULT 1 NOT NULL,
	`variant_groups_owned` integer DEFAULT 1 NOT NULL,
	`variant_rows_restored` integer DEFAULT 1 NOT NULL,
	`mix_variants_restored` integer DEFAULT 1 NOT NULL,
	`lineup_variants_restored` integer DEFAULT 1 NOT NULL,
	`hand_links_restored` integer DEFAULT 1 NOT NULL,
	`foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint

DROP TRIGGER `game_group_label_unique_insert`;--> statement-breakpoint
DROP TRIGGER `game_group_label_unique_update`;--> statement-breakpoint
DROP TRIGGER `game_variant_label_unique_insert`;--> statement-breakpoint
DROP TRIGGER `game_variant_label_unique_update`;--> statement-breakpoint
DROP TRIGGER `game_mix_label_unique_insert`;--> statement-breakpoint
DROP TRIGGER `game_mix_label_unique_update`;--> statement-breakpoint
DROP TRIGGER `game_mix_games_reference_insert`;--> statement-breakpoint
DROP TRIGGER `game_mix_games_reference_update`;--> statement-breakpoint
DROP TRIGGER `game_variant_mix_reference_delete`;--> statement-breakpoint
DROP TRIGGER `game_variant_mix_reference_update`;--> statement-breakpoint
DROP TRIGGER `game_mix_variants_compat_insert`;--> statement-breakpoint
DROP TRIGGER `game_mix_variants_compat_update`;--> statement-breakpoint

INSERT INTO `__gate_0065` (`labels_unique`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `game_group` GROUP BY `user_id`, lower(trim(`label`)) HAVING COUNT(*) > 1
) OR EXISTS (
	SELECT 1 FROM `game_variant` GROUP BY `user_id`, lower(trim(`label`)) HAVING COUNT(*) > 1
) OR EXISTS (
	SELECT 1 FROM `game_mix` GROUP BY `user_id`, lower(trim(`label`)) HAVING COUNT(*) > 1
);--> statement-breakpoint
INSERT INTO `__gate_0065` (`variant_groups_owned`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `game_variant` AS `v`
	LEFT JOIN `game_group` AS `g` ON `g`.`id` = `v`.`group_id` AND `g`.`user_id` = `v`.`user_id`
	WHERE `g`.`id` IS NULL
);--> statement-breakpoint

DROP INDEX `gameGroup_userId_label_idx`;--> statement-breakpoint
ALTER TABLE `game_group` ADD `archived_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `game_group_label_uq` ON `game_group` (`user_id`,lower(trim("label")));--> statement-breakpoint
DROP INDEX `gameMix_userId_label_idx`;--> statement-breakpoint
ALTER TABLE `game_mix` ADD `archived_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `game_mix_label_uq` ON `game_mix` (`user_id`,lower(trim("label")));--> statement-breakpoint

CREATE TABLE `__stage_0065_game_variant` AS SELECT
	`id`, `user_id`, `builtin_key`, `label`, `short_label`, `group_id`,
	`sort_order`, `created_at`, `updated_at`
FROM `game_variant`;--> statement-breakpoint
CREATE TABLE `__stage_0065_game_mix_variant` AS SELECT
	`mix_id`, `variant_id`, `user_id`, `position`
FROM `game_mix_variant`;--> statement-breakpoint
CREATE TABLE `__stage_0065_game_lineup_variant` AS SELECT
	`user_id`, `lineup_id`, `lineup_group_id`, `variant_id`, `position`
FROM `game_lineup_variant`;--> statement-breakpoint
CREATE TABLE `__stage_0065_hand_variant` AS SELECT
	`id`, `user_id`, `variant_id`
FROM `hand` WHERE `variant_id` IS NOT NULL;--> statement-breakpoint

DELETE FROM `game_mix_variant`;--> statement-breakpoint
DELETE FROM `game_lineup_variant`;--> statement-breakpoint
UPDATE `hand` SET `variant_id` = NULL WHERE `variant_id` IS NOT NULL;--> statement-breakpoint
DROP TABLE `game_variant`;--> statement-breakpoint

CREATE TABLE `game_variant` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`builtin_key` text,
	`label` text NOT NULL,
	`short_label` text,
	`group_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`,`user_id`) REFERENCES `game_group`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "game_variant_sort_order_check" CHECK("sort_order" >= 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX `game_variant_id_user_id_unique` ON `game_variant` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_variant_label_uq` ON `game_variant` (`user_id`,lower(trim("label")));--> statement-breakpoint
CREATE UNIQUE INDEX `game_variant_builtin_uq` ON `game_variant` (`user_id`,`builtin_key`);--> statement-breakpoint
CREATE INDEX `game_variant_group_idx` ON `game_variant` (`group_id`);--> statement-breakpoint
INSERT INTO `game_variant` (
	`id`, `user_id`, `builtin_key`, `label`, `short_label`, `group_id`,
	`sort_order`, `archived_at`, `created_at`, `updated_at`
) SELECT
	`id`, `user_id`, `builtin_key`, `label`, `short_label`, `group_id`,
	`sort_order`, NULL, `created_at`, `updated_at`
FROM `__stage_0065_game_variant`;--> statement-breakpoint

INSERT INTO `game_mix_variant` (`mix_id`, `variant_id`, `user_id`, `position`)
SELECT `mix_id`, `variant_id`, `user_id`, `position`
FROM `__stage_0065_game_mix_variant`;--> statement-breakpoint
INSERT INTO `game_lineup_variant` (
	`user_id`, `lineup_id`, `lineup_group_id`, `variant_id`, `position`
) SELECT `user_id`, `lineup_id`, `lineup_group_id`, `variant_id`, `position`
FROM `__stage_0065_game_lineup_variant`;--> statement-breakpoint
UPDATE `hand` SET `variant_id` = (
	SELECT `s`.`variant_id` FROM `__stage_0065_hand_variant` AS `s`
	WHERE `s`.`id` = `hand`.`id`
)
WHERE `id` IN (SELECT `id` FROM `__stage_0065_hand_variant`);--> statement-breakpoint

INSERT INTO `__gate_0065` (`variant_rows_restored`) SELECT NULL WHERE EXISTS (
	SELECT `id`, `user_id`, `builtin_key`, `label`, `short_label`, `group_id`,
		`sort_order`, `created_at`, `updated_at`
	FROM `__stage_0065_game_variant`
	EXCEPT
	SELECT `id`, `user_id`, `builtin_key`, `label`, `short_label`, `group_id`,
		`sort_order`, `created_at`, `updated_at`
	FROM `game_variant`
) OR EXISTS (
	SELECT `id`, `user_id`, `builtin_key`, `label`, `short_label`, `group_id`,
		`sort_order`, `created_at`, `updated_at`
	FROM `game_variant`
	EXCEPT
	SELECT `id`, `user_id`, `builtin_key`, `label`, `short_label`, `group_id`,
		`sort_order`, `created_at`, `updated_at`
	FROM `__stage_0065_game_variant`
);--> statement-breakpoint
INSERT INTO `__gate_0065` (`mix_variants_restored`) SELECT NULL WHERE EXISTS (
	SELECT `mix_id`, `variant_id`, `user_id`, `position` FROM `__stage_0065_game_mix_variant`
	EXCEPT
	SELECT `mix_id`, `variant_id`, `user_id`, `position` FROM `game_mix_variant`
) OR EXISTS (
	SELECT `mix_id`, `variant_id`, `user_id`, `position` FROM `game_mix_variant`
	EXCEPT
	SELECT `mix_id`, `variant_id`, `user_id`, `position` FROM `__stage_0065_game_mix_variant`
);--> statement-breakpoint
INSERT INTO `__gate_0065` (`lineup_variants_restored`) SELECT NULL WHERE EXISTS (
	SELECT `user_id`, `lineup_id`, `lineup_group_id`, `variant_id`, `position`
	FROM `__stage_0065_game_lineup_variant`
	EXCEPT
	SELECT `user_id`, `lineup_id`, `lineup_group_id`, `variant_id`, `position`
	FROM `game_lineup_variant`
) OR EXISTS (
	SELECT `user_id`, `lineup_id`, `lineup_group_id`, `variant_id`, `position`
	FROM `game_lineup_variant`
	EXCEPT
	SELECT `user_id`, `lineup_id`, `lineup_group_id`, `variant_id`, `position`
	FROM `__stage_0065_game_lineup_variant`
);--> statement-breakpoint
INSERT INTO `__gate_0065` (`hand_links_restored`) SELECT NULL WHERE EXISTS (
	SELECT `id`, `user_id`, `variant_id` FROM `__stage_0065_hand_variant`
	EXCEPT
	SELECT `id`, `user_id`, `variant_id` FROM `hand` WHERE `variant_id` IS NOT NULL
) OR EXISTS (
	SELECT `id`, `user_id`, `variant_id` FROM `hand` WHERE `variant_id` IS NOT NULL
	EXCEPT
	SELECT `id`, `user_id`, `variant_id` FROM `__stage_0065_hand_variant`
);--> statement-breakpoint
INSERT INTO `__gate_0065` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM pragma_foreign_key_check
);--> statement-breakpoint

DROP TABLE `__stage_0065_hand_variant`;--> statement-breakpoint
DROP TABLE `__stage_0065_game_lineup_variant`;--> statement-breakpoint
DROP TABLE `__stage_0065_game_mix_variant`;--> statement-breakpoint
DROP TABLE `__stage_0065_game_variant`;--> statement-breakpoint
DROP TABLE `__gate_0065`;
