CREATE UNIQUE INDEX `game_mix_id_user_id_unique` ON `game_mix` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_variant_id_user_id_unique` ON `game_variant` (`id`,`user_id`);--> statement-breakpoint
CREATE TABLE `game_mix_variant` (
	`mix_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`mix_id`, `variant_id`),
	FOREIGN KEY (`mix_id`,`user_id`) REFERENCES `game_mix`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`,`user_id`) REFERENCES `game_variant`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "game_mix_variant_position_nonnegative" CHECK("game_mix_variant"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_mix_variant_mix_position_unique` ON `game_mix_variant` (`mix_id`,`position`);--> statement-breakpoint
CREATE INDEX `game_mix_variant_user_mix_position_idx` ON `game_mix_variant` (`user_id`,`mix_id`,`position`);--> statement-breakpoint
CREATE INDEX `game_mix_variant_variant_user_idx` ON `game_mix_variant` (`variant_id`,`user_id`);--> statement-breakpoint

-- Preserve every ordered game reference. json_each.key is the zero-based
-- array position, so the normalized association retains exact display order.
INSERT INTO `game_mix_variant` (`mix_id`, `variant_id`, `user_id`, `position`)
SELECT
	`mix`.`id`,
	CAST(`game`.`value` AS text),
	`mix`.`user_id`,
	CAST(`game`.`key` AS integer)
FROM `game_mix` AS `mix`, json_each(`mix`.`games`) AS `game`
ORDER BY `mix`.`id`, CAST(`game`.`key` AS integer);--> statement-breakpoint

-- production-deploy.yml applies migrations before deploying the new Worker.
-- Keep the physical legacy column and synchronize old-Worker writes into the
-- normalized rows so the migration window and a Worker rollback remain safe.
-- The new Worker reads game_mix_variant and only updates games as a temporary
-- compatibility mirror; a later contract migration can remove this bridge
-- after every deployed Worker has stopped depending on the JSON column.
CREATE TRIGGER `game_mix_variants_compat_insert`
AFTER INSERT ON `game_mix`
BEGIN
	DELETE FROM `game_mix_variant`
	WHERE `mix_id` = NEW.`id`;
	INSERT INTO `game_mix_variant` (`mix_id`, `variant_id`, `user_id`, `position`)
	SELECT
		NEW.`id`,
		CAST(`game`.`value` AS text),
		NEW.`user_id`,
		CAST(`game`.`key` AS integer)
	FROM json_each(NEW.`games`) AS `game`;
END;--> statement-breakpoint
CREATE TRIGGER `game_mix_variants_compat_update`
AFTER UPDATE OF `id`, `user_id`, `games` ON `game_mix`
BEGIN
	DELETE FROM `game_mix_variant`
	WHERE `mix_id` = OLD.`id`;
	INSERT INTO `game_mix_variant` (`mix_id`, `variant_id`, `user_id`, `position`)
	SELECT
		NEW.`id`,
		CAST(`game`.`value` AS text),
		NEW.`user_id`,
		CAST(`game`.`key` AS integer)
	FROM json_each(NEW.`games`) AS `game`;
END;