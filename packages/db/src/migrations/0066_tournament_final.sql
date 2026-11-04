-- Data model v2, B08 (SA2-393): tournament master and rule backfill.
CREATE TABLE `__gate_0066` (
 `rules_empty` integer DEFAULT 1 NOT NULL,
 `current_rules_valid` integer DEFAULT 1 NOT NULL,
 `stake_coverage` integer DEFAULT 1 NOT NULL,
 `inheritance_valid` integer DEFAULT 1 NOT NULL,
 `lineups_nonempty` integer DEFAULT 1 NOT NULL,
 `master_content` integer DEFAULT 1 NOT NULL,
 `children_restored` integer DEFAULT 1 NOT NULL,
 `foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
INSERT INTO `__gate_0066` (`rules_empty`) SELECT NULL WHERE EXISTS (SELECT 1 FROM `tournament_rule`);--> statement-breakpoint
CREATE TABLE `__stage_0066_tournament` AS SELECT id,user_id,room_id,name,variant,buy_in,entry_fee,starting_stack,bounty_amount,table_size,currency_id,memo,house_rules,archived_at,created_at,updated_at FROM tournament;--> statement-breakpoint
CREATE TABLE `__stage_0066_blind_level` AS SELECT id,tournament_id,level,is_break,blind1,blind2,blind3,ante,minutes,games FROM blind_level;--> statement-breakpoint
CREATE TABLE `__stage_0066_purchase` AS SELECT id,tournament_id,name,cost,chips,sort_order FROM tournament_chip_purchase;--> statement-breakpoint
CREATE TABLE `__stage_0066_tag` AS SELECT id,tournament_id,name,created_at FROM tournament_tag;--> statement-breakpoint
CREATE TABLE `__stage_0066_detail` AS SELECT session_id,tournament_id FROM session_tournament_detail WHERE tournament_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__stage_0066_entry` AS SELECT entry_id,user_id,tournament_id FROM entry_tournament WHERE tournament_id IS NOT NULL;--> statement-breakpoint

CREATE TABLE __stage_0066_json_group AS
SELECT b.id AS blind_level_id, b.tournament_id, t.user_id,
       CAST(g.key AS integer) AS source_position,
       CASE WHEN g.type = 'object' THEN g.value ELSE '{}' END AS object
FROM __stage_0066_blind_level b
JOIN __stage_0066_tournament t ON t.id = b.tournament_id,
json_each(CASE WHEN json_valid(b.games) THEN CASE WHEN json_type(b.games) = 'array' THEN b.games ELSE '[]' END ELSE '[]' END) g
WHERE g.type = 'object';--> statement-breakpoint
CREATE TABLE __stage_0066_json_variant AS
SELECT g.blind_level_id, g.tournament_id, g.user_id, g.source_position,
       CAST(v.key AS integer) AS source_variant_position, trim(v.value) AS label,
       lower(trim(v.value)) AS normalized,
       COALESCE(
         (SELECT x.id FROM game_variant x WHERE x.user_id = g.user_id AND lower(trim(x.label)) = lower(trim(v.value)) ORDER BY x.id LIMIT 1),
         (SELECT x.id FROM game_variant x WHERE x.user_id = g.user_id AND x.builtin_key = lower(trim(v.value)) ORDER BY x.id LIMIT 1)
       ) AS resolved_id
FROM __stage_0066_json_group g,
json_each(CASE WHEN json_type(g.object, '$.variants') = 'array' THEN json_extract(g.object, '$.variants') ELSE '[]' END) v
WHERE v.type = 'text' AND trim(v.value) <> '';--> statement-breakpoint
CREATE TABLE __stage_0066_tournament_resolution AS
SELECT t.id AS tournament_id, t.user_id, trim(t.variant) AS label, lower(trim(t.variant)) AS normalized,
       COALESCE((SELECT v.id FROM game_variant v WHERE v.user_id=t.user_id AND lower(trim(v.label))=lower(trim(t.variant)) ORDER BY v.id LIMIT 1),
                CASE WHEN NOT EXISTS (SELECT 1 FROM game_mix m WHERE m.user_id=t.user_id AND lower(trim(m.label))=lower(trim(t.variant))) THEN
                  (SELECT v.id FROM game_variant v WHERE v.user_id=t.user_id AND v.builtin_key=lower(trim(t.variant)) ORDER BY v.id LIMIT 1) END) AS variant_id,
       COALESCE((SELECT m.id FROM game_mix m WHERE m.user_id=t.user_id AND lower(trim(m.label))=lower(trim(t.variant)) ORDER BY m.id LIMIT 1),
                CASE WHEN NOT EXISTS (SELECT 1 FROM game_variant v WHERE v.user_id=t.user_id AND (lower(trim(v.label))=lower(trim(t.variant)) OR v.builtin_key=lower(trim(t.variant)))) THEN
                  (SELECT m.id FROM game_mix m WHERE m.user_id=t.user_id AND m.builtin_key=lower(trim(t.variant)) ORDER BY m.id LIMIT 1) END) AS mix_id
FROM __stage_0066_tournament t;--> statement-breakpoint
CREATE TABLE __stage_0066_needed_variant AS
SELECT user_id, normalized, label, sibling_group, ROW_NUMBER() OVER (PARTITION BY user_id, normalized ORDER BY priority, tournament_id, level_order, group_order, variant_order) AS occurrence
FROM (
 SELECT j.user_id, j.normalized, j.label, j.tournament_id, b.level AS level_order, j.source_position AS group_order, j.source_variant_position AS variant_order, 0 AS priority,
        (SELECT v.group_id FROM __stage_0066_json_variant s JOIN game_variant v ON v.id=s.resolved_id AND v.user_id=s.user_id
         WHERE s.blind_level_id=j.blind_level_id AND s.user_id=j.user_id AND s.source_position=j.source_position ORDER BY s.source_variant_position LIMIT 1) AS sibling_group
 FROM __stage_0066_json_variant j JOIN __stage_0066_blind_level b ON b.id=j.blind_level_id
 WHERE j.resolved_id IS NULL
 UNION ALL
 SELECT r.user_id, r.normalized, r.label, r.tournament_id, 0, 0, 0, 1, NULL
 FROM __stage_0066_tournament_resolution r
 WHERE r.variant_id IS NULL AND r.mix_id IS NULL AND r.normalized <> 'mix'
   AND NOT EXISTS (SELECT 1 FROM __stage_0066_json_variant j WHERE j.tournament_id=r.tournament_id AND j.user_id=r.user_id)
 UNION ALL
 SELECT r.user_id, 'mixed game', 'Mixed Game', r.tournament_id, 0, 0, 0, 2, NULL
 FROM __stage_0066_tournament_resolution r
 WHERE r.variant_id IS NULL AND r.mix_id IS NULL AND r.normalized='mix'
   AND NOT EXISTS (SELECT 1 FROM __stage_0066_json_variant j WHERE j.tournament_id=r.tournament_id AND j.user_id=r.user_id)
 UNION ALL
 SELECT r.user_id, lower(trim(m.label)), trim(m.label), r.tournament_id, 0, 0, 0, 3, NULL
 FROM __stage_0066_tournament_resolution r JOIN game_mix m ON m.id=r.mix_id AND m.user_id=r.user_id
 WHERE r.variant_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM __stage_0066_json_variant j WHERE j.tournament_id=r.tournament_id AND j.user_id=r.user_id)
   AND NOT EXISTS (SELECT 1 FROM game_mix_variant mv WHERE mv.mix_id=m.id AND mv.user_id=m.user_id)
) candidates;--> statement-breakpoint
INSERT INTO game_group (id,user_id,builtin_key,label,blind1_label,blind2_label,blind3_label,created_at,updated_at)
SELECT DISTINCT n.user_id || ':builtin-group:bigbet', n.user_id, 'bigbet', 'Big Bet', 'SB', 'BB', 'Straddle', unixepoch(), unixepoch()
FROM __stage_0066_needed_variant n
WHERE NOT EXISTS (SELECT 1 FROM game_group g WHERE g.user_id=n.user_id);--> statement-breakpoint
INSERT INTO game_variant (id,user_id,builtin_key,label,short_label,group_id,sort_order,archived_at,created_at,updated_at)
SELECT 'sv:' || n.user_id || ':' || n.normalized, n.user_id, NULL, n.label, NULL,
       COALESCE(n.sibling_group, (SELECT g.id FROM game_group g WHERE g.user_id=n.user_id AND g.builtin_key='bigbet' ORDER BY g.id LIMIT 1),
                (SELECT min(g.id) FROM game_group g WHERE g.user_id=n.user_id)),
       0, unixepoch(), unixepoch(), unixepoch()
FROM __stage_0066_needed_variant n
WHERE n.occurrence=1 AND NOT EXISTS (SELECT 1 FROM game_variant v WHERE v.user_id=n.user_id AND lower(trim(v.label))=n.normalized);--> statement-breakpoint
CREATE TABLE __stage_0066_level_variant AS
WITH resolved AS (
 SELECT j.*, COALESCE(j.resolved_id, v.id) AS variant_id,
        ROW_NUMBER() OVER (PARTITION BY j.blind_level_id, COALESCE(j.resolved_id,v.id) ORDER BY j.source_position,j.source_variant_position) AS duplicate_number
 FROM __stage_0066_json_variant j
 LEFT JOIN game_variant v ON v.user_id=j.user_id AND lower(trim(v.label))=j.normalized
), positions AS (
 SELECT *, DENSE_RANK() OVER (PARTITION BY blind_level_id ORDER BY source_position)-1 AS group_position,
        ROW_NUMBER() OVER (PARTITION BY blind_level_id,source_position ORDER BY source_variant_position)-1 AS position
 FROM resolved WHERE duplicate_number=1
)
SELECT blind_level_id,user_id,group_position,position,variant_id,source_position FROM positions;--> statement-breakpoint
CREATE TABLE __stage_0066_level_group AS
WITH grouped AS (
 SELECT blind_level_id,user_id,source_position,group_position AS position
 FROM __stage_0066_level_variant WHERE position=0
)
SELECT q.blind_level_id,q.user_id,q.position,q.source_position, gv.group_id AS game_group_id,
 CASE WHEN json_type(j.object,'$.name')='text' AND trim(json_extract(j.object,'$.name'))<>''
      AND trim(json_extract(j.object,'$.name'))<>gg.label
      AND NOT (substr(trim(json_extract(j.object,'$.name')),1,length(gg.label)+1)=gg.label || ' '
               AND substr(trim(json_extract(j.object,'$.name')),length(gg.label)+2)<>''
               AND substr(trim(json_extract(j.object,'$.name')),length(gg.label)+2) NOT GLOB '*[^0-9]*')
      THEN trim(json_extract(j.object,'$.name')) END AS name,
 CASE WHEN json_type(j.object,'$.blind1')='integer' AND json_extract(j.object,'$.blind1')>=0 THEN json_extract(j.object,'$.blind1') END AS blind1,
 CASE WHEN json_type(j.object,'$.blind2')='integer' AND json_extract(j.object,'$.blind2')>=0 THEN json_extract(j.object,'$.blind2') END AS blind2,
 CASE WHEN json_type(j.object,'$.blind3')='integer' AND json_extract(j.object,'$.blind3')>=0 THEN json_extract(j.object,'$.blind3') END AS blind3,
 CASE WHEN json_type(j.object,'$.ante')='integer' AND json_extract(j.object,'$.ante')>=0 THEN json_extract(j.object,'$.ante') END AS ante
FROM grouped q JOIN __stage_0066_json_group j ON j.blind_level_id=q.blind_level_id AND j.user_id=q.user_id AND j.source_position=q.source_position
JOIN __stage_0066_level_variant lv ON lv.blind_level_id=q.blind_level_id AND lv.user_id=q.user_id AND lv.group_position=q.position AND lv.position=0
JOIN game_variant gv ON gv.id=lv.variant_id AND gv.user_id=lv.user_id JOIN game_group gg ON gg.id=gv.group_id AND gg.user_id=gv.user_id;--> statement-breakpoint
CREATE TABLE __stage_0066_default_variant AS
WITH candidates AS (
 SELECT r.tournament_id,r.user_id,r.variant_id,0 AS level_order,0 AS group_order,0 AS variant_order
 FROM __stage_0066_tournament_resolution r WHERE r.variant_id IS NOT NULL
 UNION ALL
 SELECT r.tournament_id,r.user_id,lv.variant_id,(SELECT count(*) FROM __stage_0066_blind_level prior WHERE prior.tournament_id=b.tournament_id AND (prior.level<b.level OR (prior.level=b.level AND prior.id<=b.id))),lg.position,lv.position
 FROM __stage_0066_tournament_resolution r JOIN __stage_0066_blind_level b ON b.tournament_id=r.tournament_id
 JOIN __stage_0066_level_group lg ON lg.blind_level_id=b.id AND lg.user_id=r.user_id
 JOIN __stage_0066_level_variant lv ON lv.blind_level_id=lg.blind_level_id AND lv.user_id=lg.user_id AND lv.group_position=lg.position
 WHERE r.variant_id IS NULL
 UNION ALL
 SELECT r.tournament_id,r.user_id,mv.variant_id,0,0,mv.position
 FROM __stage_0066_tournament_resolution r JOIN game_mix_variant mv ON mv.mix_id=r.mix_id AND mv.user_id=r.user_id
 WHERE r.variant_id IS NULL AND NOT EXISTS (SELECT 1 FROM __stage_0066_level_group lg JOIN __stage_0066_blind_level b ON b.id=lg.blind_level_id WHERE b.tournament_id=r.tournament_id AND lg.user_id=r.user_id)
 UNION ALL
 SELECT r.tournament_id,r.user_id,v.id,0,0,0
 FROM __stage_0066_tournament_resolution r JOIN game_variant v ON v.user_id=r.user_id AND lower(trim(v.label))=CASE WHEN r.normalized='mix' AND r.mix_id IS NULL THEN 'mixed game' WHEN r.mix_id IS NOT NULL THEN (SELECT lower(trim(m.label)) FROM game_mix m WHERE m.id=r.mix_id AND m.user_id=r.user_id) ELSE r.normalized END
 WHERE r.variant_id IS NULL AND NOT EXISTS (SELECT 1 FROM __stage_0066_level_group lg JOIN __stage_0066_blind_level b ON b.id=lg.blind_level_id WHERE b.tournament_id=r.tournament_id AND lg.user_id=r.user_id)
 AND NOT EXISTS (SELECT 1 FROM game_mix_variant mv WHERE mv.mix_id=r.mix_id AND mv.user_id=r.user_id)
), unique_variants AS (
 SELECT *, ROW_NUMBER() OVER (PARTITION BY tournament_id,variant_id ORDER BY level_order,group_order,variant_order) AS n FROM candidates
), grouped AS (
 SELECT c.*,v.group_id, MIN(printf('%020d:%020d:%020d',level_order,group_order,variant_order)) OVER (PARTITION BY c.tournament_id,v.group_id) AS first_group
 FROM unique_variants c JOIN game_variant v ON v.id=c.variant_id AND v.user_id=c.user_id WHERE c.n=1
)
SELECT tournament_id,user_id,variant_id,group_id,
 DENSE_RANK() OVER (PARTITION BY tournament_id ORDER BY first_group,group_id)-1 AS group_position,
 ROW_NUMBER() OVER (PARTITION BY tournament_id,group_id ORDER BY level_order,group_order,variant_order,variant_id)-1 AS position
FROM grouped;--> statement-breakpoint
INSERT INTO game_mix (id,user_id,builtin_key,label,games,archived_at,created_at,updated_at)
SELECT 'sm:' || r.user_id || ':' || r.normalized,r.user_id,NULL,r.label,'[]',unixepoch(),unixepoch(),unixepoch()
FROM __stage_0066_tournament_resolution r
WHERE r.variant_id IS NULL AND r.mix_id IS NULL AND r.normalized<>'mix'
 AND EXISTS (SELECT 1 FROM __stage_0066_level_group lg JOIN __stage_0066_blind_level b ON b.id=lg.blind_level_id WHERE b.tournament_id=r.tournament_id AND lg.user_id=r.user_id)
 AND r.tournament_id=(SELECT min(r2.tournament_id) FROM __stage_0066_tournament_resolution r2 WHERE r2.user_id=r.user_id AND r2.normalized=r.normalized AND r2.variant_id IS NULL AND r2.mix_id IS NULL AND EXISTS (SELECT 1 FROM __stage_0066_level_group lg2 JOIN __stage_0066_blind_level b2 ON b2.id=lg2.blind_level_id WHERE b2.tournament_id=r2.tournament_id AND lg2.user_id=r2.user_id));--> statement-breakpoint
INSERT INTO game_mix_variant (mix_id,variant_id,user_id,position)
SELECT 'sm:' || r.user_id || ':' || r.normalized,d.variant_id,r.user_id,
 ROW_NUMBER() OVER (PARTITION BY r.user_id,r.normalized ORDER BY d.group_position,d.position)-1
FROM __stage_0066_tournament_resolution r JOIN __stage_0066_default_variant d ON d.tournament_id=r.tournament_id AND d.user_id=r.user_id
WHERE r.variant_id IS NULL AND r.mix_id IS NULL AND r.normalized<>'mix'
 AND EXISTS (SELECT 1 FROM game_mix m WHERE m.id='sm:' || r.user_id || ':' || r.normalized AND m.user_id=r.user_id)
 AND r.tournament_id=(SELECT min(r2.tournament_id) FROM __stage_0066_tournament_resolution r2 WHERE r2.user_id=r.user_id AND r2.normalized=r.normalized AND r2.variant_id IS NULL AND r2.mix_id IS NULL AND EXISTS (SELECT 1 FROM __stage_0066_level_group lg JOIN __stage_0066_blind_level b ON b.id=lg.blind_level_id WHERE b.tournament_id=r2.tournament_id AND lg.user_id=r2.user_id));--> statement-breakpoint
CREATE TABLE __stage_0066_mix_variant AS
WITH g AS (
 SELECT mv.mix_id,mv.user_id,mv.variant_id,mv.position,v.group_id,
 MIN(mv.position) OVER (PARTITION BY mv.mix_id,v.group_id) AS first_group
 FROM game_mix_variant mv JOIN game_variant v ON v.id=mv.variant_id AND v.user_id=mv.user_id
)
SELECT mix_id,user_id,variant_id,group_id,DENSE_RANK() OVER (PARTITION BY mix_id ORDER BY first_group,group_id)-1 AS group_position,
 ROW_NUMBER() OVER (PARTITION BY mix_id,group_id ORDER BY position,variant_id)-1 AS variant_position FROM g;--> statement-breakpoint
CREATE TABLE __stage_0066_level_lineup AS
SELECT b.id AS blind_level_id,t.user_id,
 CASE WHEN b.is_break<>0 OR NOT EXISTS (SELECT 1 FROM __stage_0066_level_group g WHERE g.blind_level_id=b.id AND g.user_id=t.user_id)
 OR NOT EXISTS (
 SELECT group_position,position,variant_id FROM __stage_0066_level_variant WHERE blind_level_id=b.id AND user_id=t.user_id
 EXCEPT SELECT group_position,position,variant_id FROM __stage_0066_default_variant WHERE tournament_id=t.id AND user_id=t.user_id
 ) AND NOT EXISTS (
 SELECT group_position,position,variant_id FROM __stage_0066_default_variant WHERE tournament_id=t.id AND user_id=t.user_id
 EXCEPT SELECT group_position,position,variant_id FROM __stage_0066_level_variant WHERE blind_level_id=b.id AND user_id=t.user_id
 ) AND NOT EXISTS (
 SELECT position,game_group_id FROM __stage_0066_level_group WHERE blind_level_id=b.id AND user_id=t.user_id
 EXCEPT SELECT DISTINCT group_position,group_id FROM __stage_0066_default_variant WHERE tournament_id=t.id AND user_id=t.user_id
 )
 THEN 'lu:tr:' || t.id ELSE 'lu:trl:' || b.id END AS lineup_id
FROM __stage_0066_blind_level b JOIN __stage_0066_tournament t ON t.id=b.tournament_id;--> statement-breakpoint
ALTER TABLE __stage_0066_level_lineup ADD COLUMN inherits_lineup integer;--> statement-breakpoint
ALTER TABLE __stage_0066_level_lineup ADD COLUMN inherited_lineup_id text;--> statement-breakpoint
UPDATE __stage_0066_level_lineup SET inherits_lineup=CASE WHEN lineup_id LIKE 'lu:tr:%' THEN 1 ELSE 0 END,
 inherited_lineup_id=CASE WHEN lineup_id LIKE 'lu:tr:%' THEN lineup_id END;--> statement-breakpoint
INSERT INTO game_lineup (id,user_id,game_mix_id)
SELECT 'lu:tr:' || r.tournament_id,r.user_id,CASE WHEN r.variant_id IS NOT NULL OR r.normalized='mix' AND r.mix_id IS NULL THEN NULL
 WHEN r.mix_id IS NOT NULL THEN r.mix_id WHEN EXISTS (SELECT 1 FROM game_mix m WHERE m.id='sm:' || r.user_id || ':' || r.normalized AND m.user_id=r.user_id) AND EXISTS (SELECT 1 FROM __stage_0066_level_group lg JOIN __stage_0066_blind_level b ON b.id=lg.blind_level_id WHERE b.tournament_id=r.tournament_id AND lg.user_id=r.user_id) THEN 'sm:' || r.user_id || ':' || r.normalized END
FROM __stage_0066_tournament_resolution r;--> statement-breakpoint
INSERT INTO game_lineup (id,user_id,game_mix_id)
SELECT l.lineup_id,l.user_id,
 (SELECT min(m.id) FROM game_mix m WHERE m.user_id=l.user_id AND NOT EXISTS (
 SELECT group_position,position,variant_id FROM __stage_0066_level_variant WHERE blind_level_id=l.blind_level_id AND user_id=l.user_id
 EXCEPT SELECT group_position,variant_position,variant_id FROM __stage_0066_mix_variant WHERE mix_id=m.id AND user_id=m.user_id)
 AND NOT EXISTS (SELECT group_position,variant_position,variant_id FROM __stage_0066_mix_variant WHERE mix_id=m.id AND user_id=m.user_id
 EXCEPT SELECT group_position,position,variant_id FROM __stage_0066_level_variant WHERE blind_level_id=l.blind_level_id AND user_id=l.user_id)
 AND NOT EXISTS (SELECT position,game_group_id FROM __stage_0066_level_group WHERE blind_level_id=l.blind_level_id AND user_id=l.user_id
 EXCEPT SELECT DISTINCT group_position,group_id FROM __stage_0066_mix_variant WHERE mix_id=m.id AND user_id=m.user_id))
FROM __stage_0066_level_lineup l WHERE l.inherits_lineup=0;--> statement-breakpoint
INSERT INTO game_lineup_group (id,user_id,lineup_id,position,game_group_id,name)
SELECT 'lu:tr:' || d.tournament_id || ':' || d.group_position,d.user_id,'lu:tr:' || d.tournament_id,d.group_position,d.group_id,NULL
FROM __stage_0066_default_variant d WHERE d.position=0;--> statement-breakpoint
INSERT INTO game_lineup_variant (user_id,lineup_id,lineup_group_id,variant_id,position)
SELECT d.user_id,'lu:tr:' || d.tournament_id,'lu:tr:' || d.tournament_id || ':' || d.group_position,d.variant_id,d.position FROM __stage_0066_default_variant d;--> statement-breakpoint
INSERT INTO game_lineup_group (id,user_id,lineup_id,position,game_group_id,name)
SELECT l.lineup_id || ':' || g.position,g.user_id,l.lineup_id,g.position,g.game_group_id,g.name
FROM __stage_0066_level_lineup l JOIN __stage_0066_level_group g ON g.blind_level_id=l.blind_level_id AND g.user_id=l.user_id WHERE l.inherits_lineup=0;--> statement-breakpoint
INSERT INTO game_lineup_variant (user_id,lineup_id,lineup_group_id,variant_id,position)
SELECT v.user_id,l.lineup_id,l.lineup_id || ':' || v.group_position,v.variant_id,v.position
FROM __stage_0066_level_lineup l JOIN __stage_0066_level_variant v ON v.blind_level_id=l.blind_level_id AND v.user_id=l.user_id WHERE l.inherits_lineup=0;--> statement-breakpoint

INSERT INTO `asset` (`id`, `user_id`, `name`, `kind`, `decimals`, `created_at`, `updated_at`)
SELECT 'unassigned:' || `u`.`user_id`, `u`.`user_id`,
  CASE WHEN EXISTS (SELECT 1 FROM `asset` AS `a` WHERE `a`.`user_id` = `u`.`user_id` AND lower(trim(`a`.`name`)) = 'unassigned')
    THEN 'Unassigned (migrated)' ELSE 'Unassigned' END, 'currency', 0, unixepoch(), unixepoch()
FROM (
  SELECT DISTINCT `t`.`user_id` FROM `__stage_0066_tournament` AS `t`
  LEFT JOIN `asset` AS `a` ON `a`.`id` = `t`.`currency_id` AND `a`.`user_id` = `t`.`user_id`
  WHERE `a`.`id` IS NULL AND (`t`.`buy_in` IS NOT NULL OR `t`.`entry_fee` IS NOT NULL OR EXISTS (
    SELECT 1 FROM `__stage_0066_purchase` AS `p` WHERE `p`.`tournament_id` = `t`.`id`
  )) AND NOT EXISTS (SELECT 1 FROM `asset` AS `existing` WHERE `existing`.`id` = 'unassigned:' || `t`.`user_id` AND `existing`.`user_id` = `t`.`user_id`)
) AS `u`;--> statement-breakpoint

INSERT INTO `tournament_rule` (`id`, `user_id`, `tournament_id`, `parent_rule_id`, `lineup_id`, `starting_stack`, `table_size`, `bounty_amount`, `house_rules`)
SELECT 'tr:' || `id`, `user_id`, NULL, NULL, 'lu:tr:' || `id`,
  CASE WHEN `starting_stack` >= 0 THEN `starting_stack` END,
  CASE WHEN `table_size` BETWEEN 2 AND 10 THEN `table_size` END,
  CASE WHEN `bounty_amount` >= 0 THEN `bounty_amount` END, `house_rules`
FROM `__stage_0066_tournament`;--> statement-breakpoint

INSERT INTO `tournament_rule_level` (`id`, `user_id`, `rule_id`, `ordinal`, `level`, `is_break`, `minutes`, `lineup_id`, `inherits_lineup`, `inherited_lineup_id`)
SELECT 'trl:' || `b`.`id`, `t`.`user_id`, 'tr:' || `t`.`id`,
  row_number() OVER (PARTITION BY `t`.`id` ORDER BY `b`.`level`, `b`.`id`), `b`.`level`,
  CASE WHEN `b`.`is_break` THEN 1 ELSE 0 END, CASE WHEN `b`.`minutes` >= 1 THEN `b`.`minutes` END,
  `ll`.`lineup_id`, `ll`.`inherits_lineup`, `ll`.`inherited_lineup_id`
FROM `__stage_0066_blind_level` AS `b`
JOIN `__stage_0066_tournament` AS `t` ON `t`.`id` = `b`.`tournament_id`
JOIN `__stage_0066_level_lineup` AS `ll` ON `ll`.`blind_level_id` = `b`.`id` AND `ll`.`user_id` = `t`.`user_id`;--> statement-breakpoint

INSERT INTO `tournament_rule_level_stake` (`user_id`, `level_id`, `lineup_group_id`, `lineup_id`, `blind1`, `blind2`, `blind3`, `ante`, `ante_type`)
SELECT `t`.`user_id`, 'trl:' || `b`.`id`, `g`.`id`, `ll`.`lineup_id`,
  CASE WHEN `lg`.`blind_level_id` IS NOT NULL THEN `lg`.`blind1` WHEN `b`.`blind1` >= 0 THEN `b`.`blind1` END,
  CASE WHEN `lg`.`blind_level_id` IS NOT NULL THEN `lg`.`blind2` WHEN `b`.`blind2` >= 0 THEN `b`.`blind2` END,
  CASE WHEN `lg`.`blind_level_id` IS NOT NULL THEN `lg`.`blind3` WHEN `b`.`blind3` >= 0 THEN `b`.`blind3` END,
  CASE WHEN `lg`.`blind_level_id` IS NOT NULL THEN `lg`.`ante` WHEN `b`.`ante` >= 0 THEN `b`.`ante` END, NULL
FROM `__stage_0066_blind_level` AS `b`
JOIN `__stage_0066_tournament` AS `t` ON `t`.`id` = `b`.`tournament_id`
JOIN `__stage_0066_level_lineup` AS `ll` ON `ll`.`blind_level_id` = `b`.`id` AND `ll`.`user_id` = `t`.`user_id`
JOIN `game_lineup_group` AS `g` ON `g`.`lineup_id` = `ll`.`lineup_id` AND `g`.`user_id` = `t`.`user_id`
LEFT JOIN `__stage_0066_level_group` AS `lg` ON `lg`.`blind_level_id` = `b`.`id` AND `lg`.`user_id` = `t`.`user_id` AND `lg`.`position` = `g`.`position`
WHERE NOT `b`.`is_break`;--> statement-breakpoint

INSERT INTO `tournament_rule_price` (`id`, `user_id`, `rule_id`, `kind`, `label`, `asset_id`, `amount`, `fee`, `chips`, `ordinal`)
SELECT 'trp:tr:' || `t`.`id` || ':entry', `t`.`user_id`, 'tr:' || `t`.`id`, 'entry', '',
  COALESCE(`a`.`id`, 'unassigned:' || `t`.`user_id`),
  CASE WHEN `t`.`buy_in` >= 0 THEN `t`.`buy_in` ELSE 0 END,
  CASE WHEN `t`.`entry_fee` >= 0 THEN `t`.`entry_fee` ELSE 0 END, NULL, 1
FROM `__stage_0066_tournament` AS `t`
LEFT JOIN `asset` AS `a` ON `a`.`id` = `t`.`currency_id` AND `a`.`user_id` = `t`.`user_id`
WHERE `t`.`buy_in` IS NOT NULL OR `t`.`entry_fee` IS NOT NULL;--> statement-breakpoint

INSERT INTO `tournament_rule_price` (`id`, `user_id`, `rule_id`, `kind`, `label`, `asset_id`, `amount`, `fee`, `chips`, `ordinal`)
SELECT 'trp:' || `p`.`id`, `t`.`user_id`, 'tr:' || `t`.`id`, 'addon', `p`.`name`,
  COALESCE(`a`.`id`, 'unassigned:' || `t`.`user_id`), CASE WHEN `p`.`cost` >= 0 THEN `p`.`cost` ELSE 0 END,
  0, CASE WHEN `p`.`chips` >= 0 THEN `p`.`chips` END,
  CASE WHEN `t`.`buy_in` IS NOT NULL OR `t`.`entry_fee` IS NOT NULL THEN 1 ELSE 0 END +
    row_number() OVER (PARTITION BY `t`.`id` ORDER BY `p`.`sort_order`, `p`.`id`)
FROM `__stage_0066_purchase` AS `p`
JOIN `__stage_0066_tournament` AS `t` ON `t`.`id` = `p`.`tournament_id`
LEFT JOIN `asset` AS `a` ON `a`.`id` = `t`.`currency_id` AND `a`.`user_id` = `t`.`user_id`;--> statement-breakpoint

UPDATE entry_tournament SET tournament_id = NULL WHERE tournament_id IS NOT NULL;--> statement-breakpoint
UPDATE session_tournament_detail SET tournament_id = NULL WHERE tournament_id IS NOT NULL;--> statement-breakpoint
DELETE FROM blind_level;--> statement-breakpoint
DELETE FROM tournament_chip_purchase;--> statement-breakpoint
DELETE FROM tournament_tag;--> statement-breakpoint
DROP TABLE tournament;--> statement-breakpoint
CREATE TABLE `tournament` (
 `id` text PRIMARY KEY NOT NULL,
 `user_id` text NOT NULL,
 `created_at` integer DEFAULT (unixepoch()) NOT NULL,
 `updated_at` integer NOT NULL,
 `room_id` text,
 `name` text NOT NULL,
 `memo` text,
 `is_favorite` integer DEFAULT false NOT NULL,
 `archived_at` integer,
 `default_asset_id` text,
 `current_rule_id` text NOT NULL,
 FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
 FOREIGN KEY (`room_id`,`user_id`) REFERENCES `room`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
 FOREIGN KEY (`default_asset_id`,`user_id`) REFERENCES `asset`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
 FOREIGN KEY (`current_rule_id`,`user_id`) REFERENCES `tournament_rule`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
 CONSTRAINT "tournament_is_favorite_check" CHECK("tournament"."is_favorite" IN (0, 1))
);--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_id_user_id_unique` ON `tournament` (`id`,`user_id`);--> statement-breakpoint
CREATE INDEX `tournament_room_idx` ON `tournament` (`room_id`);--> statement-breakpoint
CREATE INDEX `tournament_asset_idx` ON `tournament` (`default_asset_id`);--> statement-breakpoint
CREATE INDEX `tournament_rule_idx` ON `tournament` (`current_rule_id`);--> statement-breakpoint
INSERT INTO tournament (id,user_id,created_at,updated_at,room_id,name,memo,is_favorite,archived_at,default_asset_id,current_rule_id)
SELECT t.id,t.user_id,t.created_at,t.updated_at,t.room_id,t.name,t.memo,0,t.archived_at,a.id,'tr:'||t.id
FROM __stage_0066_tournament t LEFT JOIN asset a ON a.id=t.currency_id AND a.user_id=t.user_id;--> statement-breakpoint
UPDATE tournament_rule SET tournament_id = substr(id,4) WHERE id IN (SELECT 'tr:'||id FROM __stage_0066_tournament);--> statement-breakpoint
INSERT INTO blind_level (id,tournament_id,level,is_break,blind1,blind2,blind3,ante,minutes,games) SELECT id,tournament_id,level,is_break,blind1,blind2,blind3,ante,minutes,games FROM __stage_0066_blind_level;--> statement-breakpoint
INSERT INTO tournament_chip_purchase (id,tournament_id,name,cost,chips,sort_order) SELECT id,tournament_id,name,cost,chips,sort_order FROM __stage_0066_purchase;--> statement-breakpoint
INSERT INTO tournament_tag (id,tournament_id,name,created_at) SELECT id,tournament_id,name,created_at FROM __stage_0066_tag;--> statement-breakpoint
UPDATE session_tournament_detail SET tournament_id = (SELECT s.tournament_id FROM __stage_0066_detail s WHERE s.session_id = session_tournament_detail.session_id) WHERE session_id IN (SELECT session_id FROM __stage_0066_detail);--> statement-breakpoint
UPDATE entry_tournament SET tournament_id = (SELECT s.tournament_id FROM __stage_0066_entry s WHERE s.entry_id = entry_tournament.entry_id AND s.user_id = entry_tournament.user_id) WHERE entry_id IN (SELECT entry_id FROM __stage_0066_entry);--> statement-breakpoint

INSERT INTO `__gate_0066` (`current_rules_valid`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `tournament` AS `t` LEFT JOIN `tournament_rule` AS `r`
 ON `r`.`id` = `t`.`current_rule_id` AND `r`.`user_id` = `t`.`user_id` AND `r`.`tournament_id` = `t`.`id`
 WHERE `r`.`id` IS NULL
);--> statement-breakpoint
INSERT INTO `__gate_0066` (`stake_coverage`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `tournament_rule_level` AS `l`
 WHERE (`l`.`is_break` = 1 AND EXISTS (SELECT 1 FROM `tournament_rule_level_stake` AS `s` WHERE `s`.`level_id` = `l`.`id` AND `s`.`user_id` = `l`.`user_id`))
 OR (`l`.`is_break` = 0 AND (
  (SELECT count(*) FROM `tournament_rule_level_stake` AS `s` WHERE `s`.`level_id` = `l`.`id` AND `s`.`user_id` = `l`.`user_id`) <>
  (SELECT count(*) FROM `game_lineup_group` AS `g` WHERE `g`.`lineup_id` = `l`.`lineup_id` AND `g`.`user_id` = `l`.`user_id`)
  OR EXISTS (SELECT 1 FROM `game_lineup_group` AS `g` WHERE `g`.`lineup_id` = `l`.`lineup_id` AND `g`.`user_id` = `l`.`user_id` AND NOT EXISTS (
   SELECT 1 FROM `tournament_rule_level_stake` AS `s` WHERE `s`.`level_id` = `l`.`id` AND `s`.`user_id` = `l`.`user_id` AND `s`.`lineup_group_id` = `g`.`id` AND `s`.`lineup_id` = `l`.`lineup_id`))
 ))
);--> statement-breakpoint
INSERT INTO `__gate_0066` (`inheritance_valid`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `tournament_rule_level` AS `l` JOIN `tournament_rule` AS `r` ON `r`.`id` = `l`.`rule_id` AND `r`.`user_id` = `l`.`user_id`
 JOIN `__stage_0066_blind_level` AS `b` ON 'trl:' || `b`.`id` = `l`.`id`
 WHERE (`l`.`inherits_lineup` = 1 AND (`l`.`lineup_id` IS NOT `r`.`lineup_id` OR `l`.`inherited_lineup_id` IS NOT `r`.`lineup_id`))
 OR ((`l`.`is_break` = 1 OR NOT EXISTS (SELECT 1 FROM `__stage_0066_level_group` AS `g` WHERE `g`.`blind_level_id` = `b`.`id` AND `g`.`user_id` = `l`.`user_id`)) AND `l`.`inherits_lineup` <> 1)
);--> statement-breakpoint
INSERT INTO `__gate_0066` (`lineups_nonempty`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `game_lineup` AS `l` WHERE (EXISTS (SELECT 1 FROM `tournament_rule` AS `r` WHERE `r`.`lineup_id` = `l`.`id` AND `r`.`user_id` = `l`.`user_id`) OR EXISTS (SELECT 1 FROM `tournament_rule_level` AS `v` WHERE `v`.`lineup_id` = `l`.`id` AND `v`.`user_id` = `l`.`user_id`))
 AND NOT EXISTS (SELECT 1 FROM `game_lineup_group` AS `g` WHERE `g`.`lineup_id` = `l`.`id` AND `g`.`user_id` = `l`.`user_id`)
) OR EXISTS (
 SELECT 1 FROM `game_lineup_group` AS `g` WHERE (EXISTS (SELECT 1 FROM `tournament_rule` AS `r` WHERE `r`.`lineup_id` = `g`.`lineup_id` AND `r`.`user_id` = `g`.`user_id`) OR EXISTS (SELECT 1 FROM `tournament_rule_level` AS `v` WHERE `v`.`lineup_id` = `g`.`lineup_id` AND `v`.`user_id` = `g`.`user_id`))
 AND NOT EXISTS (SELECT 1 FROM `game_lineup_variant` AS `v` WHERE `v`.`lineup_group_id` = `g`.`id` AND `v`.`lineup_id` = `g`.`lineup_id` AND `v`.`user_id` = `g`.`user_id`)
);--> statement-breakpoint
INSERT INTO `__gate_0066` (`master_content`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `__stage_0066_tournament` AS `s`
 LEFT JOIN `asset` AS `a` ON `a`.`id` = `s`.`currency_id` AND `a`.`user_id` = `s`.`user_id`
 LEFT JOIN `tournament` AS `t` ON `t`.`id` = `s`.`id` AND `t`.`user_id` = `s`.`user_id`
 LEFT JOIN `tournament_rule` AS `r` ON `r`.`id` = 'tr:' || `s`.`id` AND `r`.`user_id` = `s`.`user_id`
 WHERE `t`.`id` IS NULL OR `r`.`id` IS NULL OR `t`.`room_id` IS NOT `s`.`room_id` OR `t`.`name` IS NOT `s`.`name` OR `t`.`memo` IS NOT `s`.`memo`
 OR `t`.`created_at` IS NOT `s`.`created_at` OR `t`.`updated_at` IS NOT `s`.`updated_at` OR `t`.`archived_at` IS NOT `s`.`archived_at`
 OR `t`.`is_favorite` IS NOT 0 OR `t`.`default_asset_id` IS NOT `a`.`id` OR `t`.`current_rule_id` IS NOT 'tr:' || `s`.`id`
 OR `r`.`tournament_id` IS NOT `s`.`id` OR `r`.`parent_rule_id` IS NOT NULL OR `r`.`lineup_id` IS NOT 'lu:tr:' || `s`.`id`
 OR `r`.`starting_stack` IS NOT CASE WHEN `s`.`starting_stack` >= 0 THEN `s`.`starting_stack` END
 OR `r`.`table_size` IS NOT CASE WHEN `s`.`table_size` BETWEEN 2 AND 10 THEN `s`.`table_size` END
 OR `r`.`bounty_amount` IS NOT CASE WHEN `s`.`bounty_amount` >= 0 THEN `s`.`bounty_amount` END OR `r`.`house_rules` IS NOT `s`.`house_rules`
) OR (SELECT count(*) FROM `tournament`) <> (SELECT count(*) FROM `__stage_0066_tournament`)
 OR EXISTS (
 SELECT 1 FROM (
  SELECT 'trl:' || `b`.`id` AS `id`, `t`.`user_id`, 'tr:' || `t`.`id` AS `rule_id`, row_number() OVER (PARTITION BY `t`.`id` ORDER BY `b`.`level`, `b`.`id`) AS `ordinal`, `b`.`level`, CASE WHEN `b`.`is_break` THEN 1 ELSE 0 END AS `is_break`, CASE WHEN `b`.`minutes` >= 1 THEN `b`.`minutes` END AS `minutes`
  FROM `__stage_0066_blind_level` AS `b` JOIN `__stage_0066_tournament` AS `t` ON `t`.`id` = `b`.`tournament_id`
 ) AS `e` LEFT JOIN `tournament_rule_level` AS `l` ON `l`.`id` = `e`.`id` AND `l`.`user_id` = `e`.`user_id`
 WHERE `l`.`id` IS NULL OR `l`.`rule_id` IS NOT `e`.`rule_id` OR `l`.`ordinal` IS NOT `e`.`ordinal` OR `l`.`level` IS NOT `e`.`level` OR `l`.`is_break` IS NOT `e`.`is_break` OR `l`.`minutes` IS NOT `e`.`minutes`
) OR (SELECT count(*) FROM `tournament_rule_level`) <> (SELECT count(*) FROM `__stage_0066_blind_level`)
 OR EXISTS (
 SELECT 1 FROM `__stage_0066_blind_level` AS `b` JOIN `__stage_0066_tournament` AS `t` ON `t`.`id` = `b`.`tournament_id`
 JOIN `tournament_rule_level` AS `l` ON `l`.`id` = 'trl:' || `b`.`id` AND `l`.`user_id` = `t`.`user_id`
 JOIN `game_lineup_group` AS `g` ON `g`.`lineup_id` = `l`.`lineup_id` AND `g`.`user_id` = `l`.`user_id`
 LEFT JOIN `__stage_0066_level_group` AS `lg` ON `lg`.`blind_level_id` = `b`.`id` AND `lg`.`user_id` = `t`.`user_id` AND `lg`.`position` = `g`.`position`
 LEFT JOIN `tournament_rule_level_stake` AS `s` ON `s`.`level_id` = `l`.`id` AND `s`.`lineup_group_id` = `g`.`id` AND `s`.`user_id` = `t`.`user_id`
 WHERE `l`.`is_break` = 0 AND (`s`.`level_id` IS NULL OR `s`.`lineup_id` IS NOT `l`.`lineup_id` OR `s`.`ante_type` IS NOT NULL
 OR `s`.`blind1` IS NOT CASE WHEN `lg`.`blind_level_id` IS NOT NULL THEN `lg`.`blind1` WHEN `b`.`blind1` >= 0 THEN `b`.`blind1` END
 OR `s`.`blind2` IS NOT CASE WHEN `lg`.`blind_level_id` IS NOT NULL THEN `lg`.`blind2` WHEN `b`.`blind2` >= 0 THEN `b`.`blind2` END
 OR `s`.`blind3` IS NOT CASE WHEN `lg`.`blind_level_id` IS NOT NULL THEN `lg`.`blind3` WHEN `b`.`blind3` >= 0 THEN `b`.`blind3` END
 OR `s`.`ante` IS NOT CASE WHEN `lg`.`blind_level_id` IS NOT NULL THEN `lg`.`ante` WHEN `b`.`ante` >= 0 THEN `b`.`ante` END)
) OR EXISTS (
 SELECT 1 FROM `__stage_0066_tournament` AS `t` LEFT JOIN `asset` AS `a` ON `a`.`id` = `t`.`currency_id` AND `a`.`user_id` = `t`.`user_id`
 LEFT JOIN `tournament_rule_price` AS `p` ON `p`.`id` = 'trp:tr:' || `t`.`id` || ':entry' AND `p`.`user_id` = `t`.`user_id`
 WHERE (`t`.`buy_in` IS NOT NULL OR `t`.`entry_fee` IS NOT NULL) AND (`p`.`id` IS NULL OR `p`.`rule_id` IS NOT 'tr:' || `t`.`id` OR `p`.`kind` IS NOT 'entry' OR `p`.`label` IS NOT '' OR `p`.`asset_id` IS NOT COALESCE(`a`.`id`, 'unassigned:' || `t`.`user_id`) OR `p`.`amount` IS NOT CASE WHEN `t`.`buy_in` >= 0 THEN `t`.`buy_in` ELSE 0 END OR `p`.`fee` IS NOT CASE WHEN `t`.`entry_fee` >= 0 THEN `t`.`entry_fee` ELSE 0 END OR `p`.`chips` IS NOT NULL OR `p`.`ordinal` IS NOT 1)
) OR EXISTS (
 SELECT 1 FROM (SELECT `p`.*, `t`.`user_id`, `t`.`buy_in`, `t`.`entry_fee`, `t`.`currency_id`, row_number() OVER (PARTITION BY `t`.`id` ORDER BY `p`.`sort_order`, `p`.`id`) AS `rn` FROM `__stage_0066_purchase` AS `p` JOIN `__stage_0066_tournament` AS `t` ON `t`.`id` = `p`.`tournament_id`) AS `e`
 LEFT JOIN `asset` AS `a` ON `a`.`id` = `e`.`currency_id` AND `a`.`user_id` = `e`.`user_id`
 LEFT JOIN `tournament_rule_price` AS `p` ON `p`.`id` = 'trp:' || `e`.`id` AND `p`.`user_id` = `e`.`user_id`
 WHERE `p`.`id` IS NULL OR `p`.`rule_id` IS NOT 'tr:' || `e`.`tournament_id` OR `p`.`kind` IS NOT 'addon' OR `p`.`label` IS NOT `e`.`name` OR `p`.`asset_id` IS NOT COALESCE(`a`.`id`, 'unassigned:' || `e`.`user_id`) OR `p`.`amount` IS NOT CASE WHEN `e`.`cost` >= 0 THEN `e`.`cost` ELSE 0 END OR `p`.`fee` IS NOT 0 OR `p`.`chips` IS NOT CASE WHEN `e`.`chips` >= 0 THEN `e`.`chips` END OR `p`.`ordinal` IS NOT `e`.`rn` + CASE WHEN `e`.`buy_in` IS NOT NULL OR `e`.`entry_fee` IS NOT NULL THEN 1 ELSE 0 END
) OR (SELECT count(*) FROM `tournament_rule_price`) <> (SELECT count(*) FROM `__stage_0066_purchase`) + (SELECT count(*) FROM `__stage_0066_tournament` WHERE `buy_in` IS NOT NULL OR `entry_fee` IS NOT NULL);--> statement-breakpoint
INSERT INTO `__gate_0066` (`children_restored`) SELECT NULL WHERE EXISTS (
 SELECT `id`, `tournament_id`, `level`, `is_break`, `blind1`, `blind2`, `blind3`, `ante`, `minutes`, `games` FROM `__stage_0066_blind_level` EXCEPT SELECT `id`, `tournament_id`, `level`, `is_break`, `blind1`, `blind2`, `blind3`, `ante`, `minutes`, `games` FROM `blind_level`
) OR EXISTS (
 SELECT `id`, `tournament_id`, `level`, `is_break`, `blind1`, `blind2`, `blind3`, `ante`, `minutes`, `games` FROM `blind_level` EXCEPT SELECT `id`, `tournament_id`, `level`, `is_break`, `blind1`, `blind2`, `blind3`, `ante`, `minutes`, `games` FROM `__stage_0066_blind_level`
) OR (SELECT count(*) FROM `blind_level`) <> (SELECT count(*) FROM `__stage_0066_blind_level`)
 OR EXISTS (SELECT `id`, `tournament_id`, `name`, `cost`, `chips`, `sort_order` FROM `__stage_0066_purchase` EXCEPT SELECT `id`, `tournament_id`, `name`, `cost`, `chips`, `sort_order` FROM `tournament_chip_purchase`)
 OR EXISTS (SELECT `id`, `tournament_id`, `name`, `cost`, `chips`, `sort_order` FROM `tournament_chip_purchase` EXCEPT SELECT `id`, `tournament_id`, `name`, `cost`, `chips`, `sort_order` FROM `__stage_0066_purchase`)
 OR (SELECT count(*) FROM `tournament_chip_purchase`) <> (SELECT count(*) FROM `__stage_0066_purchase`)
 OR EXISTS (SELECT `id`, `tournament_id`, `name`, `created_at` FROM `__stage_0066_tag` EXCEPT SELECT `id`, `tournament_id`, `name`, `created_at` FROM `tournament_tag`)
 OR EXISTS (SELECT `id`, `tournament_id`, `name`, `created_at` FROM `tournament_tag` EXCEPT SELECT `id`, `tournament_id`, `name`, `created_at` FROM `__stage_0066_tag`)
 OR (SELECT count(*) FROM `tournament_tag`) <> (SELECT count(*) FROM `__stage_0066_tag`)
 OR EXISTS (SELECT `session_id`, `tournament_id` FROM `__stage_0066_detail` EXCEPT SELECT `session_id`, `tournament_id` FROM `session_tournament_detail` WHERE `tournament_id` IS NOT NULL)
 OR EXISTS (SELECT `session_id`, `tournament_id` FROM `session_tournament_detail` WHERE `tournament_id` IS NOT NULL EXCEPT SELECT `session_id`, `tournament_id` FROM `__stage_0066_detail`)
 OR (SELECT count(*) FROM `session_tournament_detail` WHERE `tournament_id` IS NOT NULL) <> (SELECT count(*) FROM `__stage_0066_detail`)
 OR EXISTS (SELECT `entry_id`, `user_id`, `tournament_id` FROM `__stage_0066_entry` EXCEPT SELECT `entry_id`, `user_id`, `tournament_id` FROM `entry_tournament` WHERE `tournament_id` IS NOT NULL)
 OR EXISTS (SELECT `entry_id`, `user_id`, `tournament_id` FROM `entry_tournament` WHERE `tournament_id` IS NOT NULL EXCEPT SELECT `entry_id`, `user_id`, `tournament_id` FROM `__stage_0066_entry`)
 OR (SELECT count(*) FROM `entry_tournament` WHERE `tournament_id` IS NOT NULL) <> (SELECT count(*) FROM `__stage_0066_entry`);--> statement-breakpoint
INSERT INTO `__gate_0066` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check);--> statement-breakpoint

DROP TABLE `__stage_0066_json_group`;--> statement-breakpoint
DROP TABLE `__stage_0066_json_variant`;--> statement-breakpoint
DROP TABLE `__stage_0066_tournament_resolution`;--> statement-breakpoint
DROP TABLE `__stage_0066_needed_variant`;--> statement-breakpoint
DROP TABLE `__stage_0066_level_variant`;--> statement-breakpoint
DROP TABLE `__stage_0066_level_group`;--> statement-breakpoint
DROP TABLE `__stage_0066_default_variant`;--> statement-breakpoint
DROP TABLE `__stage_0066_mix_variant`;--> statement-breakpoint
DROP TABLE `__stage_0066_level_lineup`;--> statement-breakpoint
DROP TABLE `__stage_0066_tournament`;--> statement-breakpoint
DROP TABLE `__stage_0066_blind_level`;--> statement-breakpoint
DROP TABLE `__stage_0066_purchase`;--> statement-breakpoint
DROP TABLE `__stage_0066_tag`;--> statement-breakpoint
DROP TABLE `__stage_0066_detail`;--> statement-breakpoint
DROP TABLE `__stage_0066_entry`;--> statement-breakpoint
DROP TABLE `__gate_0066`;
