CREATE TABLE `entry_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entry_tag_id_user_id_unique` ON `entry_tag` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `entry_tag_name_uq` ON `entry_tag` (`user_id`,lower(trim("name")));--> statement-breakpoint
CREATE TABLE `entry_tag_link` (
	`user_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`entry_id`, `tag_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`,`user_id`) REFERENCES `entry`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`,`user_id`) REFERENCES `entry_tag`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entry_tag_link_tag_idx` ON `entry_tag_link` (`tag_id`);--> statement-breakpoint
-- Backfill entry tags from session tags.
-- Tags merge per user by lower(trim(name)) into the oldest (created_at, id); the survivor keeps its id and name.
-- Links follow the merge, only for entries that exist, only within the tag owner, without duplicates.
-- Each gate inserts NULL into its own NOT NULL column of __gate_0070.
CREATE TABLE `__gate_0070` (
	`tags` integer DEFAULT 1 NOT NULL,
	`links` integer DEFAULT 1 NOT NULL,
	`foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
CREATE TABLE `__stage_0070_tag_map` AS
SELECT t.id AS old_id, t.user_id AS user_id,
	first_value(t.id) OVER (PARTITION BY t.user_id, lower(trim(t.name)) ORDER BY t.created_at, t.id) AS new_id
FROM `session_tag` t;--> statement-breakpoint
INSERT INTO `entry_tag` (`id`, `user_id`, `name`, `sort_order`, `created_at`, `updated_at`)
SELECT t.id, t.user_id, t.name,
	ROW_NUMBER() OVER (PARTITION BY t.user_id ORDER BY t.created_at, t.id) - 1,
	t.created_at, t.created_at
FROM `session_tag` t
WHERE t.id IN (SELECT new_id FROM `__stage_0070_tag_map`);--> statement-breakpoint
INSERT INTO `entry_tag_link` (`user_id`, `entry_id`, `tag_id`)
SELECT DISTINCT e.user_id, e.id, m.new_id
FROM `session_to_session_tag` l
JOIN `__stage_0070_tag_map` m ON m.old_id = l.session_tag_id
JOIN `entry` e ON e.id = l.session_id AND e.user_id = m.user_id;--> statement-breakpoint
-- End checks.
INSERT INTO `__gate_0070` (`tags`) SELECT NULL WHERE
	(SELECT count(*) FROM `entry_tag`) <> (SELECT count(DISTINCT new_id) FROM `__stage_0070_tag_map`)
	OR EXISTS (SELECT 1 FROM `__stage_0070_tag_map` m LEFT JOIN `entry_tag` t ON t.id = m.new_id AND t.user_id = m.user_id WHERE t.id IS NULL);--> statement-breakpoint
INSERT INTO `__gate_0070` (`links`) SELECT NULL WHERE EXISTS (
	SELECT e.user_id, e.id, m.new_id FROM `session_to_session_tag` l
	JOIN `__stage_0070_tag_map` m ON m.old_id = l.session_tag_id
	JOIN `entry` e ON e.id = l.session_id AND e.user_id = m.user_id
	EXCEPT SELECT user_id, entry_id, tag_id FROM `entry_tag_link`
) OR EXISTS (
	SELECT user_id, entry_id, tag_id FROM `entry_tag_link`
	EXCEPT SELECT e.user_id, e.id, m.new_id FROM `session_to_session_tag` l
	JOIN `__stage_0070_tag_map` m ON m.old_id = l.session_tag_id
	JOIN `entry` e ON e.id = l.session_id AND e.user_id = m.user_id
);--> statement-breakpoint
INSERT INTO `__gate_0070` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check('entry_tag'))
	OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('entry_tag_link'));--> statement-breakpoint
DROP TABLE `__stage_0070_tag_map`;--> statement-breakpoint
DROP TABLE `__gate_0070`;