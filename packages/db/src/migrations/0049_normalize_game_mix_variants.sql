-- `wrangler d1 migrations apply` sends this file to D1 statement by statement;
-- there is no file-wide transaction, so a mid-file failure would leave the new
-- objects created while `d1_migrations` still points at 0048. Every statement is
-- therefore written to be re-runnable (`IF NOT EXISTS` / `OR IGNORE`), the
-- backfill below is written so it cannot abort on legacy data, and it rebuilds
-- the junction from scratch so a retry after such a failure heals whatever the
-- still-running old Worker wrote in the meantime rather than merely not
-- breaking.
CREATE UNIQUE INDEX IF NOT EXISTS `game_mix_id_user_id_unique` ON `game_mix` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `game_variant_id_user_id_unique` ON `game_variant` (`id`,`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `game_mix_variant` (
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
CREATE UNIQUE INDEX IF NOT EXISTS `game_mix_variant_mix_position_unique` ON `game_mix_variant` (`mix_id`,`position`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `game_mix_variant_user_mix_position_idx` ON `game_mix_variant` (`user_id`,`mix_id`,`position`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `game_mix_variant_variant_user_idx` ON `game_mix_variant` (`variant_id`,`user_id`);--> statement-breakpoint

-- Backfill the ordered composition of every mix, in legacy array order.
--
-- `game_mix.games` only gained DB-side referential protection in 0041, so rows
-- written before it can still hold duplicate ids, ids of deleted or foreign
-- variants, or malformed JSON — each of which would violate this table's PK,
-- owner FK, or json_each() itself and abort the migration halfway. Because this
-- file is not applied atomically (see the header), an abort would strand the
-- deployment, so the backfill is defensive instead:
--   * malformed / non-array `games` reads as an empty array,
--   * only ids resolving to a variant owned by the SAME user are kept,
--   * a repeated id collapses to its first occurrence,
--   * positions are renumbered densely, so dropping an unusable reference
--     leaves no gap.
-- Anything dropped here was already unusable through the API (the 0041
-- triggers reject writes referencing it). Run the audit queries in
-- `.claude/rules/db-migrations.md` before applying to see exactly which rows
-- this affects.
--
-- The DELETE makes the retry self-healing, not just non-destructive. If a
-- previous attempt died after this backfill but before the compat triggers
-- below existed, `d1_migrations` stayed at 0048, so the old Worker kept serving
-- and kept rewriting `games` with nothing syncing the junction — leaving rows
-- that are simply stale. `INSERT OR IGNORE` alone would top up the missing rows
-- while keeping the stale ones and silently dropping whatever collides on
-- (mix_id, position). Until d1_migrations advances no Worker writes this table,
-- so it is by definition derived from `games` here and rebuilding it wholesale
-- is correct; it also has no dependents, so the DELETE cascades nowhere.
DELETE FROM `game_mix_variant`;--> statement-breakpoint
INSERT OR IGNORE INTO `game_mix_variant` (`mix_id`, `variant_id`, `user_id`, `position`)
SELECT
	`resolved`.`mix_id`,
	`resolved`.`variant_id`,
	`resolved`.`user_id`,
	ROW_NUMBER() OVER (
		PARTITION BY `resolved`.`mix_id` ORDER BY `resolved`.`first_key`
	) - 1
FROM (
	SELECT
		`mix`.`id` AS `mix_id`,
		`mix`.`user_id` AS `user_id`,
		CAST(`game`.`value` AS text) AS `variant_id`,
		MIN(CAST(`game`.`key` AS integer)) AS `first_key`
	FROM `game_mix` AS `mix`
	JOIN json_each(
		CASE
			WHEN json_valid(`mix`.`games`) = 0 THEN '[]'
			WHEN json_type(`mix`.`games`) <> 'array' THEN '[]'
			ELSE `mix`.`games`
		END
	) AS `game`
	JOIN `game_variant` AS `variant`
		ON `variant`.`id` = CAST(`game`.`value` AS text)
		AND `variant`.`user_id` = `mix`.`user_id`
	WHERE `game`.`type` = 'text'
	GROUP BY `mix`.`id`, `mix`.`user_id`, CAST(`game`.`value` AS text)
) AS `resolved`;--> statement-breakpoint

-- production-deploy.yml applies migrations before deploying the new Worker.
-- Keep the physical legacy column and synchronize old-Worker writes into the
-- normalized rows so the migration window and a Worker rollback remain safe.
-- The new Worker reads game_mix_variant and only updates games as a temporary
-- compatibility mirror; a later contract migration can remove this bridge
-- after every deployed Worker has stopped depending on the JSON column.
--
-- Direction of truth during this expand phase: these triggers rebuild the
-- normalized rows from `games` on every write that touches it, so while they
-- exist the JSON column is the effective derivation source even for the new
-- Worker (which writes the junction rows first and the mirror last). The new
-- Worker's explicit junction writes are still deliberate — they are what keeps
-- it correct once the contract migration drops these triggers — and both paths
-- produce byte-identical rows, which game-mix.test.ts and this migration's
-- tests pin.
--
-- Unlike the backfill above, these triggers are intentionally strict: a live
-- write carrying a duplicate id must fail loudly rather than silently store a
-- composition that differs from its mirror (the 0041 reference triggers, plus
-- assertNoDuplicateGames in the router, already reject every such write).
CREATE TRIGGER IF NOT EXISTS `game_mix_variants_compat_insert`
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
CREATE TRIGGER IF NOT EXISTS `game_mix_variants_compat_update`
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