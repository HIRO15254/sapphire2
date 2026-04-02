CREATE TABLE `tournament_chip_purchase` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`name` text NOT NULL,
	`cost` integer NOT NULL,
	`chips` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tournamentChipPurchase_tournamentId_idx` ON `tournament_chip_purchase` (`tournament_id`);--> statement-breakpoint
INSERT INTO `tournament_chip_purchase` (`id`, `tournament_id`, `name`, `cost`, `chips`, `sort_order`)
SELECT lower(hex(randomblob(16))), `id`, 'Rebuy', COALESCE(`rebuy_cost`, 0), COALESCE(`rebuy_chips`, 0), 0
FROM `tournament` WHERE `rebuy_allowed` = 1;--> statement-breakpoint
INSERT INTO `tournament_chip_purchase` (`id`, `tournament_id`, `name`, `cost`, `chips`, `sort_order`)
SELECT lower(hex(randomblob(16))), `id`, 'Addon', COALESCE(`addon_cost`, 0), COALESCE(`addon_chips`, 0), 1
FROM `tournament` WHERE `addon_allowed` = 1;--> statement-breakpoint
ALTER TABLE `tournament` DROP COLUMN `rebuy_allowed`;--> statement-breakpoint
ALTER TABLE `tournament` DROP COLUMN `rebuy_cost`;--> statement-breakpoint
ALTER TABLE `tournament` DROP COLUMN `rebuy_chips`;--> statement-breakpoint
ALTER TABLE `tournament` DROP COLUMN `addon_allowed`;--> statement-breakpoint
ALTER TABLE `tournament` DROP COLUMN `addon_cost`;--> statement-breakpoint
ALTER TABLE `tournament` DROP COLUMN `addon_chips`;