CREATE TABLE `__gate_0081` (
 `values_valid` integer DEFAULT 1 NOT NULL,
 `rows_restored` integer DEFAULT 1 NOT NULL,
 `links_restored` integer DEFAULT 1 NOT NULL,
 `foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
INSERT INTO `__gate_0081` (`values_valid`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `room` WHERE `is_favorite` NOT IN (0, 1) OR (`latitude` IS NULL) <> (`longitude` IS NULL)
) OR EXISTS (
 SELECT 1 FROM `player` WHERE `is_temporary` NOT IN (0, 1)
);--> statement-breakpoint
CREATE TABLE `__stage_0081_room` AS SELECT `id`, `user_id`, `name`, `memo`, `is_favorite`, `latitude`, `longitude`, `archived_at`, `created_at`, `updated_at` FROM `room`;--> statement-breakpoint
CREATE TABLE `__stage_0081_player` AS SELECT `id`, `user_id`, `name`, `memo`, `is_temporary`, `is_self`, `created_at`, `updated_at` FROM `player`;--> statement-breakpoint
CREATE TABLE `__stage_0081_entry_room` AS SELECT `id`, `room_id` FROM `entry` WHERE `room_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__stage_0081_tournament_room` AS SELECT `id`, `room_id` FROM `tournament` WHERE `room_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__stage_0081_ring_game_room` AS SELECT `id`, `room_id` FROM `ring_game` WHERE `room_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__stage_0081_hand_seat_player` AS SELECT `hand_id`, `seat`, `player_id` FROM `hand_seat` WHERE `player_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__stage_0081_player_tag_link` AS SELECT `user_id`, `player_id`, `tag_id`, `position` FROM `player_tag_link`;--> statement-breakpoint
UPDATE `entry` SET `room_id` = NULL WHERE `room_id` IS NOT NULL;--> statement-breakpoint
UPDATE `tournament` SET `room_id` = NULL WHERE `room_id` IS NOT NULL;--> statement-breakpoint
UPDATE `ring_game` SET `room_id` = NULL WHERE `room_id` IS NOT NULL;--> statement-breakpoint
UPDATE `hand_seat` SET `player_id` = NULL WHERE `player_id` IS NOT NULL;--> statement-breakpoint
DELETE FROM `player_tag_link`;--> statement-breakpoint
DROP TABLE `room`;--> statement-breakpoint
DROP TABLE `player`;--> statement-breakpoint
CREATE TABLE `room` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`memo` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`latitude` real,
	`longitude` real,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "room_is_favorite_check" CHECK("room"."is_favorite" IN (0, 1)),
	CONSTRAINT "room_coordinates_pair_check" CHECK(("room"."latitude" IS NULL) = ("room"."longitude" IS NULL))
);--> statement-breakpoint
CREATE UNIQUE INDEX `room_id_user_id_unique` ON `room` (`id`,`user_id`);--> statement-breakpoint
CREATE INDEX `room_userId_idx` ON `room` (`user_id`);--> statement-breakpoint
INSERT INTO `room` (`id`, `user_id`, `name`, `memo`, `is_favorite`, `latitude`, `longitude`, `archived_at`, `created_at`, `updated_at`)
SELECT `id`, `user_id`, `name`, `memo`, `is_favorite`, `latitude`, `longitude`, `archived_at`, `created_at`, `updated_at` FROM `__stage_0081_room`;--> statement-breakpoint
CREATE TABLE `player` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`memo` text,
	`is_temporary` integer DEFAULT false NOT NULL,
	`is_self` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "player_is_temporary_check" CHECK("player"."is_temporary" IN (0, 1)),
	CONSTRAINT "player_is_self_check" CHECK("player"."is_self" IN (0, 1))
);--> statement-breakpoint
CREATE UNIQUE INDEX `player_id_user_id_unique` ON `player` (`id`,`user_id`);--> statement-breakpoint
CREATE INDEX `player_userId_idx` ON `player` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_self_uq` ON `player` (`user_id`) WHERE "player"."is_self" = 1;--> statement-breakpoint
INSERT INTO `player` (`id`, `user_id`, `name`, `memo`, `is_temporary`, `is_self`, `created_at`, `updated_at`)
SELECT `id`, `user_id`, `name`, `memo`, `is_temporary`, `is_self`, `created_at`, `updated_at` FROM `__stage_0081_player`;--> statement-breakpoint
UPDATE `entry` SET `room_id` = (SELECT `s`.`room_id` FROM `__stage_0081_entry_room` AS `s` WHERE `s`.`id` = `entry`.`id`) WHERE `id` IN (SELECT `id` FROM `__stage_0081_entry_room`);--> statement-breakpoint
UPDATE `tournament` SET `room_id` = (SELECT `s`.`room_id` FROM `__stage_0081_tournament_room` AS `s` WHERE `s`.`id` = `tournament`.`id`) WHERE `id` IN (SELECT `id` FROM `__stage_0081_tournament_room`);--> statement-breakpoint
UPDATE `ring_game` SET `room_id` = (SELECT `s`.`room_id` FROM `__stage_0081_ring_game_room` AS `s` WHERE `s`.`id` = `ring_game`.`id`) WHERE `id` IN (SELECT `id` FROM `__stage_0081_ring_game_room`);--> statement-breakpoint
UPDATE `hand_seat` SET `player_id` = (SELECT `s`.`player_id` FROM `__stage_0081_hand_seat_player` AS `s` WHERE `s`.`hand_id` = `hand_seat`.`hand_id` AND `s`.`seat` = `hand_seat`.`seat`) WHERE EXISTS (SELECT 1 FROM `__stage_0081_hand_seat_player` AS `s` WHERE `s`.`hand_id` = `hand_seat`.`hand_id` AND `s`.`seat` = `hand_seat`.`seat`);--> statement-breakpoint
INSERT INTO `player_tag_link` (`user_id`, `player_id`, `tag_id`, `position`) SELECT `user_id`, `player_id`, `tag_id`, `position` FROM `__stage_0081_player_tag_link`;--> statement-breakpoint
INSERT INTO `__gate_0081` (`rows_restored`) SELECT NULL WHERE EXISTS (
 SELECT `id`, `user_id`, `name`, `memo`, `is_favorite`, `latitude`, `longitude`, `archived_at`, `created_at`, `updated_at` FROM `__stage_0081_room`
 EXCEPT SELECT `id`, `user_id`, `name`, `memo`, `is_favorite`, `latitude`, `longitude`, `archived_at`, `created_at`, `updated_at` FROM `room`
) OR (SELECT count(*) FROM `room`) <> (SELECT count(*) FROM `__stage_0081_room`)
 OR EXISTS (
 SELECT `id`, `user_id`, `name`, `memo`, `is_temporary`, `is_self`, `created_at`, `updated_at` FROM `__stage_0081_player`
 EXCEPT SELECT `id`, `user_id`, `name`, `memo`, `is_temporary`, `is_self`, `created_at`, `updated_at` FROM `player`
) OR (SELECT count(*) FROM `player`) <> (SELECT count(*) FROM `__stage_0081_player`);--> statement-breakpoint
INSERT INTO `__gate_0081` (`links_restored`) SELECT NULL WHERE EXISTS (SELECT `id`, `room_id` FROM `__stage_0081_entry_room` EXCEPT SELECT `id`, `room_id` FROM `entry` WHERE `room_id` IS NOT NULL)
 OR (SELECT count(*) FROM `entry` WHERE `room_id` IS NOT NULL) <> (SELECT count(*) FROM `__stage_0081_entry_room`)
 OR EXISTS (SELECT `id`, `room_id` FROM `__stage_0081_tournament_room` EXCEPT SELECT `id`, `room_id` FROM `tournament` WHERE `room_id` IS NOT NULL)
 OR (SELECT count(*) FROM `tournament` WHERE `room_id` IS NOT NULL) <> (SELECT count(*) FROM `__stage_0081_tournament_room`)
 OR EXISTS (SELECT `id`, `room_id` FROM `__stage_0081_ring_game_room` EXCEPT SELECT `id`, `room_id` FROM `ring_game` WHERE `room_id` IS NOT NULL)
 OR (SELECT count(*) FROM `ring_game` WHERE `room_id` IS NOT NULL) <> (SELECT count(*) FROM `__stage_0081_ring_game_room`)
 OR EXISTS (SELECT `hand_id`, `seat`, `player_id` FROM `__stage_0081_hand_seat_player` EXCEPT SELECT `hand_id`, `seat`, `player_id` FROM `hand_seat` WHERE `player_id` IS NOT NULL)
 OR (SELECT count(*) FROM `hand_seat` WHERE `player_id` IS NOT NULL) <> (SELECT count(*) FROM `__stage_0081_hand_seat_player`)
 OR EXISTS (SELECT `user_id`, `player_id`, `tag_id`, `position` FROM `__stage_0081_player_tag_link` EXCEPT SELECT `user_id`, `player_id`, `tag_id`, `position` FROM `player_tag_link`)
 OR (SELECT count(*) FROM `player_tag_link`) <> (SELECT count(*) FROM `__stage_0081_player_tag_link`);--> statement-breakpoint
INSERT INTO `__gate_0081` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check);--> statement-breakpoint
DROP TABLE `__stage_0081_room`;--> statement-breakpoint
DROP TABLE `__stage_0081_player`;--> statement-breakpoint
DROP TABLE `__stage_0081_entry_room`;--> statement-breakpoint
DROP TABLE `__stage_0081_tournament_room`;--> statement-breakpoint
DROP TABLE `__stage_0081_ring_game_room`;--> statement-breakpoint
DROP TABLE `__stage_0081_hand_seat_player`;--> statement-breakpoint
DROP TABLE `__stage_0081_player_tag_link`;--> statement-breakpoint
DROP TABLE `__gate_0081`;
