CREATE TABLE `preset_0080_renames` (`id` text PRIMARY KEY, `name` text NOT NULL);--> statement-breakpoint
INSERT INTO `preset_0080_renames` (id, name)
WITH RECURSIVE
ranked AS MATERIALIZED (
 SELECT id, user_id, screen_key, name, created_at,
 row_number() OVER (PARTITION BY user_id, screen_key, lower(name) ORDER BY created_at, id) AS duplicate_rank
 FROM filter_preset
), duplicates AS MATERIALIZED (
 SELECT *, row_number() OVER (ORDER BY created_at, id) AS n FROM ranked WHERE duplicate_rank > 1
), allocation(n, suffix, used, assigned_id, assigned_name) AS (
 SELECT 1, 2, json('[]'), NULL, NULL
 UNION ALL
 SELECT a.n + CASE WHEN EXISTS (SELECT 1 FROM filter_preset p WHERE p.user_id = d.user_id AND p.screen_key = d.screen_key AND p.name = (substr(d.name, 1, 50 - length(' (' || a.suffix || ')')) || ' (' || a.suffix || ')') COLLATE NOCASE)
 OR EXISTS (SELECT 1 FROM json_each(a.used) WHERE value = json_array(d.user_id, d.screen_key, lower(substr(d.name, 1, 50 - length(' (' || a.suffix || ')')) || ' (' || a.suffix || ')'))) THEN 0 ELSE 1 END,
 CASE WHEN EXISTS (SELECT 1 FROM filter_preset p WHERE p.user_id = d.user_id AND p.screen_key = d.screen_key AND p.name = (substr(d.name, 1, 50 - length(' (' || a.suffix || ')')) || ' (' || a.suffix || ')') COLLATE NOCASE)
 OR EXISTS (SELECT 1 FROM json_each(a.used) WHERE value = json_array(d.user_id, d.screen_key, lower(substr(d.name, 1, 50 - length(' (' || a.suffix || ')')) || ' (' || a.suffix || ')'))) THEN a.suffix + 1 ELSE 2 END,
 CASE WHEN EXISTS (SELECT 1 FROM filter_preset p WHERE p.user_id = d.user_id AND p.screen_key = d.screen_key AND p.name = (substr(d.name, 1, 50 - length(' (' || a.suffix || ')')) || ' (' || a.suffix || ')') COLLATE NOCASE)
 OR EXISTS (SELECT 1 FROM json_each(a.used) WHERE value = json_array(d.user_id, d.screen_key, lower(substr(d.name, 1, 50 - length(' (' || a.suffix || ')')) || ' (' || a.suffix || ')'))) THEN a.used ELSE json_insert(a.used, '$[#]', json(json_array(d.user_id, d.screen_key, lower(substr(d.name, 1, 50 - length(' (' || a.suffix || ')')) || ' (' || a.suffix || ')')))) END,
 CASE WHEN EXISTS (SELECT 1 FROM filter_preset p WHERE p.user_id = d.user_id AND p.screen_key = d.screen_key AND p.name = (substr(d.name, 1, 50 - length(' (' || a.suffix || ')')) || ' (' || a.suffix || ')') COLLATE NOCASE)
 OR EXISTS (SELECT 1 FROM json_each(a.used) WHERE value = json_array(d.user_id, d.screen_key, lower(substr(d.name, 1, 50 - length(' (' || a.suffix || ')')) || ' (' || a.suffix || ')'))) THEN NULL ELSE d.id END,
 substr(d.name, 1, 50 - length(' (' || a.suffix || ')')) || ' (' || a.suffix || ')'
 FROM allocation a JOIN duplicates d ON d.n = a.n
)
SELECT assigned_id, assigned_name FROM allocation WHERE assigned_id IS NOT NULL;--> statement-breakpoint
DROP INDEX `filterPreset_userId_screenKey_name_idx`;--> statement-breakpoint
UPDATE filter_preset SET name = (SELECT name FROM preset_0080_renames WHERE id = filter_preset.id) WHERE id IN (SELECT id FROM preset_0080_renames);--> statement-breakpoint
CREATE UNIQUE INDEX `filterPreset_userId_screenKey_name_idx` ON `filter_preset` (`user_id`,`screen_key`,name COLLATE NOCASE);--> statement-breakpoint
CREATE INDEX `play_event_user_player_ref_idx` ON `play_event` (`user_id`,json_extract(payload, '$.playerId'));--> statement-breakpoint
DROP TABLE `preset_0080_renames`;
