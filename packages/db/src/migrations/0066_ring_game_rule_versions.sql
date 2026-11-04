-- B07: migrate legacy cash masters to immutable rules and frozen lineups.
-- SQLite lower/trim fold ASCII and spaces only, not Unicode normalization.
-- Inbound references: session_cash_detail (SET NULL), entry_cash (NO ACTION),
-- cash_rule (CASCADE); cash rules and stakes must still be empty at cutover.
CREATE TABLE `__gate_0066` (
 `precondition` integer NOT NULL DEFAULT 1,
 `masters` integer NOT NULL DEFAULT 1,
 `children` integer NOT NULL DEFAULT 1,
 `rules` integer NOT NULL DEFAULT 1,
 `lineups` integer NOT NULL DEFAULT 1,
 `foreign_keys` integer NOT NULL DEFAULT 1
);--> statement-breakpoint
INSERT INTO `__gate_0066` (`precondition`) SELECT NULL WHERE EXISTS (SELECT 1 FROM `cash_rule`) OR EXISTS (SELECT 1 FROM `cash_rule_stake`);--> statement-breakpoint
CREATE TABLE `__stage_0066_ring` AS SELECT * FROM `ring_game`;--> statement-breakpoint
CREATE TABLE `__stage_0066_session` AS SELECT `session_id`, `ring_game_id` FROM `session_cash_detail` WHERE `ring_game_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__stage_0066_entry` AS SELECT `entry_id`, `user_id`, `ring_game_id` FROM `entry_cash` WHERE `ring_game_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__stage_0066_child_counts` AS SELECT (SELECT count(*) FROM `session_cash_detail`) AS sessions, (SELECT count(*) FROM `entry_cash`) AS entries;--> statement-breakpoint
UPDATE `session_cash_detail` SET `ring_game_id` = NULL WHERE `ring_game_id` IS NOT NULL;--> statement-breakpoint
UPDATE `entry_cash` SET `ring_game_id` = NULL WHERE `ring_game_id` IS NOT NULL;--> statement-breakpoint

-- Known legacy keys and their seed definitions, in seed order.
CREATE TABLE `__stage_0066_builtin` (`key` text, `label` text, `short_label` text, `group_key` text, `sort_order` integer);--> statement-breakpoint
INSERT INTO `__stage_0066_builtin` VALUES
 ('nlh','NL Hold''em','NLH','bigbet',0),('plhe','Pot Limit Hold''em','PLHE','bigbet',1),
 ('plo','Pot Limit Omaha','PLO','bigbet',2),('plo5','5 Card PLO','PLO5','bigbet',3),
 ('plo8','Pot Limit Omaha Hi-Lo','PLO8','bigbet',4),('bigo','Big O','Big O','bigbet',5),
 ('shortdeck','Short Deck','6+','bigbet',6),('27sd','NL 2-7 Single Draw','2-7SD','bigbet',7),
 ('pl27td','PL 2-7 Triple Draw','PL 2-7TD','bigbet',8),('courchevel','Courchevel','Courchevel','bigbet',9),
 ('lhe','Limit Hold''em','LHE','limit',10),('lo','Limit Omaha','LO','limit',11),
 ('o8','Limit Omaha Hi-Lo','O8','limit',12),('27td','Limit 2-7 Triple Draw','2-7TD','limit',13),
 ('a5td','A-5 Triple Draw','A-5TD','limit',14),('badugi','Badugi','Badugi','limit',15),
 ('badeucy','Badeucy','Badeucy','limit',16),('badacy','Badacy','Badacy','limit',17),
 ('stud','Seven Card Stud','Stud','stud',18),('stud8','Stud Hi-Lo','Stud8','stud',19),('razz','Razz','Razz','stud',20);--> statement-breakpoint
CREATE TABLE `__stage_0066_selection` AS
SELECT r.id AS ring_id,
 CASE WHEN lower(trim(r.variant))='mix' THEN 0
 WHEN EXISTS (SELECT 1 FROM `game_variant` v WHERE v.user_id=r.user_id AND lower(trim(v.label))=lower(trim(r.variant))) THEN 1
 WHEN EXISTS (SELECT 1 FROM `__stage_0066_builtin` b WHERE lower(trim(r.variant)) IN (b.key,lower(trim(b.label)))) THEN 1
 ELSE 0 END AS single_game,
 COALESCE((SELECT m.id FROM `game_mix` m WHERE m.user_id=r.user_id AND lower(trim(m.label))=lower(trim(r.variant)) ORDER BY m.id LIMIT 1),
 (SELECT m.id FROM `game_mix` m WHERE m.user_id=r.user_id AND m.builtin_key=lower(trim(r.variant)) ORDER BY m.id LIMIT 1)) AS mix_id
FROM `__stage_0066_ring` r;--> statement-breakpoint
CREATE TABLE `__stage_0066_values` AS
SELECT r.id,
 CASE WHEN typeof(r.min_buy_in)='integer' AND r.min_buy_in>=0 THEN r.min_buy_in END AS min_buy_in,
 CASE WHEN typeof(r.max_buy_in)='integer' AND r.max_buy_in>=0 AND (r.min_buy_in IS NULL OR typeof(r.min_buy_in)<>'integer' OR r.min_buy_in<0 OR r.max_buy_in>=r.min_buy_in) THEN r.max_buy_in END AS max_buy_in,
 CASE WHEN typeof(r.table_size)='integer' AND r.table_size BETWEEN 2 AND 10 THEN r.table_size END AS table_size,
 CASE WHEN typeof(r.blind1)='integer' AND r.blind1>=0 THEN r.blind1 END AS blind1,
 CASE WHEN typeof(r.blind2)='integer' AND r.blind2>=0 THEN r.blind2 END AS blind2,
 CASE WHEN typeof(r.blind3)='integer' AND r.blind3>=0 THEN r.blind3 END AS blind3,
 CASE WHEN typeof(r.ante)='integer' AND r.ante>=0 THEN r.ante END AS ante,
 CASE WHEN r.ante_type IN ('none','all','bb') THEN r.ante_type END AS ante_type,
 (SELECT a.id FROM `asset` a WHERE a.id=r.currency_id AND a.user_id=r.user_id) AS asset_id
FROM `__stage_0066_ring` r;--> statement-breakpoint

-- Only object groups with array variants and nonempty string elements survive.
CREATE TABLE `__stage_0066_groups` AS
SELECT r.id AS ring_id, r.user_id, CAST(j.key AS integer) AS source_pos, j.value AS body
FROM `__stage_0066_ring` r JOIN `__stage_0066_selection` selection ON selection.ring_id=r.id,
 json_each(CASE WHEN json_valid(r.mix_games) THEN CASE WHEN json_type(r.mix_games) = 'array' THEN r.mix_games ELSE '[]' END ELSE '[]' END) j
WHERE j.type = 'object' AND selection.single_game=0;--> statement-breakpoint
CREATE TABLE `__stage_0066_labels` AS
SELECT g.ring_id, g.user_id, g.source_pos, CAST(v.key AS integer) AS variant_pos, trim(v.value) AS label
FROM `__stage_0066_groups` g,
 json_each(CASE WHEN json_type(g.body, '$.variants') = 'array' THEN json_extract(g.body, '$.variants') ELSE '[]' END) v
WHERE v.type = 'text' AND length(trim(v.value)) > 0;--> statement-breakpoint
DELETE FROM `__stage_0066_groups` WHERE NOT EXISTS (SELECT 1 FROM `__stage_0066_labels` l WHERE l.ring_id=__stage_0066_groups.ring_id AND l.source_pos=__stage_0066_groups.source_pos);--> statement-breakpoint
-- Named mixes without a usable snapshot fall back to their ordered junction,
-- bucketed by the first appearance of each owned structure.
INSERT INTO `__stage_0066_groups` (ring_id,user_id,source_pos,body)
SELECT r.id,r.user_id,min(mv.position),NULL
FROM `__stage_0066_ring` r JOIN `__stage_0066_selection` sel ON sel.ring_id=r.id AND sel.single_game=0 AND lower(trim(r.variant))<>'mix'
JOIN `game_mix_variant` mv ON mv.mix_id=sel.mix_id AND mv.user_id=r.user_id
JOIN `game_variant` v ON v.id=mv.variant_id AND v.user_id=mv.user_id
WHERE NOT EXISTS (SELECT 1 FROM `__stage_0066_labels` l WHERE l.ring_id=r.id)
GROUP BY r.id,r.user_id,v.group_id;--> statement-breakpoint
INSERT INTO `__stage_0066_labels` (ring_id,user_id,source_pos,variant_pos,label)
SELECT r.id,r.user_id,(SELECT min(m2.position) FROM `game_mix_variant` m2 JOIN `game_variant` v2 ON v2.id=m2.variant_id AND v2.user_id=m2.user_id WHERE m2.mix_id=mv.mix_id AND v2.group_id=v.group_id),
 mv.position,v.label
FROM `__stage_0066_ring` r JOIN `__stage_0066_selection` sel ON sel.ring_id=r.id AND sel.single_game=0
JOIN `game_mix_variant` mv ON mv.mix_id=sel.mix_id AND mv.user_id=r.user_id
JOIN `game_variant` v ON v.id=mv.variant_id AND v.user_id=mv.user_id
WHERE EXISTS (SELECT 1 FROM `__stage_0066_groups` g WHERE g.ring_id=r.id AND g.body IS NULL);--> statement-breakpoint
-- If no valid saved composition remains, preserve the master's label as a game.
INSERT INTO `__stage_0066_labels` (ring_id,user_id,source_pos,variant_pos,label)
SELECT r.id,r.user_id,0,0,CASE WHEN lower(trim(r.variant))='mix' THEN 'Mixed Game' WHEN length(trim(r.variant)) > 0 THEN trim(r.variant) ELSE 'NL Hold''em' END
FROM `__stage_0066_ring` r WHERE NOT EXISTS (SELECT 1 FROM `__stage_0066_labels` l WHERE l.ring_id=r.id);--> statement-breakpoint

-- Owners with no game masters were never seeded; give them the complete
-- default set first so the seed's any-row guard stays a completion marker.
CREATE TABLE `__stage_0066_unseeded` AS
SELECT DISTINCT r.user_id FROM `__stage_0066_ring` r
WHERE NOT EXISTS (SELECT 1 FROM `game_group` g WHERE g.user_id=r.user_id)
 AND NOT EXISTS (SELECT 1 FROM `game_variant` v WHERE v.user_id=r.user_id)
 AND NOT EXISTS (SELECT 1 FROM `game_mix` m WHERE m.user_id=r.user_id);--> statement-breakpoint
CREATE TABLE `__stage_0066_seed_group` (`key` text, `label` text, `b1` text, `b2` text, `b3` text);--> statement-breakpoint
INSERT INTO `__stage_0066_seed_group` VALUES
 ('limit','Limit','Small Bet','Big Bet',NULL),('stud','Stud','Small Bet','Big Bet','Bring-in'),('bigbet','Big Bet','SB','BB','Straddle');--> statement-breakpoint
CREATE TABLE `__stage_0066_seed_mix` (`key` text, `label` text);--> statement-breakpoint
INSERT INTO `__stage_0066_seed_mix` VALUES ('horse','HORSE'),('8game','8-Game'),('10game','10-Game');--> statement-breakpoint
CREATE TABLE `__stage_0066_seed_member` (`mix` text, `variant` text, `position` integer);--> statement-breakpoint
INSERT INTO `__stage_0066_seed_member` VALUES
 ('horse','lhe',0),('horse','o8',1),('horse','razz',2),('horse','stud',3),('horse','stud8',4),
 ('8game','27td',0),('8game','lhe',1),('8game','o8',2),('8game','razz',3),('8game','stud',4),('8game','stud8',5),('8game','nlh',6),('8game','plo',7),
 ('10game','27td',0),('10game','lhe',1),('10game','o8',2),('10game','badugi',3),('10game','razz',4),('10game','stud',5),('10game','stud8',6),('10game','nlh',7),('10game','plo',8),('10game','27sd',9);--> statement-breakpoint
INSERT INTO `game_group` (id,user_id,builtin_key,label,blind1_label,blind2_label,blind3_label,created_at,updated_at)
SELECT u.user_id||':builtin-group:'||k.key,u.user_id,k.key,k.label,k.b1,k.b2,k.b3,unixepoch(),unixepoch()
FROM `__stage_0066_unseeded` u CROSS JOIN `__stage_0066_seed_group` k;--> statement-breakpoint
INSERT INTO `game_variant` (id,user_id,builtin_key,label,short_label,group_id,sort_order,created_at,updated_at)
SELECT u.user_id||':builtin-variant:'||b.key,u.user_id,b.key,b.label,b.short_label,u.user_id||':builtin-group:'||b.group_key,b.sort_order,unixepoch(),unixepoch()
FROM `__stage_0066_unseeded` u CROSS JOIN `__stage_0066_builtin` b;--> statement-breakpoint
INSERT INTO `game_mix` (id,user_id,builtin_key,label,games,created_at,updated_at)
SELECT u.user_id||':builtin-mix:'||k.key,u.user_id,k.key,k.label,'[]',unixepoch(),unixepoch()
FROM `__stage_0066_unseeded` u CROSS JOIN `__stage_0066_seed_mix` k;--> statement-breakpoint
INSERT INTO `game_mix_variant` (mix_id,user_id,variant_id,position)
SELECT u.user_id||':builtin-mix:'||k.mix,u.user_id,u.user_id||':builtin-variant:'||k.variant,k.position
FROM `__stage_0066_unseeded` u CROSS JOIN `__stage_0066_seed_member` k;--> statement-breakpoint
DROP TABLE `__stage_0066_seed_member`;--> statement-breakpoint
DROP TABLE `__stage_0066_seed_mix`;--> statement-breakpoint
DROP TABLE `__stage_0066_seed_group`;--> statement-breakpoint
DROP TABLE `__stage_0066_unseeded`;--> statement-breakpoint

-- Supply only needed builtin structures; a same-name owned group takes precedence.
CREATE TABLE `__stage_0066_needed_group` AS
SELECT DISTINCT l.user_id, b.group_key FROM `__stage_0066_labels` l JOIN `__stage_0066_builtin` b ON lower(trim(l.label)) IN (b.key,lower(trim(b.label)))
WHERE NOT EXISTS (SELECT 1 FROM `game_variant` v WHERE v.user_id=l.user_id AND (lower(trim(v.label))=lower(trim(l.label)) OR v.builtin_key=b.key))
UNION
SELECT DISTINCT l.user_id, 'bigbet' FROM `__stage_0066_labels` l
WHERE NOT EXISTS (SELECT 1 FROM `game_group` g WHERE g.user_id=l.user_id);--> statement-breakpoint
INSERT INTO `game_group` (id,user_id,builtin_key,label,blind1_label,blind2_label,blind3_label,created_at,updated_at)
SELECT n.user_id||':builtin-group:'||n.group_key,n.user_id,n.group_key,
 CASE n.group_key WHEN 'bigbet' THEN 'Big Bet' WHEN 'limit' THEN 'Limit' ELSE 'Stud' END,
 CASE n.group_key WHEN 'bigbet' THEN 'SB' ELSE 'Small Bet' END,
 CASE n.group_key WHEN 'bigbet' THEN 'BB' ELSE 'Big Bet' END,
 CASE n.group_key WHEN 'bigbet' THEN 'Straddle' WHEN 'stud' THEN 'Bring-in' END,unixepoch(),unixepoch()
FROM `__stage_0066_needed_group` n
WHERE NOT EXISTS (SELECT 1 FROM `game_group` g WHERE g.user_id=n.user_id AND (g.builtin_key=n.group_key OR lower(trim(g.label))=lower(CASE n.group_key WHEN 'bigbet' THEN 'Big Bet' WHEN 'limit' THEN 'Limit' ELSE 'Stud' END)));--> statement-breakpoint
INSERT INTO `game_variant` (id,user_id,builtin_key,label,short_label,group_id,sort_order,created_at,updated_at)
SELECT DISTINCT l.user_id||':builtin-variant:'||b.key,l.user_id,b.key,b.label,b.short_label,
 COALESCE((SELECT g.id FROM `game_group` g WHERE g.user_id=l.user_id AND g.builtin_key=b.group_key ORDER BY g.id LIMIT 1),
 (SELECT g.id FROM `game_group` g WHERE g.user_id=l.user_id AND lower(trim(g.label))=lower(CASE b.group_key WHEN 'bigbet' THEN 'Big Bet' WHEN 'limit' THEN 'Limit' ELSE 'Stud' END) ORDER BY g.id LIMIT 1)),b.sort_order,unixepoch(),unixepoch()
FROM `__stage_0066_labels` l JOIN `__stage_0066_builtin` b ON lower(trim(l.label)) IN (b.key,lower(trim(b.label)))
WHERE NOT EXISTS (SELECT 1 FROM `game_variant` v WHERE v.user_id=l.user_id AND (lower(trim(v.label)) IN (lower(trim(l.label)),lower(trim(b.label))) OR v.builtin_key=b.key));--> statement-breakpoint
CREATE TABLE `__stage_0066_resolved` AS
SELECT l.*, COALESCE(
 (SELECT v.id FROM `game_variant` v WHERE v.user_id=l.user_id AND lower(trim(v.label))=lower(trim(l.label)) ORDER BY v.id LIMIT 1),
 (SELECT v.id FROM `game_variant` v JOIN `__stage_0066_builtin` b ON lower(trim(l.label)) IN (b.key,lower(trim(b.label))) WHERE v.user_id=l.user_id AND (v.builtin_key=b.key OR lower(trim(v.label))=lower(trim(b.label))) ORDER BY (v.builtin_key=b.key) DESC,v.id LIMIT 1)
) AS variant_id FROM `__stage_0066_labels` l;--> statement-breakpoint
-- Unknown games use the first resolved sibling's group, then Big Bet, then an
-- existing group. One stand-in per owner and ASCII-normalized label.
INSERT INTO `game_variant` (id,user_id,builtin_key,label,short_label,group_id,sort_order,archived_at,created_at,updated_at)
SELECT 'standin-variant:'||x.user_id||':'||lower(trim(x.label)),x.user_id,NULL,x.label,NULL,
 COALESCE((SELECT v.group_id FROM `__stage_0066_resolved` s JOIN `game_variant` v ON v.id=s.variant_id AND v.user_id=s.user_id WHERE s.ring_id=x.ring_id AND s.source_pos=x.source_pos ORDER BY s.variant_pos LIMIT 1),
 (SELECT g.id FROM `game_group` g WHERE g.user_id=x.user_id AND g.builtin_key='bigbet' ORDER BY g.id LIMIT 1),
 (SELECT g.id FROM `game_group` g WHERE g.user_id=x.user_id ORDER BY g.created_at,g.id LIMIT 1)),0,unixepoch(),unixepoch(),unixepoch()
FROM `__stage_0066_resolved` x
WHERE x.variant_id IS NULL AND x.rowid=(SELECT min(y.rowid) FROM `__stage_0066_resolved` y WHERE y.user_id=x.user_id AND lower(trim(y.label))=lower(trim(x.label)));--> statement-breakpoint
UPDATE `__stage_0066_resolved` SET variant_id='standin-variant:'||user_id||':'||lower(trim(label)) WHERE variant_id IS NULL;--> statement-breakpoint

-- Collapse duplicates across the entire lineup, preserving first appearance.
CREATE TABLE `__stage_0066_items` AS
SELECT * FROM `__stage_0066_resolved` x WHERE x.rowid=(SELECT y.rowid FROM `__stage_0066_resolved` y WHERE y.ring_id=x.ring_id AND y.variant_id=x.variant_id ORDER BY y.source_pos,y.variant_pos,y.rowid LIMIT 1);--> statement-breakpoint
CREATE TABLE `__stage_0066_final_groups` AS
SELECT i.ring_id,i.user_id,i.source_pos,
 row_number() OVER (PARTITION BY i.ring_id ORDER BY i.source_pos)-1 AS position,
 (SELECT v.group_id FROM `__stage_0066_items` a JOIN `game_variant` v ON v.id=a.variant_id AND v.user_id=a.user_id WHERE a.ring_id=i.ring_id AND a.source_pos=i.source_pos ORDER BY a.variant_pos LIMIT 1) AS group_id
FROM `__stage_0066_items` i GROUP BY i.ring_id,i.user_id,i.source_pos;--> statement-breakpoint

-- A legacy named mix keeps its saved identity and snapshot, not today's junction.
CREATE TABLE `__stage_0066_mix` AS
SELECT r.id AS ring_id,r.user_id,trim(r.variant) AS label,
 sel.mix_id AS mix_id
FROM `__stage_0066_ring` r JOIN `__stage_0066_selection` sel ON sel.ring_id=r.id
WHERE lower(trim(r.variant)) <> 'mix' AND sel.single_game=0 AND (sel.mix_id IS NOT NULL OR EXISTS (SELECT 1 FROM `__stage_0066_groups` g JOIN `__stage_0066_items` i ON i.ring_id=g.ring_id AND i.source_pos=g.source_pos WHERE g.ring_id=r.id));--> statement-breakpoint
INSERT INTO `game_mix` (id,user_id,builtin_key,label,games,archived_at,created_at,updated_at)
SELECT 'standin-mix:'||x.user_id||':'||lower(trim(x.label)),x.user_id,NULL,x.label,'[]',unixepoch(),unixepoch(),unixepoch()
FROM `__stage_0066_mix` x WHERE x.mix_id IS NULL AND x.rowid=(SELECT min(y.rowid) FROM `__stage_0066_mix` y WHERE y.user_id=x.user_id AND lower(trim(y.label))=lower(trim(x.label)));--> statement-breakpoint
UPDATE `__stage_0066_mix` SET mix_id='standin-mix:'||user_id||':'||lower(trim(label)) WHERE mix_id IS NULL;--> statement-breakpoint
INSERT INTO `game_mix_variant` (mix_id,variant_id,user_id,position)
SELECT m.mix_id,i.variant_id,m.user_id,row_number() OVER (PARTITION BY m.mix_id ORDER BY i.source_pos,i.variant_pos)-1
FROM `__stage_0066_mix` m JOIN `__stage_0066_items` i ON i.ring_id=m.ring_id
WHERE m.mix_id LIKE 'standin-mix:%' AND m.rowid=(SELECT min(n.rowid) FROM `__stage_0066_mix` n WHERE n.mix_id=m.mix_id);--> statement-breakpoint
INSERT INTO `game_lineup` (id,user_id,game_mix_id,created_at)
SELECT 'lu:cr:'||r.id,r.user_id,m.mix_id,r.created_at FROM `__stage_0066_ring` r LEFT JOIN `__stage_0066_mix` m ON m.ring_id=r.id;--> statement-breakpoint
INSERT INTO `game_lineup_group` (id,user_id,lineup_id,position,game_group_id,name,created_at)
SELECT 'lu:cr:'||g.ring_id||':'||g.position,g.user_id,'lu:cr:'||g.ring_id,g.position,g.group_id,
 CASE WHEN json_type(s.body,'$.name')='text' AND trim(json_extract(s.body,'$.name'))<>'' AND lower(trim(json_extract(s.body,'$.name')))<>lower(trim(gg.label)) AND NOT (lower(trim(json_extract(s.body,'$.name'))) LIKE lower(trim(gg.label))||' %' AND length(substr(trim(json_extract(s.body,'$.name')),length(trim(gg.label))+2))>0 AND substr(trim(json_extract(s.body,'$.name')),length(trim(gg.label))+2) NOT GLOB '*[^0-9]*') THEN trim(json_extract(s.body,'$.name')) END,r.created_at
FROM `__stage_0066_final_groups` g JOIN `__stage_0066_ring` r ON r.id=g.ring_id JOIN `game_group` gg ON gg.id=g.group_id LEFT JOIN `__stage_0066_groups` s ON s.ring_id=g.ring_id AND s.source_pos=g.source_pos;--> statement-breakpoint
INSERT INTO `game_lineup_variant` (user_id,lineup_id,lineup_group_id,variant_id,position)
SELECT i.user_id,'lu:cr:'||i.ring_id,'lu:cr:'||i.ring_id||':'||g.position,i.variant_id,row_number() OVER (PARTITION BY i.ring_id,i.source_pos ORDER BY i.variant_pos)-1
FROM `__stage_0066_items` i JOIN `__stage_0066_final_groups` g ON g.ring_id=i.ring_id AND g.source_pos=i.source_pos;--> statement-breakpoint
INSERT INTO `cash_rule` (id,user_id,ring_game_id,parent_rule_id,lineup_id,min_buy_in,max_buy_in,table_size,house_rules,created_at)
SELECT 'cr:'||r.id,r.user_id,NULL,NULL,'lu:cr:'||r.id,n.min_buy_in,n.max_buy_in,n.table_size,r.house_rules,r.created_at FROM `__stage_0066_ring` r JOIN `__stage_0066_values` n ON n.id=r.id;--> statement-breakpoint
INSERT INTO `cash_rule_stake` (user_id,rule_id,lineup_group_id,lineup_id,blind1,blind2,blind3,ante,ante_type)
SELECT g.user_id,'cr:'||g.ring_id,'lu:cr:'||g.ring_id||':'||g.position,'lu:cr:'||g.ring_id,
 COALESCE(CASE WHEN json_type(s.body,'$.blind1')='integer' AND json_extract(s.body,'$.blind1')>=0 THEN json_extract(s.body,'$.blind1') END,n.blind1),
 COALESCE(CASE WHEN json_type(s.body,'$.blind2')='integer' AND json_extract(s.body,'$.blind2')>=0 THEN json_extract(s.body,'$.blind2') END,n.blind2),
 COALESCE(CASE WHEN json_type(s.body,'$.blind3')='integer' AND json_extract(s.body,'$.blind3')>=0 THEN json_extract(s.body,'$.blind3') END,n.blind3),
 COALESCE(CASE WHEN json_type(s.body,'$.ante')='integer' AND json_extract(s.body,'$.ante')>=0 THEN json_extract(s.body,'$.ante') END,n.ante),
 COALESCE(CASE WHEN json_type(s.body,'$.anteType')='text' AND json_extract(s.body,'$.anteType') IN ('none','all','bb') THEN json_extract(s.body,'$.anteType') END,n.ante_type)
FROM `__stage_0066_final_groups` g JOIN `__stage_0066_values` n ON n.id=g.ring_id LEFT JOIN `__stage_0066_groups` s ON s.ring_id=g.ring_id AND s.source_pos=g.source_pos;--> statement-breakpoint
DROP TABLE `ring_game`;--> statement-breakpoint
CREATE TABLE `ring_game` (
 `id` text PRIMARY KEY NOT NULL, `room_id` text, `user_id` text NOT NULL,
 `name` text NOT NULL, `memo` text, `default_asset_id` text, `current_rule_id` text NOT NULL,
 `archived_at` integer, `created_at` integer DEFAULT (unixepoch()) NOT NULL, `updated_at` integer NOT NULL,
 FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
 FOREIGN KEY (`room_id`,`user_id`) REFERENCES `room`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
 FOREIGN KEY (`default_asset_id`,`user_id`) REFERENCES `asset`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
 FOREIGN KEY (`current_rule_id`,`user_id`) REFERENCES `cash_rule`(`id`,`user_id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `ring_game_id_user_id_unique` ON `ring_game` (`id`,`user_id`);--> statement-breakpoint
CREATE INDEX `ring_game_room_idx` ON `ring_game` (`room_id`);--> statement-breakpoint
CREATE INDEX `ring_game_user_idx` ON `ring_game` (`user_id`);--> statement-breakpoint
CREATE INDEX `ring_game_asset_idx` ON `ring_game` (`default_asset_id`);--> statement-breakpoint
CREATE INDEX `ring_game_rule_idx` ON `ring_game` (`current_rule_id`);--> statement-breakpoint
INSERT INTO `ring_game` (id,room_id,user_id,name,memo,default_asset_id,current_rule_id,archived_at,created_at,updated_at)
SELECT r.id,r.room_id,r.user_id,r.name,r.memo,n.asset_id,'cr:'||r.id,r.archived_at,r.created_at,r.updated_at FROM `__stage_0066_ring` r JOIN `__stage_0066_values` n ON n.id=r.id;--> statement-breakpoint
UPDATE `cash_rule` SET ring_game_id=substr(id,4) WHERE id IN (SELECT 'cr:'||id FROM `__stage_0066_ring`);--> statement-breakpoint
UPDATE `session_cash_detail` SET ring_game_id=(SELECT s.ring_game_id FROM `__stage_0066_session` s WHERE s.session_id=session_cash_detail.session_id) WHERE session_id IN (SELECT session_id FROM `__stage_0066_session`);--> statement-breakpoint
UPDATE `entry_cash` SET ring_game_id=(SELECT s.ring_game_id FROM `__stage_0066_entry` s WHERE s.entry_id=entry_cash.entry_id) WHERE entry_id IN (SELECT entry_id FROM `__stage_0066_entry`);--> statement-breakpoint

INSERT INTO `__gate_0066` (masters) SELECT NULL WHERE EXISTS (
 SELECT r.id,r.room_id,r.user_id,r.name,r.memo,n.asset_id,'cr:'||r.id,r.archived_at,r.created_at,r.updated_at FROM `__stage_0066_ring` r JOIN `__stage_0066_values` n ON n.id=r.id
 EXCEPT SELECT id,room_id,user_id,name,memo,default_asset_id,current_rule_id,archived_at,created_at,updated_at FROM `ring_game`
) OR (SELECT count(*) FROM `ring_game`)<>(SELECT count(*) FROM `__stage_0066_ring`);--> statement-breakpoint
INSERT INTO `__gate_0066` (children) SELECT NULL WHERE EXISTS (
 SELECT session_id,ring_game_id FROM `__stage_0066_session` EXCEPT SELECT session_id,ring_game_id FROM `session_cash_detail` WHERE ring_game_id IS NOT NULL
) OR EXISTS (SELECT entry_id,user_id,ring_game_id FROM `__stage_0066_entry` EXCEPT SELECT entry_id,user_id,ring_game_id FROM `entry_cash` WHERE ring_game_id IS NOT NULL)
 OR (SELECT count(*) FROM `__stage_0066_session`)<>(SELECT count(*) FROM `session_cash_detail` WHERE ring_game_id IS NOT NULL)
 OR (SELECT count(*) FROM `__stage_0066_entry`)<>(SELECT count(*) FROM `entry_cash` WHERE ring_game_id IS NOT NULL)
 OR (SELECT sessions FROM `__stage_0066_child_counts`)<>(SELECT count(*) FROM `session_cash_detail`)
 OR (SELECT entries FROM `__stage_0066_child_counts`)<>(SELECT count(*) FROM `entry_cash`)
 OR EXISTS (SELECT session_id,ring_game_id FROM `session_cash_detail` WHERE ring_game_id IS NOT NULL EXCEPT SELECT session_id,ring_game_id FROM `__stage_0066_session`)
 OR EXISTS (SELECT entry_id,user_id,ring_game_id FROM `entry_cash` WHERE ring_game_id IS NOT NULL EXCEPT SELECT entry_id,user_id,ring_game_id FROM `__stage_0066_entry`);--> statement-breakpoint
INSERT INTO `__gate_0066` (rules) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `__stage_0066_ring` s JOIN `__stage_0066_values` n ON n.id=s.id LEFT JOIN `ring_game` m ON m.id=s.id LEFT JOIN `cash_rule` r ON r.id=m.current_rule_id AND r.user_id=m.user_id
 WHERE m.current_rule_id IS NULL OR r.id IS NULL OR r.ring_game_id IS NOT s.id OR r.parent_rule_id IS NOT NULL OR r.lineup_id IS NOT 'lu:cr:'||s.id OR r.min_buy_in IS NOT n.min_buy_in OR r.max_buy_in IS NOT n.max_buy_in OR r.table_size IS NOT n.table_size OR r.house_rules IS NOT s.house_rules
) OR (SELECT count(*) FROM `cash_rule`)<>(SELECT count(*) FROM `__stage_0066_ring`);--> statement-breakpoint
INSERT INTO `__gate_0066` (lineups) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `cash_rule` r LEFT JOIN `game_lineup_group` g ON g.lineup_id=r.lineup_id LEFT JOIN `cash_rule_stake` s ON s.rule_id=r.id AND s.lineup_group_id=g.id
 GROUP BY r.id,g.id HAVING g.id IS NULL OR count(s.rule_id)<>1
) OR EXISTS (SELECT 1 FROM `game_lineup_group` g WHERE g.lineup_id IN (SELECT lineup_id FROM `cash_rule`) AND NOT EXISTS (SELECT 1 FROM `game_lineup_variant` v WHERE v.lineup_group_id=g.id));--> statement-breakpoint
INSERT INTO `__gate_0066` (lineups) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `__stage_0066_final_groups` g JOIN `__stage_0066_values` n ON n.id=g.ring_id
 LEFT JOIN `__stage_0066_groups` j ON j.ring_id=g.ring_id AND j.source_pos=g.source_pos
 LEFT JOIN `cash_rule_stake` s ON s.rule_id='cr:'||g.ring_id AND s.lineup_group_id='lu:cr:'||g.ring_id||':'||g.position
 LEFT JOIN `game_lineup_group` lg ON lg.id=s.lineup_group_id
 WHERE lg.game_group_id IS NOT g.group_id OR
 s.blind1 IS NOT COALESCE(CASE WHEN json_type(j.body,'$.blind1')='integer' AND json_extract(j.body,'$.blind1')>=0 THEN json_extract(j.body,'$.blind1') END,n.blind1) OR
 s.blind2 IS NOT COALESCE(CASE WHEN json_type(j.body,'$.blind2')='integer' AND json_extract(j.body,'$.blind2')>=0 THEN json_extract(j.body,'$.blind2') END,n.blind2) OR
 s.blind3 IS NOT COALESCE(CASE WHEN json_type(j.body,'$.blind3')='integer' AND json_extract(j.body,'$.blind3')>=0 THEN json_extract(j.body,'$.blind3') END,n.blind3) OR
 s.ante IS NOT COALESCE(CASE WHEN json_type(j.body,'$.ante')='integer' AND json_extract(j.body,'$.ante')>=0 THEN json_extract(j.body,'$.ante') END,n.ante) OR
 s.ante_type IS NOT COALESCE(CASE WHEN json_type(j.body,'$.anteType')='text' AND json_extract(j.body,'$.anteType') IN ('none','all','bb') THEN json_extract(j.body,'$.anteType') END,n.ante_type)
) OR EXISTS (
 SELECT 1 FROM `__stage_0066_items` i JOIN `__stage_0066_final_groups` g ON g.ring_id=i.ring_id AND g.source_pos=i.source_pos
 WHERE NOT EXISTS (SELECT 1 FROM `game_lineup_variant` v WHERE v.lineup_group_id='lu:cr:'||g.ring_id||':'||g.position AND v.variant_id=i.variant_id)
) OR EXISTS (
 SELECT 1 FROM `__stage_0066_ring` r JOIN `game_lineup` l ON l.id='lu:cr:'||r.id LEFT JOIN `__stage_0066_mix` m ON m.ring_id=r.id WHERE l.game_mix_id IS NOT m.mix_id
);--> statement-breakpoint
INSERT INTO `__gate_0066` (lineups) SELECT NULL WHERE
 (SELECT count(*) FROM `__stage_0066_final_groups`)<>(SELECT count(*) FROM `game_lineup_group` WHERE lineup_id IN (SELECT lineup_id FROM `cash_rule`))
 OR (SELECT count(*) FROM `__stage_0066_items`)<>(SELECT count(*) FROM `game_lineup_variant` WHERE lineup_id IN (SELECT lineup_id FROM `cash_rule`))
 OR EXISTS (
 SELECT 'lu:cr:'||i.ring_id||':'||g.position,i.variant_id,row_number() OVER (PARTITION BY i.ring_id,i.source_pos ORDER BY i.variant_pos)-1
 FROM `__stage_0066_items` i JOIN `__stage_0066_final_groups` g ON g.ring_id=i.ring_id AND g.source_pos=i.source_pos
 EXCEPT SELECT lineup_group_id,variant_id,position FROM `game_lineup_variant` WHERE lineup_id IN (SELECT lineup_id FROM `cash_rule`)
);--> statement-breakpoint
INSERT INTO `__gate_0066` (foreign_keys) SELECT NULL WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check);--> statement-breakpoint
DROP TABLE `__stage_0066_mix`;--> statement-breakpoint
DROP TABLE `__stage_0066_final_groups`;--> statement-breakpoint
DROP TABLE `__stage_0066_items`;--> statement-breakpoint
DROP TABLE `__stage_0066_resolved`;--> statement-breakpoint
DROP TABLE `__stage_0066_needed_group`;--> statement-breakpoint
DROP TABLE `__stage_0066_labels`;--> statement-breakpoint
DROP TABLE `__stage_0066_groups`;--> statement-breakpoint
DROP TABLE `__stage_0066_values`;--> statement-breakpoint
DROP TABLE `__stage_0066_selection`;--> statement-breakpoint
DROP TABLE `__stage_0066_builtin`;--> statement-breakpoint
DROP TABLE `__stage_0066_child_counts`;--> statement-breakpoint
DROP TABLE `__stage_0066_entry`;--> statement-breakpoint
DROP TABLE `__stage_0066_session`;--> statement-breakpoint
DROP TABLE `__stage_0066_ring`;--> statement-breakpoint
DROP TABLE `__gate_0066`;
