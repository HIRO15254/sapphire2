-- B23 stand-in cleanup (SA2-410). Rules recorded on the issue; they match
-- rows by condition, never by a list of ids, so they rerun on any copy.
-- The migration Unassigned asset is `unassigned:<user_id>`. In a room, its
-- references move to the one other asset the room's entries use; otherwise
-- to the asset named after the room, created when no asset has that
-- normalized name. A room-less entry, a line without an entry and a price
-- whose room is unknown keep Unassigned as an ordinary asset. Entries,
-- their lines, their events' payment assetIds, tournament rule prices (by
-- the master's room, else the room of the entries using the version) and
-- master default assets move together. Archived stand-in masters stay
-- archived. Migrated live dates are JST; an owner whose time zone is set
-- to anything but Asia/Tokyo aborts the migration, as SQLite cannot
-- recompute an IANA zone (user_setting is empty on the release copy).
-- Each gate inserts NULL into its own NOT NULL column of __gate_0074.
CREATE TABLE `__gate_0074` (
	`local_dates` integer DEFAULT 1 NOT NULL,
	`payloads` integer DEFAULT 1 NOT NULL,
	`prices` integer DEFAULT 1 NOT NULL,
	`foreign_keys_valid` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
INSERT INTO `__gate_0074` (`local_dates`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `play_session` p
	JOIN `entry` e ON e.id = p.entry_id AND e.user_id = p.user_id AND e.source = 'live'
	JOIN `game_session` gs ON gs.id = p.id AND gs.user_id = p.user_id
	JOIN `user_setting` s ON s.user_id = p.user_id
	WHERE s.time_zone IS NOT NULL AND s.time_zone <> 'Asia/Tokyo'
);--> statement-breakpoint
CREATE TABLE `__stage_0074_price` AS
SELECT p.id AS price_id, p.user_id AS user_id, COALESCE(t.room_id, (
	SELECT CASE WHEN count(DISTINCT e.room_id) = 1 THEN min(e.room_id) END
	FROM `entry_tournament` et JOIN `entry` e ON e.id = et.entry_id AND e.user_id = et.user_id
	WHERE et.tournament_rule_id = p.rule_id AND et.user_id = p.user_id AND e.room_id IS NOT NULL
)) AS room_id
FROM `tournament_rule_price` p
JOIN `tournament_rule` r ON r.id = p.rule_id AND r.user_id = p.user_id
LEFT JOIN `tournament` t ON t.id = r.tournament_id AND t.user_id = r.user_id
WHERE p.asset_id = 'unassigned:' || p.user_id;--> statement-breakpoint
CREATE TABLE `__stage_0074_room` AS
SELECT DISTINCT x.user_id AS user_id, x.room_id AS room_id, CAST(NULL AS text) AS asset_id FROM (
	SELECT e.user_id, e.room_id FROM `entry` e
	WHERE e.room_id IS NOT NULL AND (e.asset_id = 'unassigned:' || e.user_id
		OR EXISTS (SELECT 1 FROM `ledger_line` l WHERE l.entry_id = e.id AND l.user_id = e.user_id AND l.asset_id = 'unassigned:' || e.user_id))
	UNION SELECT user_id, room_id FROM `__stage_0074_price` WHERE room_id IS NOT NULL
	UNION SELECT user_id, room_id FROM `tournament` WHERE room_id IS NOT NULL AND default_asset_id = 'unassigned:' || user_id
	UNION SELECT user_id, room_id FROM `ring_game` WHERE room_id IS NOT NULL AND default_asset_id = 'unassigned:' || user_id
) x JOIN `room` rm ON rm.id = x.room_id AND rm.user_id = x.user_id;--> statement-breakpoint
UPDATE `__stage_0074_room` SET asset_id = (
	SELECT CASE WHEN count(DISTINCT e.asset_id) = 1 THEN min(e.asset_id) END FROM `entry` e
	WHERE e.user_id = __stage_0074_room.user_id AND e.room_id = __stage_0074_room.room_id
		AND e.asset_id IS NOT NULL AND e.asset_id <> 'unassigned:' || e.user_id
);--> statement-breakpoint
INSERT INTO `asset` (id, user_id, name, kind, decimals, created_at, updated_at)
SELECT 'room-asset:' || min(s.room_id), s.user_id, trim(rm.name), 'currency', 0, unixepoch(), unixepoch()
FROM `__stage_0074_room` s JOIN `room` rm ON rm.id = s.room_id AND rm.user_id = s.user_id
WHERE s.asset_id IS NULL AND trim(rm.name) <> ''
	AND NOT EXISTS (SELECT 1 FROM `asset` a WHERE a.user_id = s.user_id AND lower(trim(a.name)) = lower(trim(rm.name)))
GROUP BY s.user_id, lower(trim(rm.name));--> statement-breakpoint
UPDATE `__stage_0074_room` SET asset_id = (
	SELECT a.id FROM `asset` a JOIN `room` rm ON rm.id = __stage_0074_room.room_id AND rm.user_id = a.user_id
	WHERE a.user_id = __stage_0074_room.user_id AND lower(trim(a.name)) = lower(trim(rm.name)) AND trim(rm.name) <> ''
) WHERE asset_id IS NULL;--> statement-breakpoint
DELETE FROM `__stage_0074_room` WHERE asset_id IS NULL OR asset_id = 'unassigned:' || user_id;--> statement-breakpoint
CREATE TABLE `__stage_0074_entry` AS
SELECT e.id AS entry_id, e.user_id AS user_id, s.asset_id AS asset_id
FROM `entry` e JOIN `__stage_0074_room` s ON s.user_id = e.user_id AND s.room_id = e.room_id;--> statement-breakpoint
UPDATE `entry` SET asset_id = (SELECT s.asset_id FROM `__stage_0074_entry` s WHERE s.entry_id = entry.id AND s.user_id = entry.user_id)
WHERE asset_id = 'unassigned:' || user_id
	AND EXISTS (SELECT 1 FROM `__stage_0074_entry` s WHERE s.entry_id = entry.id AND s.user_id = entry.user_id);--> statement-breakpoint
UPDATE `ledger_line` SET asset_id = (SELECT s.asset_id FROM `__stage_0074_entry` s WHERE s.entry_id = ledger_line.entry_id AND s.user_id = ledger_line.user_id)
WHERE asset_id = 'unassigned:' || user_id
	AND EXISTS (SELECT 1 FROM `__stage_0074_entry` s WHERE s.entry_id = ledger_line.entry_id AND s.user_id = ledger_line.user_id);--> statement-breakpoint
UPDATE `play_event` SET payload = json_set(payload, '$.payments', json((
	SELECT json_group_array(json(x.payment)) FROM (
		SELECT CASE WHEN json_extract(p.value, '$.assetId') = 'unassigned:' || play_event.user_id
			THEN json_set(p.value, '$.assetId', s.asset_id) ELSE p.value END AS payment
		FROM json_each(play_event.payload, '$.payments') p
		ORDER BY p.key
	) x
)))
FROM `__stage_0074_entry` s
WHERE s.entry_id = play_event.entry_id AND s.user_id = play_event.user_id
	AND json_valid(play_event.payload) AND json_type(play_event.payload, '$.payments') = 'array'
	AND EXISTS (SELECT 1 FROM json_each(play_event.payload, '$.payments') p WHERE json_extract(p.value, '$.assetId') = 'unassigned:' || play_event.user_id);--> statement-breakpoint
UPDATE `play_event` SET payload = json_set(payload, '$.assetId', s.asset_id)
FROM `__stage_0074_entry` s
WHERE s.entry_id = play_event.entry_id AND s.user_id = play_event.user_id
	AND json_valid(play_event.payload) AND json_extract(play_event.payload, '$.assetId') = 'unassigned:' || play_event.user_id;--> statement-breakpoint
UPDATE `tournament_rule_price` SET asset_id = (
	SELECT s.asset_id FROM `__stage_0074_price` p JOIN `__stage_0074_room` s ON s.user_id = p.user_id AND s.room_id = p.room_id
	WHERE p.price_id = tournament_rule_price.id
) WHERE id IN (
	SELECT p.price_id FROM `__stage_0074_price` p JOIN `__stage_0074_room` s ON s.user_id = p.user_id AND s.room_id = p.room_id
);--> statement-breakpoint
UPDATE `tournament` SET default_asset_id = (SELECT s.asset_id FROM `__stage_0074_room` s WHERE s.user_id = tournament.user_id AND s.room_id = tournament.room_id)
WHERE default_asset_id = 'unassigned:' || user_id
	AND EXISTS (SELECT 1 FROM `__stage_0074_room` s WHERE s.user_id = tournament.user_id AND s.room_id = tournament.room_id);--> statement-breakpoint
UPDATE `ring_game` SET default_asset_id = (SELECT s.asset_id FROM `__stage_0074_room` s WHERE s.user_id = ring_game.user_id AND s.room_id = ring_game.room_id)
WHERE default_asset_id = 'unassigned:' || user_id
	AND EXISTS (SELECT 1 FROM `__stage_0074_room` s WHERE s.user_id = ring_game.user_id AND s.room_id = ring_game.room_id);--> statement-breakpoint
-- End checks.
INSERT INTO `__gate_0074` (`payloads`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `ledger_line` l
	JOIN `__stage_0074_entry` s ON s.entry_id = l.entry_id AND s.user_id = l.user_id
	JOIN `play_event` pe ON pe.id = l.source_event_id AND pe.user_id = l.user_id
	WHERE CASE WHEN json_type(pe.payload, '$.payments') = 'array'
		THEN json_extract(pe.payload, '$.payments[' || substr(l.id, length(pe.id) + 2) || '].assetId')
		ELSE json_extract(pe.payload, '$.assetId') END IS NOT l.asset_id
);--> statement-breakpoint
INSERT INTO `__gate_0074` (`prices`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `ledger_line` l
	JOIN `tournament_rule_price` pr ON pr.id = l.price_id AND pr.user_id = l.user_id
	WHERE pr.asset_id <> l.asset_id
);--> statement-breakpoint
INSERT INTO `__gate_0074` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check('entry'))
	OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('ledger_line'))
	OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('tournament_rule_price'))
	OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('tournament'))
	OR EXISTS (SELECT 1 FROM pragma_foreign_key_check('ring_game'));--> statement-breakpoint
DROP TABLE `__stage_0074_entry`;--> statement-breakpoint
DROP TABLE `__stage_0074_room`;--> statement-breakpoint
DROP TABLE `__stage_0074_price`;--> statement-breakpoint
DROP TABLE `__gate_0074`;
