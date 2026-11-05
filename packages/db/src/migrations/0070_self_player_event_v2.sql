-- Data model v2, B15 (SA2-401): give every user one self player (Hero) and
-- rewrite every v1 play_event payload to v2 (data-model-v2.md §5.2, §8, §11,
-- §13, §16).
--
-- player.is_self marks the self row; a partial UNIQUE index allows one per
-- user. Every existing user gets self:<user_id> named 'Hero'.
--
-- Payments come from the ledger lines the same event already projected
-- (<event_id>:<n>, in n order): asset, quantity, role, effect and price are
-- copied, never derived from entry.asset_id or the current master. An event
-- with no line pays nothing. chips_add_remove takes its asset and effect from
-- its line. purchase_chips takes priceId from its line; a zero-cost purchase
-- has no line and takes the addon price at its session chip purchase's
-- snapshot position, as B13 priced lines. label and chips come from the price.
-- Hero join/leave events carry the owner's self player id; other player ids
-- are kept. A join/leave with neither playerId nor isHero only names a player
-- the user deleted, folds to nothing and is removed (SA2-401 user decision).
-- update_stack keeps chipPurchaseCounts (§11, §13.2).
--
-- Each gate inserts NULL into its own NOT NULL column of __gate_0070.
CREATE TABLE `__gate_0070` (
 `precondition` integer DEFAULT 1 NOT NULL,
 `self_players` integer DEFAULT 1 NOT NULL,
 `events_preserved` integer DEFAULT 1 NOT NULL,
 `versions` integer DEFAULT 1 NOT NULL,
 `payments_match_lines` integer DEFAULT 1 NOT NULL,
 `prices` integer DEFAULT 1 NOT NULL,
 `players` integer DEFAULT 1 NOT NULL,
 `foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
INSERT INTO `__gate_0070` (`precondition`) SELECT NULL WHERE EXISTS (SELECT 1 FROM `play_event` WHERE `schema_version` NOT IN (1, 2));--> statement-breakpoint

ALTER TABLE `player` ADD `is_self` integer DEFAULT false NOT NULL CONSTRAINT "player_is_self_check" CHECK("is_self" IN (0, 1));--> statement-breakpoint
CREATE UNIQUE INDEX `player_self_uq` ON `player` (`user_id`) WHERE "player"."is_self" = 1;--> statement-breakpoint
INSERT INTO `player` (id,user_id,name,is_temporary,is_self,updated_at)
SELECT 'self:'||u.id,u.id,'Hero',0,1,unixepoch() FROM `user` u;--> statement-breakpoint

CREATE TABLE `__stage_0070_event` AS SELECT id,user_id,entry_id,entry_source,play_session_id,type,schema_version,occurred_at,sort_order,payload,hand_id,created_at,updated_at FROM `play_event`;--> statement-breakpoint
CREATE TABLE `__stage_0070_orphan` AS
SELECT id FROM `play_event` WHERE schema_version=1 AND type IN ('player_join','player_leave')
 AND json_extract(payload,'$.isHero') IS NOT 1 AND json_type(payload,'$.playerId') IS NOT 'text';--> statement-breakpoint
DELETE FROM `play_event` WHERE id IN (SELECT id FROM `__stage_0070_orphan`);--> statement-breakpoint

CREATE TABLE `__stage_0070_line` AS
SELECT l.id AS line_id,pe.id AS event_id,pe.user_id,substr(l.id,length(pe.id)+2) AS n_text,
 CAST(substr(l.id,length(pe.id)+2) AS integer) AS n,
 l.asset_id,l.quantity,l.role,l.effect,l.price_id
FROM `ledger_line` l JOIN `play_event` pe ON pe.id=l.source_event_id AND pe.user_id=l.user_id
WHERE pe.schema_version=1;--> statement-breakpoint
CREATE TABLE `__stage_0070_payments` AS
SELECT DISTINCT event_id,
 json_group_array(json(payment)) OVER (PARTITION BY event_id ORDER BY n ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS payments
FROM (
 SELECT event_id,n,CASE WHEN price_id IS NULL
  THEN json_object('assetId',asset_id,'quantity',abs(quantity),'role',role,'effect',effect)
  ELSE json_object('assetId',asset_id,'quantity',abs(quantity),'role',role,'effect',effect,'priceId',price_id) END AS payment
 FROM `__stage_0070_line`
);--> statement-breakpoint
CREATE TABLE `__stage_0070_addon` AS
SELECT p.id,p.user_id,p.rule_id,row_number() OVER (PARTITION BY p.rule_id ORDER BY p.ordinal) AS position
FROM `tournament_rule_price` p WHERE p.kind='addon';--> statement-breakpoint
CREATE TABLE `__stage_0070_chip_position` AS
SELECT cp.id,cp.session_id AS entry_id,row_number() OVER (PARTITION BY cp.session_id ORDER BY cp.sort_order,cp.id) AS position
FROM `session_chip_purchase` cp;--> statement-breakpoint
CREATE TABLE `__stage_0070_purchase` AS
SELECT pe.id AS event_id,pe.user_id,
 COALESCE(
  (SELECT l.price_id FROM `__stage_0070_line` l WHERE l.event_id=pe.id AND l.n_text='0'),
  (SELECT a.id FROM `__stage_0070_addon` a JOIN `__stage_0070_chip_position` c ON c.position=a.position
   WHERE a.rule_id=et.tournament_rule_id AND a.user_id=et.user_id
   AND c.entry_id=pe.entry_id AND c.id=json_extract(pe.payload,'$.sessionChipPurchaseId')
   AND NOT EXISTS (SELECT 1 FROM `__stage_0070_line` l WHERE l.event_id=pe.id))
 ) AS price_id
FROM `play_event` pe JOIN `entry_tournament` et ON et.entry_id=pe.entry_id AND et.user_id=pe.user_id
WHERE pe.schema_version=1 AND pe.type='purchase_chips';--> statement-breakpoint

UPDATE `play_event` SET schema_version=2,payload=CASE
 WHEN EXISTS (SELECT 1 FROM `entry_tournament` et WHERE et.entry_id=play_event.entry_id AND et.user_id=play_event.user_id)
  AND json_type(payload,'$.timerStartedAt') IN ('integer','null')
 THEN json_set(json_object('payments',json(COALESCE((SELECT s.payments FROM `__stage_0070_payments` s WHERE s.event_id=play_event.id),'[]'))),
  '$.timerStartedAt',json_extract(payload,'$.timerStartedAt'))
 ELSE json_object('payments',json(COALESCE((SELECT s.payments FROM `__stage_0070_payments` s WHERE s.event_id=play_event.id),'[]')))
 END
WHERE schema_version=1 AND type='session_start';--> statement-breakpoint
UPDATE `play_event` SET schema_version=2,payload=CASE
 WHEN NOT EXISTS (SELECT 1 FROM `entry_tournament` et WHERE et.entry_id=play_event.entry_id AND et.user_id=play_event.user_id)
 THEN json_object('payments',json(COALESCE((SELECT s.payments FROM `__stage_0070_payments` s WHERE s.event_id=play_event.id),'[]')))
 WHEN json_extract(payload,'$.beforeDeadline')=1
 THEN json_object('beforeDeadline',json('true'),
  'payments',json(COALESCE((SELECT s.payments FROM `__stage_0070_payments` s WHERE s.event_id=play_event.id),'[]')))
 ELSE json_object('beforeDeadline',json('false'),'placement',json_extract(payload,'$.placement'),'totalEntries',json_extract(payload,'$.totalEntries'),
  'payments',json(COALESCE((SELECT s.payments FROM `__stage_0070_payments` s WHERE s.event_id=play_event.id),'[]')))
 END
WHERE schema_version=1 AND type='session_end';--> statement-breakpoint
UPDATE `play_event` SET schema_version=2,payload=json_object('amount',json_extract(payload,'$.amount'),
 'assetId',(SELECT l.asset_id FROM `__stage_0070_line` l WHERE l.event_id=play_event.id AND l.n_text='0'),
 'effect',(SELECT l.effect FROM `__stage_0070_line` l WHERE l.event_id=play_event.id AND l.n_text='0'))
WHERE schema_version=1 AND type='chips_add_remove';--> statement-breakpoint
UPDATE `play_event` SET schema_version=2,payload=json_object(
 'priceId',(SELECT p.price_id FROM `__stage_0070_purchase` p WHERE p.event_id=play_event.id),
 'label',COALESCE((SELECT NULLIF(r.label,'') FROM `__stage_0070_purchase` p JOIN `tournament_rule_price` r ON r.id=p.price_id AND r.user_id=p.user_id WHERE p.event_id=play_event.id),json_extract(payload,'$.name')),
 'chips',COALESCE((SELECT r.chips FROM `__stage_0070_purchase` p JOIN `tournament_rule_price` r ON r.id=p.price_id AND r.user_id=p.user_id WHERE p.event_id=play_event.id),json_extract(payload,'$.chips')),
 'payments',json(COALESCE((SELECT s.payments FROM `__stage_0070_payments` s WHERE s.event_id=play_event.id),'[]')))
WHERE schema_version=1 AND type='purchase_chips';--> statement-breakpoint
UPDATE `play_event` SET schema_version=2,payload=CASE WHEN type='player_join' AND json_type(payload,'$.seatPosition')='integer'
 THEN json_object('playerId',CASE WHEN json_extract(payload,'$.isHero') IS 1
  THEN (SELECT p.id FROM `player` p WHERE p.user_id=play_event.user_id AND p.is_self=1) ELSE json_extract(payload,'$.playerId') END,
  'seatPosition',json_extract(payload,'$.seatPosition'))
 ELSE json_object('playerId',CASE WHEN json_extract(payload,'$.isHero') IS 1
  THEN (SELECT p.id FROM `player` p WHERE p.user_id=play_event.user_id AND p.is_self=1) ELSE json_extract(payload,'$.playerId') END)
 END
WHERE schema_version=1 AND type IN ('player_join','player_leave');--> statement-breakpoint
UPDATE `play_event` SET schema_version=2
WHERE schema_version=1 AND type IN ('update_stack','all_in','session_pause','session_resume','memo');--> statement-breakpoint

-- End checks.
INSERT INTO `__gate_0070` (`self_players`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `user` u WHERE (SELECT count(*) FROM `player` p WHERE p.user_id=u.id AND p.is_self=1) <> 1
) OR EXISTS (SELECT 1 FROM `player` WHERE is_self=1 AND is_temporary<>0);--> statement-breakpoint
INSERT INTO `__gate_0070` (`events_preserved`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `__stage_0070_event` s
 WHERE s.id NOT IN (SELECT id FROM `__stage_0070_orphan`)
 AND NOT EXISTS (SELECT 1 FROM `play_event` pe WHERE pe.id=s.id AND pe.user_id=s.user_id AND pe.entry_id=s.entry_id
  AND pe.entry_source=s.entry_source AND pe.play_session_id=s.play_session_id AND pe.type=s.type
  AND pe.occurred_at=s.occurred_at AND pe.sort_order=s.sort_order AND pe.hand_id IS s.hand_id
  AND pe.created_at=s.created_at AND pe.updated_at=s.updated_at
  AND (s.schema_version=1 OR pe.payload=s.payload))
) OR (SELECT count(*) FROM `play_event`) <> (SELECT count(*) FROM `__stage_0070_event`) - (SELECT count(*) FROM `__stage_0070_orphan`);--> statement-breakpoint
INSERT INTO `__gate_0070` (`versions`) SELECT NULL WHERE EXISTS (SELECT 1 FROM `play_event` WHERE schema_version<>2);--> statement-breakpoint
INSERT INTO `__gate_0070` (`payments_match_lines`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `__stage_0070_line` l
 WHERE substr(l.line_id,1,length(l.event_id)+1)<>l.event_id||':' OR l.n_text='' OR l.n_text GLOB '*[^0-9]*'
) OR EXISTS (
 SELECT 1 FROM `__stage_0070_line` l JOIN `play_event` pe ON pe.id=l.event_id AND pe.user_id=l.user_id
 WHERE pe.type IN ('session_start','session_end','purchase_chips') AND (
  json_extract(pe.payload,'$.payments['||l.n||'].assetId') IS NOT l.asset_id
  OR json_extract(pe.payload,'$.payments['||l.n||'].quantity') IS NOT abs(l.quantity)
  OR json_extract(pe.payload,'$.payments['||l.n||'].role') IS NOT l.role
  OR json_extract(pe.payload,'$.payments['||l.n||'].effect') IS NOT l.effect
  OR json_extract(pe.payload,'$.payments['||l.n||'].priceId') IS NOT l.price_id)
) OR EXISTS (
 SELECT 1 FROM `__stage_0070_line` l JOIN `play_event` pe ON pe.id=l.event_id AND pe.user_id=l.user_id
 WHERE pe.type='chips_add_remove' AND (l.n_text<>'0'
  OR json_extract(pe.payload,'$.assetId') IS NOT l.asset_id
  OR json_extract(pe.payload,'$.effect') IS NOT l.effect
  OR l.quantity IS NOT -json_extract(pe.payload,'$.amount')
  OR l.role IS NOT CASE WHEN json_extract(pe.payload,'$.amount')>0 THEN 'addon' ELSE 'chip_remove' END)
) OR EXISTS (
 SELECT 1 FROM `__stage_0070_event` s JOIN `play_event` pe ON pe.id=s.id AND pe.user_id=s.user_id
 WHERE s.schema_version=1 AND (
  (pe.type IN ('session_start','session_end','purchase_chips')
   AND json_array_length(pe.payload,'$.payments') IS NOT (SELECT count(*) FROM `__stage_0070_line` l WHERE l.event_id=pe.id))
  OR (pe.type='chips_add_remove' AND (SELECT count(*) FROM `__stage_0070_line` l WHERE l.event_id=pe.id)<>1)
  OR (pe.type NOT IN ('session_start','session_end','purchase_chips','chips_add_remove')
   AND EXISTS (SELECT 1 FROM `__stage_0070_line` l WHERE l.event_id=pe.id)))
);--> statement-breakpoint
INSERT INTO `__gate_0070` (`prices`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `__stage_0070_event` s JOIN `play_event` pe ON pe.id=s.id AND pe.user_id=s.user_id
 LEFT JOIN `tournament_rule_price` r ON r.id=json_extract(pe.payload,'$.priceId') AND r.user_id=pe.user_id
 WHERE s.schema_version=1 AND pe.type='purchase_chips' AND (
  r.id IS NULL OR r.kind<>'addon'
  OR json_type(pe.payload,'$.label')<>'text' OR json_extract(pe.payload,'$.label')=''
  OR json_type(pe.payload,'$.chips')<>'integer'
  OR (json_array_length(pe.payload,'$.payments')>0 AND json_extract(pe.payload,'$.payments[0].priceId') IS NOT r.id))
);--> statement-breakpoint
INSERT INTO `__gate_0070` (`players`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `__stage_0070_event` s JOIN `play_event` pe ON pe.id=s.id AND pe.user_id=s.user_id
 LEFT JOIN `player` p ON p.id=json_extract(pe.payload,'$.playerId') AND p.user_id=pe.user_id
 WHERE s.schema_version=1 AND pe.type IN ('player_join','player_leave') AND (
  p.id IS NULL
  OR (json_extract(s.payload,'$.isHero') IS 1 AND p.is_self<>1)
  OR (json_extract(s.payload,'$.isHero') IS NOT 1 AND p.id IS NOT json_extract(s.payload,'$.playerId'))
  OR (pe.type='player_join' AND json_extract(pe.payload,'$.seatPosition') IS NOT json_extract(s.payload,'$.seatPosition')))
) OR EXISTS (SELECT 1 FROM `play_event` WHERE json_type(payload,'$.isHero') IS NOT NULL);--> statement-breakpoint
INSERT INTO `__gate_0070` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check);--> statement-breakpoint

DROP TABLE `__stage_0070_purchase`;--> statement-breakpoint
DROP TABLE `__stage_0070_chip_position`;--> statement-breakpoint
DROP TABLE `__stage_0070_addon`;--> statement-breakpoint
DROP TABLE `__stage_0070_payments`;--> statement-breakpoint
DROP TABLE `__stage_0070_line`;--> statement-breakpoint
DROP TABLE `__stage_0070_orphan`;--> statement-breakpoint
DROP TABLE `__stage_0070_event`;--> statement-breakpoint
DROP TABLE `__gate_0070`;
