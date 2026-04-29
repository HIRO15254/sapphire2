-- Consolidate `update_tournament_info` events into `update_stack` events.
--
-- Tournament sessions previously emitted two events per submission:
--   - update_stack (mandatory): stackAmount only
--   - update_tournament_info (optional): remainingPlayers, totalEntries,
--     averageStack, chipPurchaseCounts
--
-- These are now combined into a single `update_stack` event whose payload
-- carries the stack amount plus the optional tournament-info fields.
-- `averageStack` is intentionally not persisted on the consolidated
-- payload — it is derived on read from startingStack, totalEntries,
-- remainingPlayers, and chipPurchaseCounts.
--
-- Migration steps:
--   1. For every `update_tournament_info` paired with an `update_stack`
--      having the same `(session_id, occurred_at)`, merge the info fields
--      into the stack payload.
--   2. For orphan `update_tournament_info` events (no matching stack),
--      convert them into an `update_stack` whose stackAmount is inherited
--      from the most recent prior `update_stack` (or 0 when none exists).
--   3. Drop all remaining `update_tournament_info` rows that were merged.
--   4. Strip any legacy `averageStack` keys from `update_stack` payloads.

-- 1. Merge matched pairs into the update_stack row.
UPDATE session_event AS us
SET
    payload = json_patch(us.payload, uti.payload),
    updated_at = unixepoch()
FROM session_event AS uti
WHERE us.event_type = 'update_stack'
  AND uti.event_type = 'update_tournament_info'
  AND us.session_id = uti.session_id
  AND us.occurred_at = uti.occurred_at;
--> statement-breakpoint

-- 2. Convert orphan update_tournament_info rows into update_stack rows
--    with an inherited stackAmount from the most recent prior update_stack.
UPDATE session_event AS uti
SET
    event_type = 'update_stack',
    payload = json_set(
        uti.payload,
        '$.stackAmount',
        COALESCE(
            (
                SELECT json_extract(prev.payload, '$.stackAmount')
                FROM session_event AS prev
                WHERE prev.session_id = uti.session_id
                  AND prev.event_type = 'update_stack'
                  AND prev.sort_order < uti.sort_order
                ORDER BY prev.sort_order DESC
                LIMIT 1
            ),
            0
        )
    ),
    updated_at = unixepoch()
WHERE uti.event_type = 'update_tournament_info'
  AND NOT EXISTS (
      SELECT 1 FROM session_event AS us
      WHERE us.event_type = 'update_stack'
        AND us.session_id = uti.session_id
        AND us.occurred_at = uti.occurred_at
  );
--> statement-breakpoint

-- 3. Delete the now-merged update_tournament_info rows.
DELETE FROM session_event
WHERE event_type = 'update_tournament_info';
--> statement-breakpoint

-- 4. Strip legacy averageStack from any consolidated payloads.
UPDATE session_event
SET
    payload = json_remove(payload, '$.averageStack'),
    updated_at = unixepoch()
WHERE event_type = 'update_stack'
  AND json_extract(payload, '$.averageStack') IS NOT NULL;
