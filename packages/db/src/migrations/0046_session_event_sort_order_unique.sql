WITH `renumbered` AS MATERIALIZED (
	SELECT
		`id`,
		ROW_NUMBER() OVER (
			PARTITION BY `session_id`
			ORDER BY `occurred_at` ASC, `sort_order` ASC, `created_at` ASC, `id` ASC
		) - 1 AS `new_sort_order`
	FROM `session_event`
)
UPDATE `session_event`
SET `sort_order` = (
	SELECT `new_sort_order`
	FROM `renumbered`
	WHERE `renumbered`.`id` = `session_event`.`id`
);
--> statement-breakpoint
DROP INDEX `sessionEvent_sessionId_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `sessionEvent_sessionId_sortOrder_idx` ON `session_event` (`session_id`,`sort_order`);