CREATE TABLE `hand_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hand_tag_id_user_id_unique` ON `hand_tag` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `hand_tag_name_uq` ON `hand_tag` (`user_id`,lower(trim("name")));--> statement-breakpoint
CREATE TABLE `hand_tag_link` (
	`user_id` text NOT NULL,
	`hand_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`reviewed_at` integer,
	PRIMARY KEY(`hand_id`, `tag_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hand_id`,`user_id`) REFERENCES `hand`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`,`user_id`) REFERENCES `hand_tag`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hand_tag_link_tag_idx` ON `hand_tag_link` (`tag_id`);--> statement-breakpoint
CREATE TABLE `player_tag_link` (
	`user_id` text NOT NULL,
	`player_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`player_id`, `tag_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`,`user_id`) REFERENCES `player`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`,`user_id`) REFERENCES `player_tag`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_tag_link_tag_idx` ON `player_tag_link` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tournament_tag_def` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_tag_id_user_id_unique` ON `tournament_tag_def` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_tag_name_uq` ON `tournament_tag_def` (`user_id`,lower(trim("name")));--> statement-breakpoint
CREATE TABLE `tournament_tag_link` (
	`user_id` text NOT NULL,
	`tournament_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`tournament_id`, `tag_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`,`user_id`) REFERENCES `tournament`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`,`user_id`) REFERENCES `tournament_tag_def`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tournament_tag_link_tag_idx` ON `tournament_tag_link` (`tag_id`);--> statement-breakpoint
DROP INDEX `playerTag_userId_idx`;--> statement-breakpoint
ALTER TABLE `player_tag` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill tournament and player tags.
-- Tournament tags become one tag per user and lower(trim(name)), with id 'tt:' || user_id || ':' || hex(lower(trim(name)))
-- and the oldest (created_at, id) spelling; every tournament keeps a link to each of its names.
-- Player tags merge per user by lower(trim(name)) into the oldest (created_at, id), which keeps its id and color.
-- Player links follow the merge only within the tag owner, keep the smallest position, and the retired
-- player_to_player_tag rows are repointed to the survivors before the merged tags are deleted.
-- Each gate inserts NULL into its own NOT NULL column of __gate_0072.
CREATE TABLE `__gate_0072` (
	`tournament_tags` integer DEFAULT 1 NOT NULL,
	`tournament_links` integer DEFAULT 1 NOT NULL,
	`player_tags` integer DEFAULT 1 NOT NULL,
	`player_links` integer DEFAULT 1 NOT NULL,
	`retired_player_links` integer DEFAULT 1 NOT NULL,
	`foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
CREATE TABLE `__stage_0072_tournament_tag` AS
SELECT tt.id AS old_id, t.user_id AS user_id, tt.tournament_id AS tournament_id, tt.name AS name, tt.created_at AS created_at,
	'tt:' || t.user_id || ':' || hex(lower(trim(tt.name))) AS new_id
FROM `tournament_tag` tt
JOIN `tournament` t ON t.id = tt.tournament_id;--> statement-breakpoint
INSERT INTO `tournament_tag_def` (`id`, `user_id`, `name`, `sort_order`, `created_at`, `updated_at`)
SELECT s.new_id, s.user_id, s.name,
	ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.created_at, s.old_id) - 1,
	s.created_at, s.created_at
FROM (
	SELECT new_id, user_id, name, created_at, old_id,
		ROW_NUMBER() OVER (PARTITION BY new_id ORDER BY created_at, old_id) AS spelling_rank
	FROM `__stage_0072_tournament_tag`
) s
WHERE s.spelling_rank = 1;--> statement-breakpoint
INSERT INTO `tournament_tag_link` (`user_id`, `tournament_id`, `tag_id`)
SELECT DISTINCT user_id, tournament_id, new_id FROM `__stage_0072_tournament_tag`;--> statement-breakpoint
CREATE TABLE `__stage_0072_player_tag_map` AS
SELECT t.id AS old_id, t.user_id AS user_id,
	first_value(t.id) OVER (PARTITION BY t.user_id, lower(trim(t.name)) ORDER BY t.created_at, t.id) AS new_id
FROM `player_tag` t;--> statement-breakpoint
INSERT INTO `player_tag_link` (`user_id`, `player_id`, `tag_id`, `position`)
SELECT p.user_id, p.id, m.new_id, min(l.position)
FROM `player_to_player_tag` l
JOIN `__stage_0072_player_tag_map` m ON m.old_id = l.player_tag_id
JOIN `player` p ON p.id = l.player_id AND p.user_id = m.user_id
GROUP BY p.user_id, p.id, m.new_id;--> statement-breakpoint
-- End checks against the untouched sources.
INSERT INTO `__gate_0072` (`tournament_tags`) SELECT NULL WHERE
	(SELECT count(*) FROM `tournament_tag_def`) <> (SELECT count(DISTINCT new_id) FROM `__stage_0072_tournament_tag`)
	OR EXISTS (
		SELECT 1 FROM `__stage_0072_tournament_tag` s
		LEFT JOIN `tournament_tag_def` d ON d.id = s.new_id AND d.user_id = s.user_id
		WHERE d.id IS NULL
	)
	OR EXISTS (
		SELECT 1 FROM `tournament_tag_def` d
		WHERE d.name IS NOT (
			SELECT s.name FROM `__stage_0072_tournament_tag` s
			WHERE s.new_id = d.id ORDER BY s.created_at, s.old_id LIMIT 1
		)
	);--> statement-breakpoint
INSERT INTO `__gate_0072` (`tournament_links`) SELECT NULL WHERE EXISTS (
	SELECT user_id, tournament_id, new_id FROM `__stage_0072_tournament_tag`
	EXCEPT SELECT user_id, tournament_id, tag_id FROM `tournament_tag_link`
) OR EXISTS (
	SELECT user_id, tournament_id, tag_id FROM `tournament_tag_link`
	EXCEPT SELECT user_id, tournament_id, new_id FROM `__stage_0072_tournament_tag`
);--> statement-breakpoint
INSERT INTO `__gate_0072` (`player_links`) SELECT NULL WHERE EXISTS (
	SELECT p.user_id, p.id, m.new_id FROM `player_to_player_tag` l
	JOIN `__stage_0072_player_tag_map` m ON m.old_id = l.player_tag_id
	JOIN `player` p ON p.id = l.player_id AND p.user_id = m.user_id
	EXCEPT SELECT user_id, player_id, tag_id FROM `player_tag_link`
) OR EXISTS (
	SELECT user_id, player_id, tag_id FROM `player_tag_link`
	EXCEPT SELECT p.user_id, p.id, m.new_id FROM `player_to_player_tag` l
	JOIN `__stage_0072_player_tag_map` m ON m.old_id = l.player_tag_id
	JOIN `player` p ON p.id = l.player_id AND p.user_id = m.user_id
);--> statement-breakpoint
UPDATE OR IGNORE `player_to_player_tag`
SET `player_tag_id` = (SELECT m.new_id FROM `__stage_0072_player_tag_map` m WHERE m.old_id = `player_to_player_tag`.`player_tag_id`)
WHERE `player_tag_id` IN (SELECT old_id FROM `__stage_0072_player_tag_map` WHERE old_id <> new_id);--> statement-breakpoint
DELETE FROM `player_tag` WHERE `id` IN (SELECT old_id FROM `__stage_0072_player_tag_map` WHERE old_id <> new_id);--> statement-breakpoint
UPDATE `player_tag` SET `sort_order` = r.position
FROM (
	SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) - 1 AS position FROM `player_tag`
) r
WHERE r.id = `player_tag`.`id`;--> statement-breakpoint
CREATE UNIQUE INDEX `player_tag_name_uq` ON `player_tag` (`user_id`,lower(trim("name")));--> statement-breakpoint
INSERT INTO `__gate_0072` (`player_tags`) SELECT NULL WHERE
	(SELECT count(*) FROM `player_tag`) <> (SELECT count(DISTINCT new_id) FROM `__stage_0072_player_tag_map`)
	OR EXISTS (
		SELECT 1 FROM `__stage_0072_player_tag_map` m
		LEFT JOIN `player_tag` t ON t.id = m.new_id AND t.user_id = m.user_id
		WHERE t.id IS NULL
	);--> statement-breakpoint
INSERT INTO `__gate_0072` (`retired_player_links`) SELECT NULL WHERE EXISTS (
	SELECT p.user_id, p.id, l.player_tag_id FROM `player_to_player_tag` l
	JOIN `player_tag` t ON t.id = l.player_tag_id
	JOIN `player` p ON p.id = l.player_id AND p.user_id = t.user_id
	EXCEPT SELECT user_id, player_id, tag_id FROM `player_tag_link`
) OR EXISTS (
	SELECT user_id, player_id, tag_id FROM `player_tag_link`
	EXCEPT SELECT p.user_id, p.id, l.player_tag_id FROM `player_to_player_tag` l
	JOIN `player_tag` t ON t.id = l.player_tag_id
	JOIN `player` p ON p.id = l.player_id AND p.user_id = t.user_id
);--> statement-breakpoint
INSERT INTO `__gate_0072` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check('tournament_tag_def'))
	OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('tournament_tag_link'))
	OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('player_tag'))
	OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('player_tag_link'))
	OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('player_to_player_tag'))
	OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('hand_tag'))
	OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('hand_tag_link'));--> statement-breakpoint
DROP TABLE `__stage_0072_tournament_tag`;--> statement-breakpoint
DROP TABLE `__stage_0072_player_tag_map`;--> statement-breakpoint
DROP TABLE `__gate_0072`;