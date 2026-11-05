-- Data model v2, B13 (SA2-398): give every entry detail its rule version and
-- every priced ledger line its tournament price, then rebuild entry_cash and
-- entry_tournament with NOT NULL rule ids (game-lineups.md, data-model-v2.md §16).
--
-- An entry's snapshot (session_cash_detail, or session_tournament_detail with
-- session_blind_level and session_chip_purchase) is resolved with B07's cash and
-- B08's tournament label rules into a candidate version. Candidates and master
-- versions are compared once, here, by a fingerprint of the ordered lineup,
-- stakes, scalar fields, levels and prices; house rules compare after CRLF/CR
-- to LF and whitespace trimming, as the legacy drift check did. A linked entry
-- equal to its master's current version shares it; a differing one gets the
-- child cr:e:<entry_id> / tr:e:<entry_id>, shared by later equal entries of the
-- same master in (created_at, id) order; an unlinked entry gets its own
-- parentless version. A child reuses a master lineup with the same composition.
--
-- A live tournament entry without its own buy-in or fee pays its master's
-- entry price, as B09 folded it; prices pay in the entry's asset, else the
-- master's default asset, else the owner's Unassigned asset. Tournament buy_in
-- and fee lines take their version's entry price; a chip_purchase line takes
-- the addon price at its session chip purchase's snapshot position (manual
-- lines by unit number, live lines by the event's sessionChipPurchaseId).
--
-- Each gate inserts NULL into its own NOT NULL column of __gate_0069.
CREATE TABLE `__gate_0069` (
 `precondition` integer DEFAULT 1 NOT NULL,
 `rule_ids` integer DEFAULT 1 NOT NULL,
 `same_master` integer DEFAULT 1 NOT NULL,
 `entry_content` integer DEFAULT 1 NOT NULL,
 `stake_coverage` integer DEFAULT 1 NOT NULL,
 `lineups` integer DEFAULT 1 NOT NULL,
 `prices` integer DEFAULT 1 NOT NULL,
 `ledger_preserved` integer DEFAULT 1 NOT NULL,
 `big_bet_blind3` integer DEFAULT 1 NOT NULL,
 `details_rebuilt` integer DEFAULT 1 NOT NULL,
 `foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
INSERT INTO `__gate_0069` (`precondition`) SELECT NULL WHERE EXISTS (SELECT 1 FROM `entry_cash` WHERE `cash_rule_id` IS NOT NULL)
 OR EXISTS (SELECT 1 FROM `entry_tournament` WHERE `tournament_rule_id` IS NOT NULL)
 OR EXISTS (SELECT 1 FROM `ledger_line` WHERE `price_id` IS NOT NULL);--> statement-breakpoint
CREATE TABLE `__stage_0069_ledger` AS SELECT id,user_id,asset_id,quantity,role,effect,entry_id,play_session_id,source_event_id,category_id,transfer_id,occurred_at,memo,created_at,updated_at FROM `ledger_line`;--> statement-breakpoint
CREATE TABLE `__stage_0069_counts` AS SELECT (SELECT count(*) FROM `entry_cash`) AS cash, (SELECT count(*) FROM `entry_tournament`) AS tournament;--> statement-breakpoint

-- Owners with no game masters were never seeded; give them B07's default set.
CREATE TABLE `__stage_0069_builtin` (`key` text, `label` text, `short_label` text, `group_key` text, `sort_order` integer);--> statement-breakpoint
INSERT INTO `__stage_0069_builtin` VALUES
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
CREATE TABLE `__stage_0069_unseeded` AS
SELECT DISTINCT e.user_id FROM `entry` e
WHERE NOT EXISTS (SELECT 1 FROM `game_group` g WHERE g.user_id=e.user_id)
 AND NOT EXISTS (SELECT 1 FROM `game_variant` v WHERE v.user_id=e.user_id)
 AND NOT EXISTS (SELECT 1 FROM `game_mix` m WHERE m.user_id=e.user_id);--> statement-breakpoint
CREATE TABLE `__stage_0069_seed_group` (`key` text, `label` text, `b1` text, `b2` text, `b3` text);--> statement-breakpoint
INSERT INTO `__stage_0069_seed_group` VALUES
 ('limit','Limit','Small Bet','Big Bet',NULL),('stud','Stud','Small Bet','Big Bet','Bring-in'),('bigbet','Big Bet','SB','BB',NULL);--> statement-breakpoint
CREATE TABLE `__stage_0069_seed_mix` (`key` text, `label` text);--> statement-breakpoint
INSERT INTO `__stage_0069_seed_mix` VALUES ('horse','HORSE'),('8game','8-Game'),('10game','10-Game');--> statement-breakpoint
CREATE TABLE `__stage_0069_seed_member` (`mix` text, `variant` text, `position` integer);--> statement-breakpoint
INSERT INTO `__stage_0069_seed_member` VALUES
 ('horse','lhe',0),('horse','o8',1),('horse','razz',2),('horse','stud',3),('horse','stud8',4),
 ('8game','27td',0),('8game','lhe',1),('8game','o8',2),('8game','razz',3),('8game','stud',4),('8game','stud8',5),('8game','nlh',6),('8game','plo',7),
 ('10game','27td',0),('10game','lhe',1),('10game','o8',2),('10game','badugi',3),('10game','razz',4),('10game','stud',5),('10game','stud8',6),('10game','nlh',7),('10game','plo',8),('10game','27sd',9);--> statement-breakpoint
INSERT INTO `game_group` (id,user_id,builtin_key,label,blind1_label,blind2_label,blind3_label,blind1_required,blind2_required,created_at,updated_at)
SELECT u.user_id||':builtin-group:'||k.key,u.user_id,k.key,k.label,k.b1,k.b2,k.b3,1,1,unixepoch(),unixepoch()
FROM `__stage_0069_unseeded` u CROSS JOIN `__stage_0069_seed_group` k;--> statement-breakpoint
INSERT INTO `game_variant` (id,user_id,builtin_key,label,short_label,group_id,sort_order,created_at,updated_at)
SELECT u.user_id||':builtin-variant:'||b.key,u.user_id,b.key,b.label,b.short_label,u.user_id||':builtin-group:'||b.group_key,b.sort_order,unixepoch(),unixepoch()
FROM `__stage_0069_unseeded` u CROSS JOIN `__stage_0069_builtin` b;--> statement-breakpoint
INSERT INTO `game_mix` (id,user_id,builtin_key,label,games,created_at,updated_at)
SELECT u.user_id||':builtin-mix:'||k.key,u.user_id,k.key,k.label,'[]',unixepoch(),unixepoch()
FROM `__stage_0069_unseeded` u CROSS JOIN `__stage_0069_seed_mix` k;--> statement-breakpoint
INSERT INTO `game_mix_variant` (mix_id,user_id,variant_id,position)
SELECT u.user_id||':builtin-mix:'||k.mix,u.user_id,u.user_id||':builtin-variant:'||k.variant,k.position
FROM `__stage_0069_unseeded` u CROSS JOIN `__stage_0069_seed_member` k;--> statement-breakpoint
DROP TABLE `__stage_0069_seed_member`;--> statement-breakpoint
DROP TABLE `__stage_0069_seed_mix`;--> statement-breakpoint
DROP TABLE `__stage_0069_seed_group`;--> statement-breakpoint
DROP TABLE `__stage_0069_unseeded`;--> statement-breakpoint

-- Fingerprints of every master's current lineups (default and level lineups).
CREATE TABLE `__stage_0069_master_lineup` AS
SELECT DISTINCT g.lineup_id, g.user_id,
 quote(l.game_mix_id)||'|'||group_concat(quote(g.position)||':'||quote(g.game_group_id)||':'||quote(v.position)||':'||quote(v.variant_id),',') OVER (PARTITION BY g.lineup_id ORDER BY g.position,v.position ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
FROM `game_lineup` l JOIN `game_lineup_group` g ON g.lineup_id=l.id AND g.user_id=l.user_id
JOIN `game_lineup_variant` v ON v.lineup_group_id=g.id AND v.user_id=g.user_id
WHERE l.id IN (SELECT c.lineup_id FROM `cash_rule` c JOIN `ring_game` r ON r.current_rule_id=c.id AND r.user_id=c.user_id)
 OR l.id IN (SELECT c.lineup_id FROM `tournament_rule` c JOIN `tournament` t ON t.current_rule_id=c.id AND t.user_id=c.user_id)
 OR l.id IN (SELECT lv.lineup_id FROM `tournament_rule_level` lv JOIN `tournament` t ON t.current_rule_id=lv.rule_id AND t.user_id=lv.user_id);--> statement-breakpoint

-- Cash snapshots, normalized like B07's master values.
CREATE TABLE `__stage_0069_cash` AS
SELECT ec.entry_id AS id, ec.user_id, ec.ring_game_id, e.created_at,
 COALESCE(scd.variant,'NL Hold''em') AS variant, scd.mix_games,
 CASE WHEN typeof(scd.min_buy_in)='integer' AND scd.min_buy_in>=0 THEN scd.min_buy_in END AS min_buy_in,
 CASE WHEN typeof(scd.max_buy_in)='integer' AND scd.max_buy_in>=0 AND (scd.min_buy_in IS NULL OR typeof(scd.min_buy_in)<>'integer' OR scd.min_buy_in<0 OR scd.max_buy_in>=scd.min_buy_in) THEN scd.max_buy_in END AS max_buy_in,
 CASE WHEN typeof(scd.table_size)='integer' AND scd.table_size BETWEEN 2 AND 10 THEN scd.table_size END AS table_size,
 CASE WHEN typeof(scd.blind1)='integer' AND scd.blind1>=0 THEN scd.blind1 END AS blind1,
 CASE WHEN typeof(scd.blind2)='integer' AND scd.blind2>=0 THEN scd.blind2 END AS blind2,
 CASE WHEN typeof(scd.blind3)='integer' AND scd.blind3>=0 THEN scd.blind3 END AS blind3,
 CASE WHEN typeof(scd.ante)='integer' AND scd.ante>=0 THEN scd.ante END AS ante,
 CASE WHEN scd.ante_type IN ('none','all','bb') THEN scd.ante_type END AS ante_type,
 scd.house_rules
FROM `entry_cash` ec JOIN `entry` e ON e.id=ec.entry_id AND e.user_id=ec.user_id
LEFT JOIN `session_cash_detail` scd ON scd.session_id=ec.entry_id;--> statement-breakpoint
CREATE TABLE `__stage_0069_cash_selection` AS
SELECT r.id AS entry_id,
 CASE WHEN lower(trim(r.variant))='mix' THEN 0
 WHEN EXISTS (SELECT 1 FROM `game_variant` v WHERE v.user_id=r.user_id AND lower(trim(v.label))=lower(trim(r.variant))) THEN 1
 WHEN EXISTS (SELECT 1 FROM `__stage_0069_builtin` b WHERE lower(trim(r.variant)) IN (b.key,lower(trim(b.label)))) THEN 1
 ELSE 0 END AS single_game,
 COALESCE((SELECT m.id FROM `game_mix` m WHERE m.user_id=r.user_id AND lower(trim(m.label))=lower(trim(r.variant)) ORDER BY m.id LIMIT 1),
 (SELECT m.id FROM `game_mix` m WHERE m.user_id=r.user_id AND m.builtin_key=lower(trim(r.variant)) ORDER BY m.id LIMIT 1)) AS mix_id
FROM `__stage_0069_cash` r;--> statement-breakpoint
CREATE TABLE `__stage_0069_cash_groups` AS
SELECT r.id AS entry_id, r.user_id, CAST(j.key AS integer) AS source_pos, j.value AS body
FROM `__stage_0069_cash` r JOIN `__stage_0069_cash_selection` selection ON selection.entry_id=r.id,
 json_each(CASE WHEN json_valid(r.mix_games) THEN CASE WHEN json_type(r.mix_games) = 'array' THEN r.mix_games ELSE '[]' END ELSE '[]' END) j
WHERE j.type = 'object' AND selection.single_game=0;--> statement-breakpoint
CREATE TABLE `__stage_0069_cash_labels` AS
SELECT g.entry_id, g.user_id, g.source_pos, CAST(v.key AS integer) AS variant_pos, trim(v.value) AS label
FROM `__stage_0069_cash_groups` g,
 json_each(CASE WHEN json_type(g.body, '$.variants') = 'array' THEN json_extract(g.body, '$.variants') ELSE '[]' END) v
WHERE v.type = 'text' AND length(trim(v.value)) > 0;--> statement-breakpoint
DELETE FROM `__stage_0069_cash_groups` WHERE NOT EXISTS (SELECT 1 FROM `__stage_0069_cash_labels` l WHERE l.entry_id=__stage_0069_cash_groups.entry_id AND l.source_pos=__stage_0069_cash_groups.source_pos);--> statement-breakpoint
INSERT INTO `__stage_0069_cash_groups` (entry_id,user_id,source_pos,body)
SELECT r.id,r.user_id,min(mv.position),NULL
FROM `__stage_0069_cash` r JOIN `__stage_0069_cash_selection` sel ON sel.entry_id=r.id AND sel.single_game=0 AND lower(trim(r.variant))<>'mix'
JOIN `game_mix_variant` mv ON mv.mix_id=sel.mix_id AND mv.user_id=r.user_id
JOIN `game_variant` v ON v.id=mv.variant_id AND v.user_id=mv.user_id
WHERE NOT EXISTS (SELECT 1 FROM `__stage_0069_cash_labels` l WHERE l.entry_id=r.id)
GROUP BY r.id,r.user_id,v.group_id;--> statement-breakpoint
INSERT INTO `__stage_0069_cash_labels` (entry_id,user_id,source_pos,variant_pos,label)
SELECT r.id,r.user_id,(SELECT min(m2.position) FROM `game_mix_variant` m2 JOIN `game_variant` v2 ON v2.id=m2.variant_id AND v2.user_id=m2.user_id WHERE m2.mix_id=mv.mix_id AND v2.group_id=v.group_id),
 mv.position,v.label
FROM `__stage_0069_cash` r JOIN `__stage_0069_cash_selection` sel ON sel.entry_id=r.id AND sel.single_game=0
JOIN `game_mix_variant` mv ON mv.mix_id=sel.mix_id AND mv.user_id=r.user_id
JOIN `game_variant` v ON v.id=mv.variant_id AND v.user_id=mv.user_id
WHERE EXISTS (SELECT 1 FROM `__stage_0069_cash_groups` g WHERE g.entry_id=r.id AND g.body IS NULL);--> statement-breakpoint
INSERT INTO `__stage_0069_cash_labels` (entry_id,user_id,source_pos,variant_pos,label)
SELECT r.id,r.user_id,0,0,CASE WHEN lower(trim(r.variant))='mix' THEN 'Mixed Game' WHEN length(trim(r.variant)) > 0 THEN trim(r.variant) ELSE 'NL Hold''em' END
FROM `__stage_0069_cash` r WHERE NOT EXISTS (SELECT 1 FROM `__stage_0069_cash_labels` l WHERE l.entry_id=r.id);--> statement-breakpoint
CREATE TABLE `__stage_0069_needed_group` AS
SELECT DISTINCT l.user_id, b.group_key FROM `__stage_0069_cash_labels` l JOIN `__stage_0069_builtin` b ON lower(trim(l.label)) IN (b.key,lower(trim(b.label)))
WHERE NOT EXISTS (SELECT 1 FROM `game_variant` v WHERE v.user_id=l.user_id AND (lower(trim(v.label))=lower(trim(l.label)) OR v.builtin_key=b.key))
UNION
SELECT DISTINCT l.user_id, 'bigbet' FROM `__stage_0069_cash_labels` l
WHERE NOT EXISTS (SELECT 1 FROM `game_group` g WHERE g.user_id=l.user_id);--> statement-breakpoint
INSERT INTO `game_group` (id,user_id,builtin_key,label,blind1_label,blind2_label,blind3_label,blind1_required,blind2_required,created_at,updated_at)
SELECT n.user_id||':builtin-group:'||n.group_key,n.user_id,n.group_key,
 CASE n.group_key WHEN 'bigbet' THEN 'Big Bet' WHEN 'limit' THEN 'Limit' ELSE 'Stud' END,
 CASE n.group_key WHEN 'bigbet' THEN 'SB' ELSE 'Small Bet' END,
 CASE n.group_key WHEN 'bigbet' THEN 'BB' ELSE 'Big Bet' END,
 CASE n.group_key WHEN 'stud' THEN 'Bring-in' END,1,1,unixepoch(),unixepoch()
FROM `__stage_0069_needed_group` n
WHERE NOT EXISTS (SELECT 1 FROM `game_group` g WHERE g.user_id=n.user_id AND (g.builtin_key=n.group_key OR lower(trim(g.label))=lower(CASE n.group_key WHEN 'bigbet' THEN 'Big Bet' WHEN 'limit' THEN 'Limit' ELSE 'Stud' END)));--> statement-breakpoint
INSERT INTO `game_variant` (id,user_id,builtin_key,label,short_label,group_id,sort_order,created_at,updated_at)
SELECT DISTINCT l.user_id||':builtin-variant:'||b.key,l.user_id,b.key,b.label,b.short_label,
 COALESCE((SELECT g.id FROM `game_group` g WHERE g.user_id=l.user_id AND g.builtin_key=b.group_key ORDER BY g.id LIMIT 1),
 (SELECT g.id FROM `game_group` g WHERE g.user_id=l.user_id AND lower(trim(g.label))=lower(CASE b.group_key WHEN 'bigbet' THEN 'Big Bet' WHEN 'limit' THEN 'Limit' ELSE 'Stud' END) ORDER BY g.id LIMIT 1)),b.sort_order,unixepoch(),unixepoch()
FROM `__stage_0069_cash_labels` l JOIN `__stage_0069_builtin` b ON lower(trim(l.label)) IN (b.key,lower(trim(b.label)))
WHERE NOT EXISTS (SELECT 1 FROM `game_variant` v WHERE v.user_id=l.user_id AND (lower(trim(v.label)) IN (lower(trim(l.label)),lower(trim(b.label))) OR v.builtin_key=b.key));--> statement-breakpoint
CREATE TABLE `__stage_0069_cash_resolved` AS
SELECT l.*, COALESCE(
 (SELECT v.id FROM `game_variant` v WHERE v.user_id=l.user_id AND lower(trim(v.label))=lower(trim(l.label)) ORDER BY v.id LIMIT 1),
 (SELECT v.id FROM `game_variant` v JOIN `__stage_0069_builtin` b ON lower(trim(l.label)) IN (b.key,lower(trim(b.label))) WHERE v.user_id=l.user_id AND (v.builtin_key=b.key OR lower(trim(v.label))=lower(trim(b.label))) ORDER BY (v.builtin_key=b.key) DESC,v.id LIMIT 1)
) AS variant_id FROM `__stage_0069_cash_labels` l;--> statement-breakpoint
INSERT INTO `game_variant` (id,user_id,builtin_key,label,short_label,group_id,sort_order,archived_at,created_at,updated_at)
SELECT 'sv:'||x.user_id||':'||lower(trim(x.label)),x.user_id,NULL,x.label,NULL,
 COALESCE((SELECT v.group_id FROM `__stage_0069_cash_resolved` s JOIN `game_variant` v ON v.id=s.variant_id AND v.user_id=s.user_id WHERE s.entry_id=x.entry_id AND s.source_pos=x.source_pos ORDER BY s.variant_pos LIMIT 1),
 (SELECT g.id FROM `game_group` g WHERE g.user_id=x.user_id AND g.builtin_key='bigbet' ORDER BY g.id LIMIT 1),
 (SELECT g.id FROM `game_group` g WHERE g.user_id=x.user_id ORDER BY g.created_at,g.id LIMIT 1)),0,unixepoch(),unixepoch(),unixepoch()
FROM `__stage_0069_cash_resolved` x
WHERE x.variant_id IS NULL AND x.rowid=(SELECT min(y.rowid) FROM `__stage_0069_cash_resolved` y WHERE y.user_id=x.user_id AND lower(trim(y.label))=lower(trim(x.label)))
 AND NOT EXISTS (SELECT 1 FROM `game_variant` z WHERE z.id='sv:'||x.user_id||':'||lower(trim(x.label)));--> statement-breakpoint
UPDATE `__stage_0069_cash_resolved` SET variant_id='sv:'||user_id||':'||lower(trim(label)) WHERE variant_id IS NULL;--> statement-breakpoint
CREATE TABLE `__stage_0069_cash_items` AS
SELECT * FROM `__stage_0069_cash_resolved` x WHERE x.rowid=(SELECT y.rowid FROM `__stage_0069_cash_resolved` y WHERE y.entry_id=x.entry_id AND y.variant_id=x.variant_id ORDER BY y.source_pos,y.variant_pos,y.rowid LIMIT 1);--> statement-breakpoint
CREATE TABLE `__stage_0069_cash_final_groups` AS
SELECT i.entry_id,i.user_id,i.source_pos,
 row_number() OVER (PARTITION BY i.entry_id ORDER BY i.source_pos)-1 AS position,
 (SELECT v.group_id FROM `__stage_0069_cash_items` a JOIN `game_variant` v ON v.id=a.variant_id AND v.user_id=a.user_id WHERE a.entry_id=i.entry_id AND a.source_pos=i.source_pos ORDER BY a.variant_pos LIMIT 1) AS group_id
FROM `__stage_0069_cash_items` i GROUP BY i.entry_id,i.user_id,i.source_pos;--> statement-breakpoint
CREATE TABLE `__stage_0069_cash_mix` AS
SELECT r.id AS entry_id,r.user_id,trim(r.variant) AS label,sel.mix_id AS mix_id,0 AS created
FROM `__stage_0069_cash` r JOIN `__stage_0069_cash_selection` sel ON sel.entry_id=r.id
WHERE lower(trim(r.variant)) <> 'mix' AND sel.single_game=0 AND (sel.mix_id IS NOT NULL OR EXISTS (SELECT 1 FROM `__stage_0069_cash_groups` g JOIN `__stage_0069_cash_items` i ON i.entry_id=g.entry_id AND i.source_pos=g.source_pos WHERE g.entry_id=r.id));--> statement-breakpoint
INSERT INTO `game_mix` (id,user_id,builtin_key,label,games,archived_at,created_at,updated_at)
SELECT 'sm:'||x.user_id||':'||lower(trim(x.label)),x.user_id,NULL,x.label,'[]',unixepoch(),unixepoch(),unixepoch()
FROM `__stage_0069_cash_mix` x WHERE x.mix_id IS NULL AND x.rowid=(SELECT min(y.rowid) FROM `__stage_0069_cash_mix` y WHERE y.user_id=x.user_id AND lower(trim(y.label))=lower(trim(x.label)))
 AND NOT EXISTS (SELECT 1 FROM `game_mix` z WHERE z.id='sm:'||x.user_id||':'||lower(trim(x.label)));--> statement-breakpoint
UPDATE `__stage_0069_cash_mix` SET mix_id='sm:'||user_id||':'||lower(trim(label)),created=1 WHERE mix_id IS NULL;--> statement-breakpoint
INSERT INTO `game_mix_variant` (mix_id,variant_id,user_id,position)
SELECT m.mix_id,i.variant_id,m.user_id,row_number() OVER (PARTITION BY m.mix_id ORDER BY i.source_pos,i.variant_pos)-1
FROM `__stage_0069_cash_mix` m JOIN `__stage_0069_cash_items` i ON i.entry_id=m.entry_id
WHERE m.created=1 AND m.rowid=(SELECT min(n.rowid) FROM `__stage_0069_cash_mix` n WHERE n.mix_id=m.mix_id)
 AND NOT EXISTS (SELECT 1 FROM `game_mix_variant` z WHERE z.mix_id=m.mix_id);--> statement-breakpoint
CREATE TABLE `__stage_0069_cash_variant` AS
SELECT i.entry_id,i.user_id,g.position AS group_position,
 row_number() OVER (PARTITION BY i.entry_id,i.source_pos ORDER BY i.variant_pos)-1 AS position,i.variant_id
FROM `__stage_0069_cash_items` i JOIN `__stage_0069_cash_final_groups` g ON g.entry_id=i.entry_id AND g.source_pos=i.source_pos;--> statement-breakpoint
CREATE TABLE `__stage_0069_cash_stake` AS
SELECT g.entry_id,g.user_id,g.position,g.group_id,
 CASE WHEN json_type(s.body,'$.name')='text' AND trim(json_extract(s.body,'$.name'))<>'' AND lower(trim(json_extract(s.body,'$.name')))<>lower(trim(gg.label)) AND NOT (lower(trim(json_extract(s.body,'$.name'))) LIKE lower(trim(gg.label))||' %' AND length(substr(trim(json_extract(s.body,'$.name')),length(trim(gg.label))+2))>0 AND substr(trim(json_extract(s.body,'$.name')),length(trim(gg.label))+2) NOT GLOB '*[^0-9]*') THEN trim(json_extract(s.body,'$.name')) END AS name,
 COALESCE(CASE WHEN json_type(s.body,'$.blind1')='integer' AND json_extract(s.body,'$.blind1')>=0 THEN json_extract(s.body,'$.blind1') END,n.blind1) AS blind1,
 COALESCE(CASE WHEN json_type(s.body,'$.blind2')='integer' AND json_extract(s.body,'$.blind2')>=0 THEN json_extract(s.body,'$.blind2') END,n.blind2) AS blind2,
 COALESCE(CASE WHEN json_type(s.body,'$.blind3')='integer' AND json_extract(s.body,'$.blind3')>=0 THEN json_extract(s.body,'$.blind3') END,n.blind3) AS blind3,
 COALESCE(CASE WHEN json_type(s.body,'$.ante')='integer' AND json_extract(s.body,'$.ante')>=0 THEN json_extract(s.body,'$.ante') END,n.ante) AS ante,
 COALESCE(CASE WHEN json_type(s.body,'$.anteType')='text' AND json_extract(s.body,'$.anteType') IN ('none','all','bb') THEN json_extract(s.body,'$.anteType') END,n.ante_type) AS ante_type
FROM `__stage_0069_cash_final_groups` g JOIN `__stage_0069_cash` n ON n.id=g.entry_id JOIN `game_group` gg ON gg.id=g.group_id
LEFT JOIN `__stage_0069_cash_groups` s ON s.entry_id=g.entry_id AND s.source_pos=g.source_pos;--> statement-breakpoint

-- Candidate and master fingerprints, then each entry's version.
CREATE TABLE `__stage_0069_cash_fp` AS
WITH lineup AS (
 SELECT DISTINCT v.entry_id,
 quote(m.mix_id)||'|'||group_concat(quote(v.group_position)||':'||quote(g.group_id)||':'||quote(v.position)||':'||quote(v.variant_id),',') OVER (PARTITION BY v.entry_id ORDER BY v.group_position,v.position ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
 FROM `__stage_0069_cash_variant` v JOIN `__stage_0069_cash_final_groups` g ON g.entry_id=v.entry_id AND g.position=v.group_position
 LEFT JOIN `__stage_0069_cash_mix` m ON m.entry_id=v.entry_id
), stake AS (
 SELECT DISTINCT entry_id,
 group_concat(quote(position)||':'||quote(blind1)||':'||quote(blind2)||':'||quote(blind3)||':'||quote(ante)||':'||quote(ante_type),',') OVER (PARTITION BY entry_id ORDER BY position ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
 FROM `__stage_0069_cash_stake`
)
SELECT c.id AS entry_id,c.user_id,c.ring_game_id,c.created_at,l.fp AS lineup_fp,
 l.fp||'#'||s.fp||'#'||quote(c.min_buy_in)||':'||quote(c.max_buy_in)||':'||quote(c.table_size)||':'||quote(trim(replace(replace(COALESCE(c.house_rules,''),char(13,10),char(10)),char(13),char(10)),char(32,9,10,11,12,13,160,65279,8232,8233,12288))) AS fp
FROM `__stage_0069_cash` c JOIN lineup l ON l.entry_id=c.id JOIN stake s ON s.entry_id=c.id;--> statement-breakpoint
CREATE TABLE `__stage_0069_cash_master` AS
WITH stake AS (
 SELECT DISTINCT s.rule_id,
 group_concat(quote(g.position)||':'||quote(s.blind1)||':'||quote(s.blind2)||':'||quote(s.blind3)||':'||quote(s.ante)||':'||quote(s.ante_type),',') OVER (PARTITION BY s.rule_id ORDER BY g.position ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
 FROM `cash_rule_stake` s JOIN `game_lineup_group` g ON g.id=s.lineup_group_id AND g.user_id=s.user_id
 WHERE s.rule_id IN (SELECT current_rule_id FROM `ring_game`)
)
SELECT r.id AS ring_game_id,r.user_id,c.id AS rule_id,c.lineup_id,l.fp AS lineup_fp,
 l.fp||'#'||s.fp||'#'||quote(c.min_buy_in)||':'||quote(c.max_buy_in)||':'||quote(c.table_size)||':'||quote(trim(replace(replace(COALESCE(c.house_rules,''),char(13,10),char(10)),char(13),char(10)),char(32,9,10,11,12,13,160,65279,8232,8233,12288))) AS fp
FROM `ring_game` r JOIN `cash_rule` c ON c.id=r.current_rule_id AND c.user_id=r.user_id
JOIN `__stage_0069_master_lineup` l ON l.lineup_id=c.lineup_id AND l.user_id=c.user_id
JOIN stake s ON s.rule_id=c.id;--> statement-breakpoint
CREATE TABLE `__stage_0069_cash_rule` AS
SELECT f.entry_id,f.user_id,f.ring_game_id,
 CASE WHEN f.ring_game_id IS NULL THEN 'cr:e:'||f.entry_id
 WHEN f.fp=m.fp THEN m.rule_id
 ELSE 'cr:e:'||(SELECT x.entry_id FROM `__stage_0069_cash_fp` x WHERE x.ring_game_id=f.ring_game_id AND x.user_id=f.user_id AND x.fp=f.fp ORDER BY x.created_at,x.entry_id LIMIT 1) END AS rule_id
FROM `__stage_0069_cash_fp` f LEFT JOIN `__stage_0069_cash_master` m ON m.ring_game_id=f.ring_game_id AND m.user_id=f.user_id;--> statement-breakpoint
CREATE TABLE `__stage_0069_cash_version` AS
SELECT d.entry_id,d.user_id,d.ring_game_id,d.rule_id,c.created_at,m.rule_id AS parent_rule_id,
 CASE WHEN m.lineup_fp=f.lineup_fp THEN m.lineup_id ELSE 'lu:'||d.rule_id END AS lineup_id
FROM `__stage_0069_cash_rule` d JOIN `__stage_0069_cash` c ON c.id=d.entry_id JOIN `__stage_0069_cash_fp` f ON f.entry_id=d.entry_id
LEFT JOIN `__stage_0069_cash_master` m ON m.ring_game_id=d.ring_game_id AND m.user_id=d.user_id
WHERE d.rule_id='cr:e:'||d.entry_id;--> statement-breakpoint
INSERT INTO `game_lineup` (id,user_id,game_mix_id,created_at)
SELECT v.lineup_id,v.user_id,m.mix_id,v.created_at FROM `__stage_0069_cash_version` v LEFT JOIN `__stage_0069_cash_mix` m ON m.entry_id=v.entry_id
WHERE v.lineup_id='lu:'||v.rule_id;--> statement-breakpoint
INSERT INTO `game_lineup_group` (id,user_id,lineup_id,position,game_group_id,name,created_at)
SELECT v.lineup_id||':'||s.position,v.user_id,v.lineup_id,s.position,s.group_id,s.name,v.created_at
FROM `__stage_0069_cash_version` v JOIN `__stage_0069_cash_stake` s ON s.entry_id=v.entry_id
WHERE v.lineup_id='lu:'||v.rule_id;--> statement-breakpoint
INSERT INTO `game_lineup_variant` (user_id,lineup_id,lineup_group_id,variant_id,position)
SELECT v.user_id,v.lineup_id,v.lineup_id||':'||x.group_position,x.variant_id,x.position
FROM `__stage_0069_cash_version` v JOIN `__stage_0069_cash_variant` x ON x.entry_id=v.entry_id
WHERE v.lineup_id='lu:'||v.rule_id;--> statement-breakpoint
INSERT INTO `cash_rule` (id,user_id,ring_game_id,parent_rule_id,lineup_id,min_buy_in,max_buy_in,table_size,house_rules,created_at)
SELECT v.rule_id,v.user_id,v.ring_game_id,v.parent_rule_id,v.lineup_id,c.min_buy_in,c.max_buy_in,c.table_size,c.house_rules,v.created_at
FROM `__stage_0069_cash_version` v JOIN `__stage_0069_cash` c ON c.id=v.entry_id;--> statement-breakpoint
INSERT INTO `cash_rule_stake` (user_id,rule_id,lineup_group_id,lineup_id,blind1,blind2,blind3,ante,ante_type)
SELECT v.user_id,v.rule_id,g.id,v.lineup_id,s.blind1,s.blind2,s.blind3,s.ante,s.ante_type
FROM `__stage_0069_cash_version` v JOIN `__stage_0069_cash_stake` s ON s.entry_id=v.entry_id
JOIN `game_lineup_group` g ON g.lineup_id=v.lineup_id AND g.user_id=v.user_id AND g.position=s.position;--> statement-breakpoint
UPDATE `entry_cash` SET cash_rule_id=(SELECT d.rule_id FROM `__stage_0069_cash_rule` d WHERE d.entry_id=entry_cash.entry_id AND d.user_id=entry_cash.user_id);--> statement-breakpoint

-- Tournament snapshots, resolved with B08's label and level rules.
CREATE TABLE `__stage_0069_tour` AS
SELECT et.entry_id AS id, et.user_id, et.tournament_id, e.created_at, e.source, e.asset_id,
 COALESCE(std.variant,'NL Hold''em') AS variant, std.tournament_buy_in AS buy_in, std.entry_fee,
 std.starting_stack, std.bounty_amount, std.table_size, std.house_rules
FROM `entry_tournament` et JOIN `entry` e ON e.id=et.entry_id AND e.user_id=et.user_id
LEFT JOIN `session_tournament_detail` std ON std.session_id=et.entry_id;--> statement-breakpoint
CREATE TABLE `__stage_0069_level` AS
SELECT b.id, b.session_id AS entry_id, b.level, b.is_break, b.blind1, b.blind2, b.blind3, b.ante, b.minutes, b.games
FROM `session_blind_level` b JOIN `__stage_0069_tour` t ON t.id=b.session_id;--> statement-breakpoint
CREATE TABLE `__stage_0069_json_group` AS
SELECT b.id AS blind_level_id, b.entry_id, t.user_id, CAST(g.key AS integer) AS source_position,
 CASE WHEN g.type = 'object' THEN g.value ELSE '{}' END AS object
FROM `__stage_0069_level` b JOIN `__stage_0069_tour` t ON t.id = b.entry_id,
json_each(CASE WHEN json_valid(b.games) THEN CASE WHEN json_type(b.games) = 'array' THEN b.games ELSE '[]' END ELSE '[]' END) g
WHERE g.type = 'object';--> statement-breakpoint
CREATE TABLE `__stage_0069_json_variant` AS
SELECT g.blind_level_id, g.entry_id, g.user_id, g.source_position,
 CAST(v.key AS integer) AS source_variant_position, trim(v.value) AS label, lower(trim(v.value)) AS normalized,
 COALESCE(
 (SELECT x.id FROM `game_variant` x WHERE x.user_id = g.user_id AND lower(trim(x.label)) = lower(trim(v.value)) ORDER BY x.id LIMIT 1),
 (SELECT x.id FROM `game_variant` x WHERE x.user_id = g.user_id AND x.builtin_key = lower(trim(v.value)) ORDER BY x.id LIMIT 1)
 ) AS resolved_id
FROM `__stage_0069_json_group` g,
json_each(CASE WHEN json_type(g.object, '$.variants') = 'array' THEN json_extract(g.object, '$.variants') ELSE '[]' END) v
WHERE v.type = 'text' AND trim(v.value) <> '';--> statement-breakpoint
CREATE TABLE `__stage_0069_tour_resolution` AS
SELECT t.id AS entry_id, t.user_id, trim(t.variant) AS label, lower(trim(t.variant)) AS normalized,
 COALESCE((SELECT v.id FROM `game_variant` v WHERE v.user_id=t.user_id AND lower(trim(v.label))=lower(trim(t.variant)) ORDER BY v.id LIMIT 1),
 CASE WHEN NOT EXISTS (SELECT 1 FROM `game_mix` m WHERE m.user_id=t.user_id AND lower(trim(m.label))=lower(trim(t.variant))) THEN
 (SELECT v.id FROM `game_variant` v WHERE v.user_id=t.user_id AND v.builtin_key=lower(trim(t.variant)) ORDER BY v.id LIMIT 1) END) AS variant_id,
 COALESCE((SELECT m.id FROM `game_mix` m WHERE m.user_id=t.user_id AND lower(trim(m.label))=lower(trim(t.variant)) ORDER BY m.id LIMIT 1),
 CASE WHEN NOT EXISTS (SELECT 1 FROM `game_variant` v WHERE v.user_id=t.user_id AND (lower(trim(v.label))=lower(trim(t.variant)) OR v.builtin_key=lower(trim(t.variant)))) THEN
 (SELECT m.id FROM `game_mix` m WHERE m.user_id=t.user_id AND m.builtin_key=lower(trim(t.variant)) ORDER BY m.id LIMIT 1) END) AS mix_id
FROM `__stage_0069_tour` t;--> statement-breakpoint
CREATE TABLE `__stage_0069_needed_variant` AS
SELECT user_id, normalized, label, sibling_group, ROW_NUMBER() OVER (PARTITION BY user_id, normalized ORDER BY priority, entry_id, level_order, group_order, variant_order) AS occurrence
FROM (
 SELECT j.user_id, j.normalized, j.label, j.entry_id, b.level AS level_order, j.source_position AS group_order, j.source_variant_position AS variant_order, 0 AS priority,
 (SELECT v.group_id FROM `__stage_0069_json_variant` s JOIN `game_variant` v ON v.id=s.resolved_id AND v.user_id=s.user_id
 WHERE s.blind_level_id=j.blind_level_id AND s.user_id=j.user_id AND s.source_position=j.source_position ORDER BY s.source_variant_position LIMIT 1) AS sibling_group
 FROM `__stage_0069_json_variant` j JOIN `__stage_0069_level` b ON b.id=j.blind_level_id
 WHERE j.resolved_id IS NULL
 UNION ALL
 SELECT r.user_id, r.normalized, r.label, r.entry_id, 0, 0, 0, 1, NULL
 FROM `__stage_0069_tour_resolution` r
 WHERE r.variant_id IS NULL AND r.mix_id IS NULL AND r.normalized <> 'mix'
 AND NOT EXISTS (SELECT 1 FROM `__stage_0069_json_variant` j WHERE j.entry_id=r.entry_id AND j.user_id=r.user_id)
 UNION ALL
 SELECT r.user_id, 'mixed game', 'Mixed Game', r.entry_id, 0, 0, 0, 2, NULL
 FROM `__stage_0069_tour_resolution` r
 WHERE r.variant_id IS NULL AND r.mix_id IS NULL AND r.normalized='mix'
 AND NOT EXISTS (SELECT 1 FROM `__stage_0069_json_variant` j WHERE j.entry_id=r.entry_id AND j.user_id=r.user_id)
 UNION ALL
 SELECT r.user_id, lower(trim(m.label)), trim(m.label), r.entry_id, 0, 0, 0, 3, NULL
 FROM `__stage_0069_tour_resolution` r JOIN `game_mix` m ON m.id=r.mix_id AND m.user_id=r.user_id
 WHERE r.variant_id IS NULL
 AND NOT EXISTS (SELECT 1 FROM `__stage_0069_json_variant` j WHERE j.entry_id=r.entry_id AND j.user_id=r.user_id)
 AND NOT EXISTS (SELECT 1 FROM `game_mix_variant` mv WHERE mv.mix_id=m.id AND mv.user_id=m.user_id)
) candidates;--> statement-breakpoint
INSERT INTO `game_group` (id,user_id,builtin_key,label,blind1_label,blind2_label,blind3_label,blind1_required,blind2_required,created_at,updated_at)
SELECT DISTINCT n.user_id || ':builtin-group:bigbet', n.user_id, 'bigbet', 'Big Bet', 'SB', 'BB', NULL, 1, 1, unixepoch(), unixepoch()
FROM `__stage_0069_needed_variant` n
WHERE NOT EXISTS (SELECT 1 FROM `game_group` g WHERE g.user_id=n.user_id);--> statement-breakpoint
INSERT INTO `game_variant` (id,user_id,builtin_key,label,short_label,group_id,sort_order,archived_at,created_at,updated_at)
SELECT 'sv:' || n.user_id || ':' || n.normalized, n.user_id, NULL, n.label, NULL,
 COALESCE(n.sibling_group, (SELECT g.id FROM `game_group` g WHERE g.user_id=n.user_id AND g.builtin_key='bigbet' ORDER BY g.id LIMIT 1),
 (SELECT min(g.id) FROM `game_group` g WHERE g.user_id=n.user_id)),
 0, unixepoch(), unixepoch(), unixepoch()
FROM `__stage_0069_needed_variant` n
WHERE n.occurrence=1 AND NOT EXISTS (SELECT 1 FROM `game_variant` v WHERE v.user_id=n.user_id AND (lower(trim(v.label))=n.normalized OR v.id='sv:' || n.user_id || ':' || n.normalized));--> statement-breakpoint
CREATE TABLE `__stage_0069_level_variant` AS
WITH resolved AS (
 SELECT j.*, COALESCE(j.resolved_id, v.id) AS variant_id,
 ROW_NUMBER() OVER (PARTITION BY j.blind_level_id, COALESCE(j.resolved_id,v.id) ORDER BY j.source_position,j.source_variant_position) AS duplicate_number
 FROM `__stage_0069_json_variant` j
 LEFT JOIN `game_variant` v ON v.user_id=j.user_id AND lower(trim(v.label))=j.normalized
), positions AS (
 SELECT *, DENSE_RANK() OVER (PARTITION BY blind_level_id ORDER BY source_position)-1 AS group_position,
 ROW_NUMBER() OVER (PARTITION BY blind_level_id,source_position ORDER BY source_variant_position)-1 AS position
 FROM resolved WHERE duplicate_number=1
)
SELECT blind_level_id,user_id,group_position,position,variant_id,source_position FROM positions;--> statement-breakpoint
CREATE TABLE `__stage_0069_level_group` AS
WITH grouped AS (
 SELECT blind_level_id,user_id,source_position,group_position AS position
 FROM `__stage_0069_level_variant` WHERE position=0
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
FROM grouped q JOIN `__stage_0069_json_group` j ON j.blind_level_id=q.blind_level_id AND j.user_id=q.user_id AND j.source_position=q.source_position
JOIN `__stage_0069_level_variant` lv ON lv.blind_level_id=q.blind_level_id AND lv.user_id=q.user_id AND lv.group_position=q.position AND lv.position=0
JOIN `game_variant` gv ON gv.id=lv.variant_id AND gv.user_id=lv.user_id JOIN `game_group` gg ON gg.id=gv.group_id AND gg.user_id=gv.user_id;--> statement-breakpoint
CREATE TABLE `__stage_0069_default_variant` AS
WITH candidates AS (
 SELECT r.entry_id,r.user_id,r.variant_id,0 AS level_order,0 AS group_order,0 AS variant_order
 FROM `__stage_0069_tour_resolution` r WHERE r.variant_id IS NOT NULL
 UNION ALL
 SELECT r.entry_id,r.user_id,lv.variant_id,(SELECT count(*) FROM `__stage_0069_level` prior WHERE prior.entry_id=b.entry_id AND (prior.level<b.level OR (prior.level=b.level AND prior.id<=b.id))),lg.position,lv.position
 FROM `__stage_0069_tour_resolution` r JOIN `__stage_0069_level` b ON b.entry_id=r.entry_id
 JOIN `__stage_0069_level_group` lg ON lg.blind_level_id=b.id AND lg.user_id=r.user_id
 JOIN `__stage_0069_level_variant` lv ON lv.blind_level_id=lg.blind_level_id AND lv.user_id=lg.user_id AND lv.group_position=lg.position
 WHERE r.variant_id IS NULL
 UNION ALL
 SELECT r.entry_id,r.user_id,mv.variant_id,0,0,mv.position
 FROM `__stage_0069_tour_resolution` r JOIN `game_mix_variant` mv ON mv.mix_id=r.mix_id AND mv.user_id=r.user_id
 WHERE r.variant_id IS NULL AND NOT EXISTS (SELECT 1 FROM `__stage_0069_level_group` lg JOIN `__stage_0069_level` b ON b.id=lg.blind_level_id WHERE b.entry_id=r.entry_id AND lg.user_id=r.user_id)
 UNION ALL
 SELECT r.entry_id,r.user_id,v.id,0,0,0
 FROM `__stage_0069_tour_resolution` r JOIN `game_variant` v ON v.user_id=r.user_id AND lower(trim(v.label))=CASE WHEN r.normalized='mix' AND r.mix_id IS NULL THEN 'mixed game' WHEN r.mix_id IS NOT NULL THEN (SELECT lower(trim(m.label)) FROM `game_mix` m WHERE m.id=r.mix_id AND m.user_id=r.user_id) ELSE r.normalized END
 WHERE r.variant_id IS NULL AND NOT EXISTS (SELECT 1 FROM `__stage_0069_level_group` lg JOIN `__stage_0069_level` b ON b.id=lg.blind_level_id WHERE b.entry_id=r.entry_id AND lg.user_id=r.user_id)
 AND NOT EXISTS (SELECT 1 FROM `game_mix_variant` mv WHERE mv.mix_id=r.mix_id AND mv.user_id=r.user_id)
), unique_variants AS (
 SELECT *, ROW_NUMBER() OVER (PARTITION BY entry_id,variant_id ORDER BY level_order,group_order,variant_order) AS n FROM candidates
), grouped AS (
 SELECT c.*,v.group_id, MIN(printf('%020d:%020d:%020d',level_order,group_order,variant_order)) OVER (PARTITION BY c.entry_id,v.group_id) AS first_group
 FROM unique_variants c JOIN `game_variant` v ON v.id=c.variant_id AND v.user_id=c.user_id WHERE c.n=1
)
SELECT entry_id,user_id,variant_id,group_id,
 DENSE_RANK() OVER (PARTITION BY entry_id ORDER BY first_group,group_id)-1 AS group_position,
 ROW_NUMBER() OVER (PARTITION BY entry_id,group_id ORDER BY level_order,group_order,variant_order,variant_id)-1 AS position
FROM grouped;--> statement-breakpoint
CREATE TABLE `__stage_0069_tour_mix` AS
SELECT r.entry_id,r.user_id,r.normalized,r.label,0 AS created FROM `__stage_0069_tour_resolution` r
WHERE r.variant_id IS NULL AND r.mix_id IS NULL AND r.normalized<>'mix'
 AND EXISTS (SELECT 1 FROM `__stage_0069_level_group` lg JOIN `__stage_0069_level` b ON b.id=lg.blind_level_id WHERE b.entry_id=r.entry_id AND lg.user_id=r.user_id);--> statement-breakpoint
UPDATE `__stage_0069_tour_mix` SET created=1 WHERE entry_id=(SELECT min(x.entry_id) FROM `__stage_0069_tour_mix` x WHERE x.user_id=__stage_0069_tour_mix.user_id AND x.normalized=__stage_0069_tour_mix.normalized)
 AND NOT EXISTS (SELECT 1 FROM `game_mix` m WHERE m.id='sm:' || user_id || ':' || normalized);--> statement-breakpoint
INSERT INTO `game_mix` (id,user_id,builtin_key,label,games,archived_at,created_at,updated_at)
SELECT 'sm:' || x.user_id || ':' || x.normalized,x.user_id,NULL,x.label,'[]',unixepoch(),unixepoch(),unixepoch()
FROM `__stage_0069_tour_mix` x WHERE x.created=1;--> statement-breakpoint
INSERT INTO `game_mix_variant` (mix_id,variant_id,user_id,position)
SELECT 'sm:' || x.user_id || ':' || x.normalized,d.variant_id,x.user_id,
 ROW_NUMBER() OVER (PARTITION BY x.user_id,x.normalized ORDER BY d.group_position,d.position)-1
FROM `__stage_0069_tour_mix` x JOIN `__stage_0069_default_variant` d ON d.entry_id=x.entry_id AND d.user_id=x.user_id
WHERE x.created=1;--> statement-breakpoint
CREATE TABLE `__stage_0069_mix_variant` AS
WITH g AS (
 SELECT mv.mix_id,mv.user_id,mv.variant_id,mv.position,v.group_id,
 MIN(mv.position) OVER (PARTITION BY mv.mix_id,v.group_id) AS first_group
 FROM `game_mix_variant` mv JOIN `game_variant` v ON v.id=mv.variant_id AND v.user_id=mv.user_id
)
SELECT mix_id,user_id,variant_id,group_id,DENSE_RANK() OVER (PARTITION BY mix_id ORDER BY first_group,group_id)-1 AS group_position,
 ROW_NUMBER() OVER (PARTITION BY mix_id,group_id ORDER BY position,variant_id)-1 AS variant_position FROM g;--> statement-breakpoint
CREATE TABLE `__stage_0069_level_lineup` AS
SELECT b.id AS blind_level_id,t.id AS entry_id,t.user_id,
 CASE WHEN b.is_break<>0 OR NOT EXISTS (SELECT 1 FROM `__stage_0069_level_group` g WHERE g.blind_level_id=b.id AND g.user_id=t.user_id)
 OR NOT EXISTS (
 SELECT group_position,position,variant_id FROM `__stage_0069_level_variant` WHERE blind_level_id=b.id AND user_id=t.user_id
 EXCEPT SELECT group_position,position,variant_id FROM `__stage_0069_default_variant` WHERE entry_id=t.id AND user_id=t.user_id
 ) AND NOT EXISTS (
 SELECT group_position,position,variant_id FROM `__stage_0069_default_variant` WHERE entry_id=t.id AND user_id=t.user_id
 EXCEPT SELECT group_position,position,variant_id FROM `__stage_0069_level_variant` WHERE blind_level_id=b.id AND user_id=t.user_id
 ) AND NOT EXISTS (
 SELECT position,game_group_id FROM `__stage_0069_level_group` WHERE blind_level_id=b.id AND user_id=t.user_id
 EXCEPT SELECT DISTINCT group_position,group_id FROM `__stage_0069_default_variant` WHERE entry_id=t.id AND user_id=t.user_id
 ) THEN 1 ELSE 0 END AS inherits,
 (SELECT min(m.id) FROM `game_mix` m WHERE m.user_id=t.user_id AND NOT EXISTS (
 SELECT group_position,position,variant_id FROM `__stage_0069_level_variant` WHERE blind_level_id=b.id AND user_id=t.user_id
 EXCEPT SELECT group_position,variant_position,variant_id FROM `__stage_0069_mix_variant` WHERE mix_id=m.id AND user_id=m.user_id)
 AND NOT EXISTS (SELECT group_position,variant_position,variant_id FROM `__stage_0069_mix_variant` WHERE mix_id=m.id AND user_id=m.user_id
 EXCEPT SELECT group_position,position,variant_id FROM `__stage_0069_level_variant` WHERE blind_level_id=b.id AND user_id=t.user_id)
 AND NOT EXISTS (SELECT position,game_group_id FROM `__stage_0069_level_group` WHERE blind_level_id=b.id AND user_id=t.user_id
 EXCEPT SELECT DISTINCT group_position,group_id FROM `__stage_0069_mix_variant` WHERE mix_id=m.id AND user_id=m.user_id)) AS game_mix_id
FROM `__stage_0069_level` b JOIN `__stage_0069_tour` t ON t.id=b.entry_id;--> statement-breakpoint
CREATE TABLE `__stage_0069_tour_default` AS
SELECT r.entry_id,r.user_id,
 CASE WHEN r.variant_id IS NOT NULL OR r.normalized='mix' AND r.mix_id IS NULL THEN NULL
 WHEN r.mix_id IS NOT NULL THEN r.mix_id
 WHEN EXISTS (SELECT 1 FROM `__stage_0069_tour_mix` x WHERE x.entry_id=r.entry_id) THEN 'sm:' || r.user_id || ':' || r.normalized END AS game_mix_id
FROM `__stage_0069_tour_resolution` r;--> statement-breakpoint
CREATE TABLE `__stage_0069_level_stake` AS
SELECT b.id AS blind_level_id,b.entry_id,t.user_id,p.position,
 CASE WHEN lg.blind_level_id IS NOT NULL THEN lg.blind1 WHEN b.blind1 >= 0 THEN b.blind1 END AS blind1,
 CASE WHEN lg.blind_level_id IS NOT NULL THEN lg.blind2 WHEN b.blind2 >= 0 THEN b.blind2 END AS blind2,
 CASE WHEN lg.blind_level_id IS NOT NULL THEN lg.blind3 WHEN b.blind3 >= 0 THEN b.blind3 END AS blind3,
 CASE WHEN lg.blind_level_id IS NOT NULL THEN lg.ante WHEN b.ante >= 0 THEN b.ante END AS ante
FROM `__stage_0069_level` b JOIN `__stage_0069_tour` t ON t.id=b.entry_id
JOIN `__stage_0069_level_lineup` ll ON ll.blind_level_id=b.id
JOIN (
 SELECT l.blind_level_id,d.group_position AS position FROM `__stage_0069_level_lineup` l JOIN `__stage_0069_default_variant` d ON d.entry_id=l.entry_id AND d.position=0 WHERE l.inherits=1
 UNION ALL
 SELECT l.blind_level_id,g.position FROM `__stage_0069_level_lineup` l JOIN `__stage_0069_level_group` g ON g.blind_level_id=l.blind_level_id WHERE l.inherits=0
) p ON p.blind_level_id=b.id
LEFT JOIN `__stage_0069_level_group` lg ON lg.blind_level_id=b.id AND lg.user_id=t.user_id AND lg.position=p.position
WHERE NOT b.is_break;--> statement-breakpoint
INSERT INTO `asset` (`id`, `user_id`, `name`, `kind`, `decimals`, `created_at`, `updated_at`)
SELECT 'unassigned:' || u.user_id, u.user_id,
 CASE WHEN EXISTS (SELECT 1 FROM `asset` a WHERE a.user_id = u.user_id AND lower(trim(a.name)) = 'unassigned') THEN 'Unassigned (migrated)' ELSE 'Unassigned' END,
 'currency', 0, unixepoch(), unixepoch()
FROM (
 SELECT DISTINCT t.user_id FROM `__stage_0069_tour` t
 LEFT JOIN `tournament` m ON m.id=t.tournament_id AND m.user_id=t.user_id
 WHERE t.asset_id IS NULL AND m.default_asset_id IS NULL
 AND (t.buy_in IS NOT NULL OR t.entry_fee IS NOT NULL OR EXISTS (SELECT 1 FROM `session_chip_purchase` p WHERE p.session_id=t.id))
 AND NOT EXISTS (SELECT 1 FROM `asset` x WHERE x.id='unassigned:' || t.user_id AND x.user_id=t.user_id)
) u;--> statement-breakpoint
CREATE TABLE `__stage_0069_price` AS
WITH base AS (
 SELECT t.*, COALESCE(t.asset_id, m.default_asset_id, 'unassigned:' || t.user_id) AS price_asset,
 (SELECT p.amount FROM `tournament_rule_price` p WHERE p.rule_id=m.current_rule_id AND p.user_id=m.user_id AND p.kind='entry' ORDER BY p.ordinal LIMIT 1) AS master_amount,
 (SELECT p.fee FROM `tournament_rule_price` p WHERE p.rule_id=m.current_rule_id AND p.user_id=m.user_id AND p.kind='entry' ORDER BY p.ordinal LIMIT 1) AS master_fee,
 EXISTS (SELECT 1 FROM `tournament_rule_price` p WHERE p.rule_id=m.current_rule_id AND p.user_id=m.user_id AND p.kind='entry') AS master_priced
 FROM `__stage_0069_tour` t LEFT JOIN `tournament` m ON m.id=t.tournament_id AND m.user_id=t.user_id
), entry_price AS (
 SELECT *, buy_in IS NOT NULL OR entry_fee IS NOT NULL OR (source='live' AND master_priced) AS priced FROM base
)
SELECT e.id AS entry_id,e.user_id,'trp:tr:e:' || e.id || ':entry' AS id,'entry' AS kind,'' AS label,e.price_asset AS asset_id,
 CASE WHEN e.buy_in IS NOT NULL THEN CASE WHEN e.buy_in >= 0 THEN e.buy_in ELSE 0 END WHEN e.source='live' THEN COALESCE(e.master_amount,0) ELSE 0 END AS amount,
 CASE WHEN e.entry_fee IS NOT NULL THEN CASE WHEN e.entry_fee >= 0 THEN e.entry_fee ELSE 0 END WHEN e.source='live' THEN COALESCE(e.master_fee,0) ELSE 0 END AS fee,
 NULL AS chips,1 AS ordinal,NULL AS purchase_id
FROM entry_price e WHERE e.priced
UNION ALL
SELECT e.id,e.user_id,'trp:e:' || p.id,'addon',p.name,e.price_asset,CASE WHEN p.cost >= 0 THEN p.cost ELSE 0 END,0,CASE WHEN p.chips >= 0 THEN p.chips END,
 CASE WHEN e.priced THEN 1 ELSE 0 END + row_number() OVER (PARTITION BY e.id ORDER BY p.sort_order,p.id),p.id
FROM entry_price e JOIN `session_chip_purchase` p ON p.session_id=e.id;--> statement-breakpoint

-- Tournament fingerprints: default lineup, scalars, levels and prices.
CREATE TABLE `__stage_0069_tour_lineup_fp` AS
SELECT DISTINCT 'e:'||d.entry_id AS owner_id,
 quote(x.game_mix_id)||'|'||group_concat(quote(d.group_position)||':'||quote(d.group_id)||':'||quote(d.position)||':'||quote(d.variant_id),',') OVER (PARTITION BY d.entry_id ORDER BY d.group_position,d.position ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
FROM `__stage_0069_default_variant` d JOIN `__stage_0069_tour_default` x ON x.entry_id=d.entry_id
UNION ALL
SELECT DISTINCT 'l:'||v.blind_level_id,
 quote(l.game_mix_id)||'|'||group_concat(quote(v.group_position)||':'||quote(g.game_group_id)||':'||quote(v.position)||':'||quote(v.variant_id),',') OVER (PARTITION BY v.blind_level_id ORDER BY v.group_position,v.position ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
FROM `__stage_0069_level_variant` v JOIN `__stage_0069_level_lineup` l ON l.blind_level_id=v.blind_level_id AND l.inherits=0
JOIN `__stage_0069_level_group` g ON g.blind_level_id=v.blind_level_id AND g.position=v.group_position;--> statement-breakpoint
CREATE TABLE `__stage_0069_tour_fp` AS
WITH stake AS (
 SELECT DISTINCT blind_level_id,
 group_concat(quote(position)||':'||quote(blind1)||':'||quote(blind2)||':'||quote(blind3)||':'||quote(ante)||':'||quote(NULL),',') OVER (PARTITION BY blind_level_id ORDER BY position ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
 FROM `__stage_0069_level_stake`
), level_row AS (
 SELECT b.entry_id,
 row_number() OVER (PARTITION BY b.entry_id ORDER BY b.level,b.id) AS ordinal,
 quote(b.level)||':'||quote(CASE WHEN b.is_break THEN 1 ELSE 0 END)||':'||quote(CASE WHEN b.minutes >= 1 THEN b.minutes END)||':'||quote(ll.inherits)||':'||CASE WHEN ll.inherits=1 THEN '' ELSE lf.fp END||':'||COALESCE(s.fp,'') AS fp
 FROM `__stage_0069_level` b JOIN `__stage_0069_level_lineup` ll ON ll.blind_level_id=b.id
 LEFT JOIN `__stage_0069_tour_lineup_fp` lf ON lf.owner_id='l:'||b.id LEFT JOIN stake s ON s.blind_level_id=b.id
), levels AS (
 SELECT DISTINCT entry_id, group_concat(fp,';') OVER (PARTITION BY entry_id ORDER BY ordinal ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp FROM level_row
), prices AS (
 SELECT DISTINCT entry_id, group_concat(quote(kind)||':'||quote(asset_id)||':'||quote(amount)||':'||quote(fee)||':'||quote(chips)||':'||quote(label),',') OVER (PARTITION BY entry_id ORDER BY ordinal ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp FROM `__stage_0069_price`
)
SELECT t.id AS entry_id,t.user_id,t.tournament_id,t.created_at,d.fp AS lineup_fp,
 d.fp||'#'||quote(CASE WHEN t.starting_stack >= 0 THEN t.starting_stack END)||':'||quote(CASE WHEN t.table_size BETWEEN 2 AND 10 THEN t.table_size END)||':'||quote(CASE WHEN t.bounty_amount >= 0 THEN t.bounty_amount END)||':'||quote(trim(replace(replace(COALESCE(t.house_rules,''),char(13,10),char(10)),char(13),char(10)),char(32,9,10,11,12,13,160,65279,8232,8233,12288)))
 ||'#'||COALESCE(l.fp,'')||'#'||COALESCE(p.fp,'') AS fp
FROM `__stage_0069_tour` t JOIN `__stage_0069_tour_lineup_fp` d ON d.owner_id='e:'||t.id
LEFT JOIN levels l ON l.entry_id=t.id LEFT JOIN prices p ON p.entry_id=t.id;--> statement-breakpoint
CREATE TABLE `__stage_0069_tour_master` AS
WITH stake AS (
 SELECT DISTINCT s.level_id,
 group_concat(quote(g.position)||':'||quote(s.blind1)||':'||quote(s.blind2)||':'||quote(s.blind3)||':'||quote(s.ante)||':'||quote(s.ante_type),',') OVER (PARTITION BY s.level_id ORDER BY g.position ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
 FROM `tournament_rule_level_stake` s JOIN `game_lineup_group` g ON g.id=s.lineup_group_id AND g.user_id=s.user_id
 WHERE s.level_id IN (SELECT l.id FROM `tournament_rule_level` l JOIN `tournament` t ON t.current_rule_id=l.rule_id AND t.user_id=l.user_id)
), levels AS (
 SELECT DISTINCT l.rule_id, group_concat(quote(l.level)||':'||quote(l.is_break)||':'||quote(l.minutes)||':'||quote(l.inherits_lineup)||':'||CASE WHEN l.inherits_lineup=1 THEN '' ELSE lf.fp END||':'||COALESCE(s.fp,''),';') OVER (PARTITION BY l.rule_id ORDER BY l.ordinal ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
 FROM `tournament_rule_level` l JOIN `tournament` t ON t.current_rule_id=l.rule_id AND t.user_id=l.user_id
 LEFT JOIN `__stage_0069_master_lineup` lf ON lf.lineup_id=l.lineup_id LEFT JOIN stake s ON s.level_id=l.id
), prices AS (
 SELECT DISTINCT p.rule_id, group_concat(quote(p.kind)||':'||quote(p.asset_id)||':'||quote(p.amount)||':'||quote(p.fee)||':'||quote(p.chips)||':'||quote(p.label),',') OVER (PARTITION BY p.rule_id ORDER BY p.ordinal ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
 FROM `tournament_rule_price` p JOIN `tournament` t ON t.current_rule_id=p.rule_id AND t.user_id=p.user_id
)
SELECT t.id AS tournament_id,t.user_id,r.id AS rule_id,r.lineup_id,d.fp AS lineup_fp,
 d.fp||'#'||quote(r.starting_stack)||':'||quote(r.table_size)||':'||quote(r.bounty_amount)||':'||quote(trim(replace(replace(COALESCE(r.house_rules,''),char(13,10),char(10)),char(13),char(10)),char(32,9,10,11,12,13,160,65279,8232,8233,12288)))
 ||'#'||COALESCE(l.fp,'')||'#'||COALESCE(p.fp,'') AS fp
FROM `tournament` t JOIN `tournament_rule` r ON r.id=t.current_rule_id AND r.user_id=t.user_id
JOIN `__stage_0069_master_lineup` d ON d.lineup_id=r.lineup_id
LEFT JOIN levels l ON l.rule_id=r.id LEFT JOIN prices p ON p.rule_id=r.id;--> statement-breakpoint
CREATE TABLE `__stage_0069_tour_rule` AS
SELECT f.entry_id,f.user_id,f.tournament_id,
 CASE WHEN f.tournament_id IS NULL THEN 'tr:e:'||f.entry_id
 WHEN f.fp=m.fp THEN m.rule_id
 ELSE 'tr:e:'||(SELECT x.entry_id FROM `__stage_0069_tour_fp` x WHERE x.tournament_id=f.tournament_id AND x.user_id=f.user_id AND x.fp=f.fp ORDER BY x.created_at,x.entry_id LIMIT 1) END AS rule_id
FROM `__stage_0069_tour_fp` f LEFT JOIN `__stage_0069_tour_master` m ON m.tournament_id=f.tournament_id AND m.user_id=f.user_id;--> statement-breakpoint
-- A child reuses any lineup of its master's current structure with the same
-- composition; otherwise it owns lu:<version id> and lu:trl:e:<level id>.
CREATE TABLE `__stage_0069_tour_version` AS
SELECT d.entry_id,d.user_id,d.tournament_id,d.rule_id,t.created_at,m.rule_id AS parent_rule_id,
 COALESCE((SELECT min(ml.lineup_id) FROM `__stage_0069_master_lineup` ml WHERE ml.user_id=d.user_id AND ml.fp=f.lineup_fp AND (ml.lineup_id=m.lineup_id OR ml.lineup_id IN (SELECT lineup_id FROM `tournament_rule_level` WHERE rule_id=m.rule_id AND user_id=m.user_id))),'lu:'||d.rule_id) AS lineup_id
FROM `__stage_0069_tour_rule` d JOIN `__stage_0069_tour` t ON t.id=d.entry_id JOIN `__stage_0069_tour_fp` f ON f.entry_id=d.entry_id
LEFT JOIN `__stage_0069_tour_master` m ON m.tournament_id=d.tournament_id AND m.user_id=d.user_id
WHERE d.rule_id='tr:e:'||d.entry_id;--> statement-breakpoint
CREATE TABLE `__stage_0069_tour_level` AS
SELECT b.id AS blind_level_id,v.entry_id,v.user_id,v.rule_id,'trl:e:'||b.id AS id,
 row_number() OVER (PARTITION BY v.entry_id ORDER BY b.level,b.id) AS ordinal,b.level,
 CASE WHEN b.is_break THEN 1 ELSE 0 END AS is_break,CASE WHEN b.minutes >= 1 THEN b.minutes END AS minutes,ll.inherits,
 CASE WHEN ll.inherits=1 THEN v.lineup_id ELSE COALESCE((SELECT min(ml.lineup_id) FROM `__stage_0069_master_lineup` ml JOIN `__stage_0069_tour_lineup_fp` lf ON lf.owner_id='l:'||b.id
 WHERE ml.user_id=v.user_id AND ml.fp=lf.fp AND (ml.lineup_id=m.lineup_id OR ml.lineup_id IN (SELECT lineup_id FROM `tournament_rule_level` WHERE rule_id=m.rule_id AND user_id=m.user_id))),'lu:trl:e:'||b.id) END AS lineup_id
FROM `__stage_0069_tour_version` v JOIN `__stage_0069_level` b ON b.entry_id=v.entry_id
JOIN `__stage_0069_level_lineup` ll ON ll.blind_level_id=b.id
LEFT JOIN `__stage_0069_tour_master` m ON m.tournament_id=v.tournament_id AND m.user_id=v.user_id;--> statement-breakpoint
INSERT INTO `game_lineup` (id,user_id,game_mix_id,created_at)
SELECT v.lineup_id,v.user_id,x.game_mix_id,v.created_at FROM `__stage_0069_tour_version` v JOIN `__stage_0069_tour_default` x ON x.entry_id=v.entry_id
WHERE v.lineup_id='lu:'||v.rule_id;--> statement-breakpoint
INSERT INTO `game_lineup_group` (id,user_id,lineup_id,position,game_group_id,name,created_at)
SELECT v.lineup_id||':'||d.group_position,v.user_id,v.lineup_id,d.group_position,d.group_id,NULL,v.created_at
FROM `__stage_0069_tour_version` v JOIN `__stage_0069_default_variant` d ON d.entry_id=v.entry_id AND d.position=0
WHERE v.lineup_id='lu:'||v.rule_id;--> statement-breakpoint
INSERT INTO `game_lineup_variant` (user_id,lineup_id,lineup_group_id,variant_id,position)
SELECT v.user_id,v.lineup_id,v.lineup_id||':'||d.group_position,d.variant_id,d.position
FROM `__stage_0069_tour_version` v JOIN `__stage_0069_default_variant` d ON d.entry_id=v.entry_id
WHERE v.lineup_id='lu:'||v.rule_id;--> statement-breakpoint
INSERT INTO `game_lineup` (id,user_id,game_mix_id,created_at)
SELECT l.lineup_id,l.user_id,ll.game_mix_id,v.created_at FROM `__stage_0069_tour_level` l JOIN `__stage_0069_level_lineup` ll ON ll.blind_level_id=l.blind_level_id
JOIN `__stage_0069_tour_version` v ON v.entry_id=l.entry_id
WHERE l.lineup_id='lu:trl:e:'||l.blind_level_id;--> statement-breakpoint
INSERT INTO `game_lineup_group` (id,user_id,lineup_id,position,game_group_id,name,created_at)
SELECT l.lineup_id||':'||g.position,l.user_id,l.lineup_id,g.position,g.game_group_id,g.name,v.created_at
FROM `__stage_0069_tour_level` l JOIN `__stage_0069_level_group` g ON g.blind_level_id=l.blind_level_id
JOIN `__stage_0069_tour_version` v ON v.entry_id=l.entry_id
WHERE l.lineup_id='lu:trl:e:'||l.blind_level_id;--> statement-breakpoint
INSERT INTO `game_lineup_variant` (user_id,lineup_id,lineup_group_id,variant_id,position)
SELECT l.user_id,l.lineup_id,l.lineup_id||':'||x.group_position,x.variant_id,x.position
FROM `__stage_0069_tour_level` l JOIN `__stage_0069_level_variant` x ON x.blind_level_id=l.blind_level_id
WHERE l.lineup_id='lu:trl:e:'||l.blind_level_id;--> statement-breakpoint
INSERT INTO `tournament_rule` (id,user_id,tournament_id,parent_rule_id,lineup_id,starting_stack,table_size,bounty_amount,house_rules,created_at)
SELECT v.rule_id,v.user_id,v.tournament_id,v.parent_rule_id,v.lineup_id,
 CASE WHEN t.starting_stack >= 0 THEN t.starting_stack END,CASE WHEN t.table_size BETWEEN 2 AND 10 THEN t.table_size END,
 CASE WHEN t.bounty_amount >= 0 THEN t.bounty_amount END,t.house_rules,v.created_at
FROM `__stage_0069_tour_version` v JOIN `__stage_0069_tour` t ON t.id=v.entry_id;--> statement-breakpoint
INSERT INTO `tournament_rule_level` (id,user_id,rule_id,ordinal,level,is_break,minutes,lineup_id,inherits_lineup,inherited_lineup_id,created_at)
SELECT l.id,l.user_id,l.rule_id,l.ordinal,l.level,l.is_break,l.minutes,l.lineup_id,l.inherits,CASE WHEN l.inherits=1 THEN l.lineup_id END,v.created_at
FROM `__stage_0069_tour_level` l JOIN `__stage_0069_tour_version` v ON v.entry_id=l.entry_id;--> statement-breakpoint
INSERT INTO `tournament_rule_level_stake` (user_id,level_id,lineup_group_id,lineup_id,blind1,blind2,blind3,ante,ante_type)
SELECT l.user_id,l.id,g.id,l.lineup_id,s.blind1,s.blind2,s.blind3,s.ante,NULL
FROM `__stage_0069_tour_level` l JOIN `__stage_0069_level_stake` s ON s.blind_level_id=l.blind_level_id
JOIN `game_lineup_group` g ON g.lineup_id=l.lineup_id AND g.user_id=l.user_id AND g.position=s.position;--> statement-breakpoint
INSERT INTO `tournament_rule_price` (id,user_id,rule_id,kind,label,asset_id,amount,fee,chips,ordinal,created_at)
SELECT p.id,p.user_id,v.rule_id,p.kind,p.label,p.asset_id,p.amount,p.fee,p.chips,p.ordinal,v.created_at
FROM `__stage_0069_price` p JOIN `__stage_0069_tour_version` v ON v.entry_id=p.entry_id;--> statement-breakpoint
UPDATE `entry_tournament` SET tournament_rule_id=(SELECT d.rule_id FROM `__stage_0069_tour_rule` d WHERE d.entry_id=entry_tournament.entry_id AND d.user_id=entry_tournament.user_id);--> statement-breakpoint

-- Ledger prices: entry price for buy-in and fee, addon by snapshot position.
CREATE TABLE `__stage_0069_purchase` AS
SELECT cp.id,cp.session_id AS entry_id,cp.cost,COALESCE(r.count,0) AS count,
 row_number() OVER (PARTITION BY cp.session_id ORDER BY cp.sort_order,cp.id) AS position,
 COALESCE(sum(CASE WHEN cp.cost > 0 AND r.count > 0 THEN r.count END) OVER (PARTITION BY cp.session_id ORDER BY cp.sort_order,cp.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS first_n
FROM `session_chip_purchase` cp JOIN `__stage_0069_tour` t ON t.id=cp.session_id
LEFT JOIN `session_chip_purchase_result` r ON r.session_chip_purchase_id=cp.id;--> statement-breakpoint
CREATE TABLE `__stage_0069_addon` AS
SELECT p.id,p.user_id,p.rule_id,row_number() OVER (PARTITION BY p.rule_id ORDER BY p.ordinal) AS position
FROM `tournament_rule_price` p WHERE p.kind='addon' AND p.rule_id IN (SELECT tournament_rule_id FROM `entry_tournament`);--> statement-breakpoint
CREATE TABLE `__stage_0069_price_map` AS
SELECT l.id AS line_id,l.entry_id,l.role,NULL AS purchase_id,
 (SELECT p.id FROM `tournament_rule_price` p WHERE p.rule_id=et.tournament_rule_id AND p.user_id=et.user_id AND p.kind='entry' ORDER BY p.ordinal LIMIT 1) AS price_id
FROM `ledger_line` l JOIN `entry_tournament` et ON et.entry_id=l.entry_id AND et.user_id=l.user_id
WHERE l.role IN ('buy_in','fee');--> statement-breakpoint
INSERT INTO `__stage_0069_price_map` (line_id,entry_id,role,purchase_id,price_id)
SELECT l.id,l.entry_id,l.role,cp.id,
 (SELECT p.id FROM `__stage_0069_addon` p WHERE p.rule_id=et.tournament_rule_id AND p.user_id=et.user_id AND p.position=cp.position)
FROM `ledger_line` l JOIN `entry_tournament` et ON et.entry_id=l.entry_id AND et.user_id=l.user_id
LEFT JOIN `play_event` pe ON pe.id=l.source_event_id AND pe.user_id=l.user_id
JOIN `__stage_0069_purchase` cp ON cp.entry_id=l.entry_id AND (
 (l.source_event_id IS NULL AND cp.cost > 0 AND cp.count > 0 AND substr(l.id,1,length('m:'||l.entry_id||':chip_purchase:'))='m:'||l.entry_id||':chip_purchase:' AND
 CAST(substr(l.id,length('m:'||l.entry_id||':chip_purchase:')+1) AS integer) BETWEEN cp.first_n AND cp.first_n+cp.count-1)
 OR (l.source_event_id IS NOT NULL AND json_valid(pe.payload) AND json_extract(pe.payload,'$.sessionChipPurchaseId') = cp.id)
 OR (l.source_event_id IS NOT NULL AND json_valid(pe.payload) AND json_type(pe.payload,'$.sessionChipPurchaseId') IS NULL AND cp.id=(
  SELECT min(x.id) FROM `session_chip_purchase` x WHERE x.session_id=l.entry_id AND x.name IS json_extract(pe.payload,'$.name')
  AND x.cost IS json_extract(pe.payload,'$.cost') AND x.chips IS json_extract(pe.payload,'$.chips') HAVING count(*)=1))
)
WHERE l.role='chip_purchase';--> statement-breakpoint
UPDATE `ledger_line` SET price_id=(SELECT m.price_id FROM `__stage_0069_price_map` m WHERE m.line_id=ledger_line.id)
WHERE id IN (SELECT line_id FROM `__stage_0069_price_map` WHERE price_id IS NOT NULL);--> statement-breakpoint

-- End checks.
INSERT INTO `__gate_0069` (`rule_ids`) SELECT NULL WHERE EXISTS (SELECT 1 FROM `entry_cash` WHERE cash_rule_id IS NULL)
 OR EXISTS (SELECT 1 FROM `entry_tournament` WHERE tournament_rule_id IS NULL)
 OR (SELECT count(*) FROM `__stage_0069_cash_rule`) <> (SELECT cash FROM `__stage_0069_counts`)
 OR (SELECT count(*) FROM `__stage_0069_tour_rule`) <> (SELECT tournament FROM `__stage_0069_counts`);--> statement-breakpoint
INSERT INTO `__gate_0069` (`same_master`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `entry_cash` ec JOIN `cash_rule` r ON r.id=ec.cash_rule_id AND r.user_id=ec.user_id
 LEFT JOIN `ring_game` m ON m.id=ec.ring_game_id AND m.user_id=ec.user_id
 WHERE r.ring_game_id IS NOT ec.ring_game_id
 OR (ec.ring_game_id IS NULL AND r.parent_rule_id IS NOT NULL)
 OR (ec.ring_game_id IS NOT NULL AND r.id<>m.current_rule_id AND r.parent_rule_id IS NOT m.current_rule_id)
) OR EXISTS (
 SELECT 1 FROM `entry_tournament` et JOIN `tournament_rule` r ON r.id=et.tournament_rule_id AND r.user_id=et.user_id
 LEFT JOIN `tournament` m ON m.id=et.tournament_id AND m.user_id=et.user_id
 WHERE r.tournament_id IS NOT et.tournament_id
 OR (et.tournament_id IS NULL AND r.parent_rule_id IS NOT NULL)
 OR (et.tournament_id IS NOT NULL AND r.id<>m.current_rule_id AND r.parent_rule_id IS NOT m.current_rule_id)
);--> statement-breakpoint
-- A-13 entry half: the stored version's fingerprint equals the snapshot's.
CREATE TABLE `__stage_0069_stored_lineup` AS
SELECT DISTINCT g.lineup_id,
 quote(l.game_mix_id)||'|'||group_concat(quote(g.position)||':'||quote(g.game_group_id)||':'||quote(v.position)||':'||quote(v.variant_id),',') OVER (PARTITION BY g.lineup_id ORDER BY g.position,v.position ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
FROM `game_lineup` l JOIN `game_lineup_group` g ON g.lineup_id=l.id AND g.user_id=l.user_id
JOIN `game_lineup_variant` v ON v.lineup_group_id=g.id AND v.user_id=g.user_id
WHERE l.id IN (SELECT r.lineup_id FROM `cash_rule` r JOIN `entry_cash` ec ON ec.cash_rule_id=r.id AND ec.user_id=r.user_id)
 OR l.id IN (SELECT r.lineup_id FROM `tournament_rule` r JOIN `entry_tournament` et ON et.tournament_rule_id=r.id AND et.user_id=r.user_id)
 OR l.id IN (SELECT lv.lineup_id FROM `tournament_rule_level` lv JOIN `entry_tournament` et ON et.tournament_rule_id=lv.rule_id AND et.user_id=lv.user_id);--> statement-breakpoint
INSERT INTO `__gate_0069` (`entry_content`) SELECT NULL WHERE EXISTS (
 WITH stake AS (
 SELECT DISTINCT s.rule_id,
 group_concat(quote(g.position)||':'||quote(s.blind1)||':'||quote(s.blind2)||':'||quote(s.blind3)||':'||quote(s.ante)||':'||quote(s.ante_type),',') OVER (PARTITION BY s.rule_id ORDER BY g.position ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
 FROM `cash_rule_stake` s JOIN `game_lineup_group` g ON g.id=s.lineup_group_id AND g.user_id=s.user_id
 WHERE s.rule_id IN (SELECT cash_rule_id FROM `entry_cash`)
 )
 SELECT 1 FROM `__stage_0069_cash_fp` f JOIN `entry_cash` ec ON ec.entry_id=f.entry_id AND ec.user_id=f.user_id
 LEFT JOIN `cash_rule` c ON c.id=ec.cash_rule_id AND c.user_id=ec.user_id
 LEFT JOIN `__stage_0069_stored_lineup` l ON l.lineup_id=c.lineup_id LEFT JOIN stake s ON s.rule_id=c.id
 WHERE f.fp IS NOT l.fp||'#'||s.fp||'#'||quote(c.min_buy_in)||':'||quote(c.max_buy_in)||':'||quote(c.table_size)||':'||quote(trim(replace(replace(COALESCE(c.house_rules,''),char(13,10),char(10)),char(13),char(10)),char(32,9,10,11,12,13,160,65279,8232,8233,12288)))
) OR EXISTS (
 WITH stake AS (
 SELECT DISTINCT s.level_id,
 group_concat(quote(g.position)||':'||quote(s.blind1)||':'||quote(s.blind2)||':'||quote(s.blind3)||':'||quote(s.ante)||':'||quote(s.ante_type),',') OVER (PARTITION BY s.level_id ORDER BY g.position ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
 FROM `tournament_rule_level_stake` s JOIN `game_lineup_group` g ON g.id=s.lineup_group_id AND g.user_id=s.user_id
 WHERE s.level_id IN (SELECT l.id FROM `tournament_rule_level` l JOIN `entry_tournament` et ON et.tournament_rule_id=l.rule_id AND et.user_id=l.user_id)
 ), levels AS (
 SELECT DISTINCT l.rule_id, group_concat(quote(l.level)||':'||quote(l.is_break)||':'||quote(l.minutes)||':'||quote(l.inherits_lineup)||':'||CASE WHEN l.inherits_lineup=1 THEN '' ELSE lf.fp END||':'||COALESCE(s.fp,''),';') OVER (PARTITION BY l.rule_id ORDER BY l.ordinal ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
 FROM `tournament_rule_level` l LEFT JOIN `__stage_0069_stored_lineup` lf ON lf.lineup_id=l.lineup_id LEFT JOIN stake s ON s.level_id=l.id
 WHERE l.rule_id IN (SELECT tournament_rule_id FROM `entry_tournament`)
 ), prices AS (
 SELECT DISTINCT p.rule_id, group_concat(quote(p.kind)||':'||quote(p.asset_id)||':'||quote(p.amount)||':'||quote(p.fee)||':'||quote(p.chips)||':'||quote(p.label),',') OVER (PARTITION BY p.rule_id ORDER BY p.ordinal ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS fp
 FROM `tournament_rule_price` p WHERE p.rule_id IN (SELECT tournament_rule_id FROM `entry_tournament`)
 )
 SELECT 1 FROM `__stage_0069_tour_fp` f JOIN `entry_tournament` et ON et.entry_id=f.entry_id AND et.user_id=f.user_id
 LEFT JOIN `tournament_rule` r ON r.id=et.tournament_rule_id AND r.user_id=et.user_id
 LEFT JOIN `__stage_0069_stored_lineup` d ON d.lineup_id=r.lineup_id LEFT JOIN levels l ON l.rule_id=r.id LEFT JOIN prices p ON p.rule_id=r.id
 WHERE f.fp IS NOT d.fp||'#'||quote(r.starting_stack)||':'||quote(r.table_size)||':'||quote(r.bounty_amount)||':'||quote(trim(replace(replace(COALESCE(r.house_rules,''),char(13,10),char(10)),char(13),char(10)),char(32,9,10,11,12,13,160,65279,8232,8233,12288)))
 ||'#'||COALESCE(l.fp,'')||'#'||COALESCE(p.fp,'')
);--> statement-breakpoint
INSERT INTO `__gate_0069` (`stake_coverage`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `cash_rule` r JOIN `game_lineup_group` g ON g.lineup_id=r.lineup_id AND g.user_id=r.user_id
 WHERE r.id IN (SELECT cash_rule_id FROM `entry_cash`)
 AND NOT EXISTS (SELECT 1 FROM `cash_rule_stake` s WHERE s.rule_id=r.id AND s.lineup_group_id=g.id AND s.user_id=r.user_id)
) OR EXISTS (
 SELECT 1 FROM `tournament_rule_level` l WHERE l.rule_id IN (SELECT tournament_rule_id FROM `entry_tournament`)
 AND ((l.is_break=1 AND EXISTS (SELECT 1 FROM `tournament_rule_level_stake` s WHERE s.level_id=l.id))
 OR (l.is_break=0 AND EXISTS (SELECT 1 FROM `game_lineup_group` g WHERE g.lineup_id=l.lineup_id AND g.user_id=l.user_id
 AND NOT EXISTS (SELECT 1 FROM `tournament_rule_level_stake` s WHERE s.level_id=l.id AND s.lineup_group_id=g.id AND s.user_id=l.user_id))))
) OR (SELECT count(*) FROM `tournament_rule_level` WHERE id LIKE 'trl:e:%') <> (SELECT count(*) FROM `__stage_0069_tour_level`);--> statement-breakpoint
INSERT INTO `__gate_0069` (`lineups`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `game_lineup` l WHERE (l.id LIKE 'lu:cr:e:%' OR l.id LIKE 'lu:tr:e:%' OR l.id LIKE 'lu:trl:e:%')
 AND NOT EXISTS (SELECT 1 FROM `game_lineup_group` g WHERE g.lineup_id=l.id AND g.user_id=l.user_id)
) OR EXISTS (
 SELECT 1 FROM `game_lineup_group` g WHERE (g.lineup_id LIKE 'lu:cr:e:%' OR g.lineup_id LIKE 'lu:tr:e:%' OR g.lineup_id LIKE 'lu:trl:e:%')
 AND NOT EXISTS (SELECT 1 FROM `game_lineup_variant` v WHERE v.lineup_group_id=g.id AND v.user_id=g.user_id)
) OR EXISTS (
 SELECT 1 FROM `game_lineup` l WHERE (l.id LIKE 'lu:cr:e:%' OR l.id LIKE 'lu:tr:e:%' OR l.id LIKE 'lu:trl:e:%')
 AND NOT EXISTS (SELECT 1 FROM `cash_rule` r WHERE r.lineup_id=l.id) AND NOT EXISTS (SELECT 1 FROM `tournament_rule` r WHERE r.lineup_id=l.id)
 AND NOT EXISTS (SELECT 1 FROM `tournament_rule_level` r WHERE r.lineup_id=l.id)
);--> statement-breakpoint
INSERT INTO `__gate_0069` (`prices`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `ledger_line` l JOIN `entry_tournament` et ON et.entry_id=l.entry_id AND et.user_id=l.user_id
 LEFT JOIN `tournament_rule_price` p ON p.id=l.price_id AND p.user_id=l.user_id
 WHERE l.role IN ('buy_in','fee') AND (p.id IS NULL OR p.rule_id<>et.tournament_rule_id OR p.kind<>'entry' OR p.asset_id<>l.asset_id
 OR -l.quantity<>CASE l.role WHEN 'buy_in' THEN p.amount ELSE p.fee END)
) OR EXISTS (
 SELECT 1 FROM `ledger_line` l JOIN `entry` e ON e.id=l.entry_id AND e.user_id=l.user_id JOIN `entry_tournament` et ON et.entry_id=l.entry_id AND et.user_id=l.user_id
 LEFT JOIN `tournament_rule_price` p ON p.id=l.price_id AND p.user_id=l.user_id
 WHERE l.role='chip_purchase' AND (p.id IS NULL OR p.rule_id<>et.tournament_rule_id OR p.kind<>'addon' OR p.asset_id<>l.asset_id OR (e.source='manual' AND -l.quantity<>p.amount))
) OR EXISTS (
 SELECT 1 FROM `__stage_0069_price_map` m JOIN `ledger_line` l ON l.id=m.line_id
 WHERE m.role='chip_purchase' AND (m.price_id IS NULL OR l.price_id IS NOT m.price_id
 OR EXISTS (SELECT 1 FROM `__stage_0069_price_map` o WHERE o.line_id=m.line_id AND o.rowid<>m.rowid))
) OR EXISTS (
 SELECT 1 FROM `__stage_0069_purchase` cp JOIN `entry` e ON e.id=cp.entry_id
 WHERE e.source='manual' AND cp.cost > 0 AND cp.count > 0
 AND cp.count<>(SELECT count(*) FROM `__stage_0069_price_map` m WHERE m.purchase_id=cp.id AND m.price_id IS NOT NULL)
) OR EXISTS (
 SELECT 1 FROM `ledger_line` l WHERE l.price_id IS NOT NULL AND l.id NOT IN (SELECT line_id FROM `__stage_0069_price_map`)
);--> statement-breakpoint
INSERT INTO `__gate_0069` (`ledger_preserved`) SELECT NULL WHERE EXISTS (
 SELECT id,user_id,asset_id,quantity,role,effect,entry_id,play_session_id,source_event_id,category_id,transfer_id,occurred_at,memo,created_at,updated_at FROM `__stage_0069_ledger`
 EXCEPT SELECT id,user_id,asset_id,quantity,role,effect,entry_id,play_session_id,source_event_id,category_id,transfer_id,occurred_at,memo,created_at,updated_at FROM `ledger_line`
) OR EXISTS (
 SELECT id,user_id,asset_id,quantity,role,effect,entry_id,play_session_id,source_event_id,category_id,transfer_id,occurred_at,memo,created_at,updated_at FROM `ledger_line`
 EXCEPT SELECT id,user_id,asset_id,quantity,role,effect,entry_id,play_session_id,source_event_id,category_id,transfer_id,occurred_at,memo,created_at,updated_at FROM `__stage_0069_ledger`
) OR (SELECT count(*) FROM `ledger_line`) <> (SELECT count(*) FROM `__stage_0069_ledger`);--> statement-breakpoint
INSERT INTO `__gate_0069` (`big_bet_blind3`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `cash_rule_stake` s JOIN `game_lineup_group` g ON g.id=s.lineup_group_id AND g.user_id=s.user_id
 JOIN `game_group` gg ON gg.id=g.game_group_id AND gg.user_id=g.user_id
 WHERE gg.builtin_key='bigbet' AND s.blind3 IS NOT NULL
) OR EXISTS (
 SELECT 1 FROM `tournament_rule_level_stake` s JOIN `game_lineup_group` g ON g.id=s.lineup_group_id AND g.user_id=s.user_id
 JOIN `game_group` gg ON gg.id=g.game_group_id AND gg.user_id=g.user_id
 WHERE gg.builtin_key='bigbet' AND s.blind3 IS NOT NULL
);--> statement-breakpoint

-- Rebuild both leaf details with NOT NULL rule ids; nothing references them.
CREATE TABLE `__stage_0069_entry_cash` AS SELECT entry_id,user_id,kind,ring_game_id,cash_rule_id,ev_diff FROM `entry_cash`;--> statement-breakpoint
CREATE TABLE `__stage_0069_entry_tournament` AS SELECT entry_id,user_id,kind,tournament_id,tournament_rule_id,placement,total_entries,before_deadline FROM `entry_tournament`;--> statement-breakpoint
DROP TABLE `entry_cash`;--> statement-breakpoint
CREATE TABLE `entry_cash` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`ring_game_id` text,
	`cash_rule_id` text NOT NULL,
	`ev_diff` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`,`kind`,`user_id`) REFERENCES `entry`(`id`,`kind`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ring_game_id`,`user_id`) REFERENCES `ring_game`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cash_rule_id`,`user_id`) REFERENCES `cash_rule`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cash_rule_id`,`ring_game_id`) REFERENCES `cash_rule`(`id`,`ring_game_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entry_cash_kind_check" CHECK("entry_cash"."kind" = 'cash')
);--> statement-breakpoint
CREATE INDEX `entry_cash_ring_game_idx` ON `entry_cash` (`ring_game_id`);--> statement-breakpoint
CREATE INDEX `entry_cash_cash_rule_idx` ON `entry_cash` (`cash_rule_id`);--> statement-breakpoint
INSERT INTO `entry_cash` (entry_id,user_id,kind,ring_game_id,cash_rule_id,ev_diff)
SELECT entry_id,user_id,kind,ring_game_id,cash_rule_id,ev_diff FROM `__stage_0069_entry_cash`;--> statement-breakpoint
DROP TABLE `entry_tournament`;--> statement-breakpoint
CREATE TABLE `entry_tournament` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`tournament_id` text,
	`tournament_rule_id` text NOT NULL,
	`placement` integer,
	`total_entries` integer,
	`before_deadline` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`,`kind`,`user_id`) REFERENCES `entry`(`id`,`kind`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`,`user_id`) REFERENCES `tournament`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tournament_rule_id`,`user_id`) REFERENCES `tournament_rule`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tournament_rule_id`,`tournament_id`) REFERENCES `tournament_rule`(`id`,`tournament_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entry_tournament_kind_check" CHECK("entry_tournament"."kind" = 'tournament'),
	CONSTRAINT "entry_tournament_placement_check" CHECK("entry_tournament"."placement" >= 1),
	CONSTRAINT "entry_tournament_total_entries_check" CHECK("entry_tournament"."total_entries" >= 1),
	CONSTRAINT "entry_tournament_placement_within_total_check" CHECK("entry_tournament"."placement" <= "entry_tournament"."total_entries"),
	CONSTRAINT "entry_tournament_before_deadline_check" CHECK("entry_tournament"."before_deadline" IN (0, 1)),
	CONSTRAINT "entry_tournament_before_deadline_placement_check" CHECK("entry_tournament"."before_deadline" = 0 OR "entry_tournament"."placement" IS NULL)
);--> statement-breakpoint
CREATE INDEX `entry_tournament_tournament_idx` ON `entry_tournament` (`tournament_id`);--> statement-breakpoint
CREATE INDEX `entry_tournament_tournament_rule_idx` ON `entry_tournament` (`tournament_rule_id`);--> statement-breakpoint
INSERT INTO `entry_tournament` (entry_id,user_id,kind,tournament_id,tournament_rule_id,placement,total_entries,before_deadline)
SELECT entry_id,user_id,kind,tournament_id,tournament_rule_id,placement,total_entries,before_deadline FROM `__stage_0069_entry_tournament`;--> statement-breakpoint
INSERT INTO `__gate_0069` (`details_rebuilt`) SELECT NULL WHERE
 (SELECT count(*) FROM `entry_cash`) <> (SELECT cash FROM `__stage_0069_counts`)
 OR (SELECT count(*) FROM `entry_tournament`) <> (SELECT tournament FROM `__stage_0069_counts`)
 OR EXISTS (SELECT * FROM `__stage_0069_entry_cash` EXCEPT SELECT entry_id,user_id,kind,ring_game_id,cash_rule_id,ev_diff FROM `entry_cash`)
 OR EXISTS (SELECT * FROM `__stage_0069_entry_tournament` EXCEPT SELECT entry_id,user_id,kind,tournament_id,tournament_rule_id,placement,total_entries,before_deadline FROM `entry_tournament`);--> statement-breakpoint
INSERT INTO `__gate_0069` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check);--> statement-breakpoint

DROP TABLE `__stage_0069_entry_tournament`;--> statement-breakpoint
DROP TABLE `__stage_0069_entry_cash`;--> statement-breakpoint
DROP TABLE `__stage_0069_stored_lineup`;--> statement-breakpoint
DROP TABLE `__stage_0069_addon`;--> statement-breakpoint
DROP TABLE `__stage_0069_price_map`;--> statement-breakpoint
DROP TABLE `__stage_0069_purchase`;--> statement-breakpoint
DROP TABLE `__stage_0069_tour_level`;--> statement-breakpoint
DROP TABLE `__stage_0069_tour_version`;--> statement-breakpoint
DROP TABLE `__stage_0069_tour_rule`;--> statement-breakpoint
DROP TABLE `__stage_0069_tour_master`;--> statement-breakpoint
DROP TABLE `__stage_0069_tour_fp`;--> statement-breakpoint
DROP TABLE `__stage_0069_tour_lineup_fp`;--> statement-breakpoint
DROP TABLE `__stage_0069_price`;--> statement-breakpoint
DROP TABLE `__stage_0069_level_stake`;--> statement-breakpoint
DROP TABLE `__stage_0069_tour_default`;--> statement-breakpoint
DROP TABLE `__stage_0069_level_lineup`;--> statement-breakpoint
DROP TABLE `__stage_0069_mix_variant`;--> statement-breakpoint
DROP TABLE `__stage_0069_tour_mix`;--> statement-breakpoint
DROP TABLE `__stage_0069_default_variant`;--> statement-breakpoint
DROP TABLE `__stage_0069_level_group`;--> statement-breakpoint
DROP TABLE `__stage_0069_level_variant`;--> statement-breakpoint
DROP TABLE `__stage_0069_needed_variant`;--> statement-breakpoint
DROP TABLE `__stage_0069_tour_resolution`;--> statement-breakpoint
DROP TABLE `__stage_0069_json_variant`;--> statement-breakpoint
DROP TABLE `__stage_0069_json_group`;--> statement-breakpoint
DROP TABLE `__stage_0069_level`;--> statement-breakpoint
DROP TABLE `__stage_0069_tour`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_version`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_rule`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_master`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_fp`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_stake`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_variant`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_mix`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_final_groups`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_items`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_resolved`;--> statement-breakpoint
DROP TABLE `__stage_0069_needed_group`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_labels`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_groups`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash_selection`;--> statement-breakpoint
DROP TABLE `__stage_0069_cash`;--> statement-breakpoint
DROP TABLE `__stage_0069_master_lineup`;--> statement-breakpoint
DROP TABLE `__stage_0069_builtin`;--> statement-breakpoint
DROP TABLE `__stage_0069_counts`;--> statement-breakpoint
DROP TABLE `__stage_0069_ledger`;--> statement-breakpoint
DROP TABLE `__gate_0069`;
