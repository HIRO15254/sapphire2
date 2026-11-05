CREATE TABLE `__stage_0073_preset` AS SELECT * FROM `filter_preset`;--> statement-breakpoint
CREATE TABLE `__gate_0073` (
  `rows_preserved` integer DEFAULT 1 NOT NULL,
  `payload_valid` integer DEFAULT 1 NOT NULL,
  `foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
CREATE TABLE `__new_filter_preset` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `screen_key` text NOT NULL,
  `name` text NOT NULL,
  `payload` text NOT NULL,
  `is_default` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT "filterPreset_payload_json_check" CHECK(json_valid("payload"))
);--> statement-breakpoint
INSERT INTO `__new_filter_preset` (`id`, `user_id`, `screen_key`, `name`, `payload`, `is_default`, `created_at`, `updated_at`)
WITH source AS (
  SELECT *, CASE WHEN json_valid(payload) THEN CASE WHEN json_type(payload) = 'object' THEN payload ELSE '{}' END ELSE '{}' END AS p
  FROM `__stage_0073_preset`
), extracted AS (
  SELECT *,
    CASE WHEN json_type(p, '$.period') = 'text' AND length(json_extract(p, '$.period')) BETWEEN 1 AND 30 THEN json_extract(p, '$.period') END AS period,
    CASE WHEN json_type(p, '$.from') = 'integer' THEN strftime('%Y-%m-%d', json_extract(p, '$.from'), 'unixepoch') END AS date_from,
    CASE WHEN json_type(p, '$.to') = 'integer' THEN strftime('%Y-%m-%d', json_extract(p, '$.to'), 'unixepoch') END AS date_to,
    CASE json_extract(p, '$.type') WHEN 'cash_game' THEN 'cash' WHEN 'tournament' THEN 'tournament' END AS kind,
    CASE WHEN screen_key = 'sessions' THEN json_extract(p, '$.roomId') ELSE json_extract(p, '$.room') END AS room_id,
    CASE WHEN screen_key = 'sessions' THEN json_extract(p, '$.currencyId') ELSE json_extract(p, '$.currency') END AS asset_id,
    CASE WHEN screen_key = 'sessions' THEN json_extract(p, '$.display') ELSE json_extract(p, '$.norm') END AS mode
  FROM source
), resolved AS (
  SELECT *,
    CASE WHEN EXISTS (SELECT 1 FROM room r WHERE r.id = room_id AND r.user_id = extracted.user_id) THEN room_id END AS valid_room,
    CASE WHEN EXISTS (SELECT 1 FROM asset a WHERE a.id = asset_id AND a.user_id = extracted.user_id) THEN asset_id END AS valid_asset
  FROM extracted
), fields AS (
  SELECT *, json_patch('{}', json_object(
    'period', period,
    'dateFrom', CASE WHEN date_from IS NULL OR date_to IS NULL OR date_from <= date_to THEN date_from END,
    'dateTo', CASE WHEN date_from IS NULL OR date_to IS NULL OR date_from <= date_to THEN date_to END,
    'kind', kind,
    'roomId', valid_room,
    'assetId', CASE WHEN mode = 'normalized' OR (screen_key = 'statistics' AND (mode IS NULL OR mode <> 'off')) THEN NULL ELSE valid_asset END
  )) AS base
  FROM resolved
)
SELECT id, user_id, screen_key, name,
  CASE
    WHEN screen_key = 'statistics' AND (mode IS NULL OR mode <> 'off' OR valid_asset IS NULL) THEN json_set(base, '$.normalized', json('true'))
    WHEN screen_key = 'statistics' OR mode = 'currency' THEN json_set(base, '$.normalized', json('false'))
    WHEN mode = 'normalized' THEN json_set(base, '$.normalized', json('true'))
    ELSE base
  END,
  is_default, created_at, updated_at
FROM fields;--> statement-breakpoint
INSERT INTO `__gate_0073` (`rows_preserved`) SELECT NULL WHERE
  (SELECT count(*) FROM `__stage_0073_preset`) <> (SELECT count(*) FROM `__new_filter_preset`)
  OR EXISTS (SELECT id, user_id, screen_key, name, is_default, created_at, updated_at FROM `__stage_0073_preset` EXCEPT SELECT id, user_id, screen_key, name, is_default, created_at, updated_at FROM `__new_filter_preset`);--> statement-breakpoint
INSERT INTO `__gate_0073` (`payload_valid`) SELECT NULL WHERE EXISTS (
  SELECT 1 FROM `__new_filter_preset` WHERE json_type(payload) <> 'object'
    OR screen_key NOT IN ('sessions', 'statistics')
    OR EXISTS (SELECT 1 FROM json_each(payload) WHERE key IN ('from', 'to', 'type', 'currencyId', 'currency', 'room', 'display', 'norm'))
    OR json_extract(payload, '$.kind') IN ('cash_game', 'all')
    OR (screen_key = 'statistics' AND NOT (
      (json_type(payload, '$.normalized') = 'true' AND json_type(payload, '$.assetId') IS NULL)
      OR (json_type(payload, '$.normalized') = 'false' AND json_type(payload, '$.assetId') = 'text')
    ))
);--> statement-breakpoint
DROP TABLE `filter_preset`;--> statement-breakpoint
ALTER TABLE `__new_filter_preset` RENAME TO `filter_preset`;--> statement-breakpoint
CREATE INDEX `filterPreset_userId_idx` ON `filter_preset` (`user_id`);--> statement-breakpoint
CREATE INDEX `filterPreset_userId_screenKey_idx` ON `filter_preset` (`user_id`,`screen_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `filterPreset_userId_screenKey_name_idx` ON `filter_preset` (`user_id`,`screen_key`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `filterPreset_userId_screenKey_defaultUnique_idx` ON `filter_preset` (`user_id`,`screen_key`) WHERE "filter_preset"."is_default" = 1;--> statement-breakpoint
INSERT INTO `__gate_0073` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check('filter_preset'));--> statement-breakpoint
DROP TABLE `__stage_0073_preset`;--> statement-breakpoint
DROP TABLE `__gate_0073`;
