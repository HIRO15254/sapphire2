-- Migration: Redesign session event types and payloads
-- This migration transforms old event_type values and payload JSON structures
-- to match the new session event redesign.
--
-- OLD event types being consumed: chip_add, stack_record,
--   tournament_stack_record, tournament_result
-- NEW event types being introduced: chips_add_remove, update_stack, all_in,
--   purchase_chips, update_tournament_info, session_pause, session_resume
--
-- D1 / SQLite compatible. Uses json_extract() for reading JSON,
-- string concatenation for writing JSON, and recursive CTEs for
-- iterating over JSON arrays.

-- ============================================================
-- SECTION 1: CASH GAME EVENTS
-- ============================================================

-- 1a. Promote the first chip_add per cash session into the session_start payload.
--     "First" = lowest sort_order among chip_add events for that session.
--
--     UPDATE the session_start event whose session has a chip_add:
--     set its payload to {"buyInAmount": <amount from first chip_add>}.
UPDATE session_event
SET
    payload = '{"buyInAmount":' || json_extract(
        (
            SELECT e2.payload
            FROM session_event e2
            WHERE e2.live_cash_game_session_id = session_event.live_cash_game_session_id
              AND e2.event_type = 'chip_add'
            ORDER BY e2.sort_order ASC
            LIMIT 1
        ),
        '$.amount'
    ) || '}',
    updated_at = unixepoch()
WHERE event_type = 'session_start'
  AND live_cash_game_session_id IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM session_event e2
      WHERE e2.live_cash_game_session_id = session_event.live_cash_game_session_id
        AND e2.event_type = 'chip_add'
  );
--> statement-breakpoint

-- 1b. DELETE the first chip_add per cash session (it has been merged above).
DELETE FROM session_event
WHERE event_type = 'chip_add'
  AND live_cash_game_session_id IS NOT NULL
  AND id IN (
      SELECT first_chip_add.id
      FROM (
          SELECT id,
                 live_cash_game_session_id,
                 ROW_NUMBER() OVER (
                     PARTITION BY live_cash_game_session_id
                     ORDER BY sort_order ASC
                 ) AS rn
          FROM session_event
          WHERE event_type = 'chip_add'
            AND live_cash_game_session_id IS NOT NULL
      ) AS first_chip_add
      WHERE first_chip_add.rn = 1
  );
--> statement-breakpoint

-- 1c. Remaining chip_add events (2nd and beyond per session):
--     UPDATE event_type to chips_add_remove, payload from {"amount":N}
--     to {"amount":N,"type":"add"}.
UPDATE session_event
SET
    event_type = 'chips_add_remove',
    payload = '{"amount":' || json_extract(payload, '$.amount') || ',"type":"add"}',
    updated_at = unixepoch()
WHERE event_type = 'chip_add'
  AND live_cash_game_session_id IS NOT NULL;
--> statement-breakpoint

-- ============================================================
-- SECTION 2: CASH GAME stack_record -> update_stack + all_in events
-- ============================================================

-- 2a. INSERT all_in events derived from allIns arrays in stack_record events.
--
--     SQLite has no native FOR EACH loop, so we use a recursive CTE to
--     iterate indices 0..N-1 for each stack_record event.
--     json_array_length() returns NULL when the key is missing, so we
--     default to 0 to skip gracefully.
--
--     Each allIn entry becomes a new all_in event with:
--       - sort_order = original sort_order + (index + 1)
--       - occurred_at = same as parent stack_record
--       - payload = {"potSize":P,"trials":T,"equity":E,"wins":W}
--
--     We use a NOT EXISTS guard so re-running does not duplicate rows
--     (after the first run, stack_record rows no longer exist).
WITH RECURSIVE allin_iter(
    src_id,
    live_cash_game_session_id,
    live_tournament_session_id,
    occurred_at,
    base_sort_order,
    payload,
    idx,
    total
) AS (
    -- Base: seed one row per stack_record event, starting at index 0
    SELECT
        id,
        live_cash_game_session_id,
        live_tournament_session_id,
        occurred_at,
        sort_order,
        payload,
        0,
        COALESCE(json_array_length(json_extract(payload, '$.allIns')), 0)
    FROM session_event
    WHERE event_type = 'stack_record'
      AND live_cash_game_session_id IS NOT NULL
      AND COALESCE(json_array_length(json_extract(payload, '$.allIns')), 0) > 0

    UNION ALL

    -- Recurse: advance index until we reach total
    SELECT
        src_id,
        live_cash_game_session_id,
        live_tournament_session_id,
        occurred_at,
        base_sort_order,
        payload,
        idx + 1,
        total
    FROM allin_iter
    WHERE idx + 1 < total
)
INSERT INTO session_event (
    id,
    live_cash_game_session_id,
    live_tournament_session_id,
    event_type,
    occurred_at,
    sort_order,
    payload,
    created_at,
    updated_at
)
SELECT
    hex(randomblob(16)),
    live_cash_game_session_id,
    live_tournament_session_id,
    'all_in',
    occurred_at,
    base_sort_order + (idx + 1),
    '{' ||
        '"potSize":'  || json_extract(payload, '$.allIns[' || idx || '].potSize')  || ',' ||
        '"trials":'   || json_extract(payload, '$.allIns[' || idx || '].trials')   || ',' ||
        '"equity":'   || json_extract(payload, '$.allIns[' || idx || '].equity')   || ',' ||
        '"wins":'     || json_extract(payload, '$.allIns[' || idx || '].wins')     ||
    '}',
    unixepoch(),
    unixepoch()
FROM allin_iter;
--> statement-breakpoint

-- 2b. UPDATE the session_end payload with cashOutAmount from the last
--     stack_record before session_end, for completed cash sessions.
--
--     "Last stack_record before session_end" = highest sort_order among
--     stack_record events with sort_order < session_end's sort_order.
UPDATE session_event
SET
    payload = '{"cashOutAmount":' || COALESCE(
        json_extract(
            (
                SELECT sr.payload
                FROM session_event sr
                WHERE sr.live_cash_game_session_id = session_event.live_cash_game_session_id
                  AND sr.event_type = 'stack_record'
                  AND sr.sort_order < session_event.sort_order
                ORDER BY sr.sort_order DESC
                LIMIT 1
            ),
            '$.stackAmount'
        ),
        0
    ) || '}',
    updated_at = unixepoch()
WHERE event_type = 'session_end'
  AND live_cash_game_session_id IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM session_event sr
      WHERE sr.live_cash_game_session_id = session_event.live_cash_game_session_id
        AND sr.event_type = 'stack_record'
        AND sr.sort_order < session_event.sort_order
  );
--> statement-breakpoint

-- 2c. UPDATE stack_record events to update_stack.
--     Strip allIns, keep only stackAmount.
UPDATE session_event
SET
    event_type = 'update_stack',
    payload = '{"stackAmount":' || COALESCE(json_extract(payload, '$.stackAmount'), 0) || '}',
    updated_at = unixepoch()
WHERE event_type = 'stack_record'
  AND live_cash_game_session_id IS NOT NULL;
--> statement-breakpoint

-- ============================================================
-- SECTION 3: TOURNAMENT EVENTS
-- ============================================================

-- 3a. INSERT purchase_chips events from chipPurchases arrays in
--     tournament_stack_record events.
--
--     Each chipPurchases entry becomes a new purchase_chips event with the
--     same session IDs, occurred_at, and sort_order as the parent event.
--     payload = {"name":"...","cost":N,"chips":N}
WITH RECURSIVE chip_purchase_iter(
    src_id,
    live_cash_game_session_id,
    live_tournament_session_id,
    occurred_at,
    base_sort_order,
    payload,
    idx,
    total
) AS (
    SELECT
        id,
        live_cash_game_session_id,
        live_tournament_session_id,
        occurred_at,
        sort_order,
        payload,
        0,
        COALESCE(json_array_length(json_extract(payload, '$.chipPurchases')), 0)
    FROM session_event
    WHERE event_type = 'tournament_stack_record'
      AND live_tournament_session_id IS NOT NULL
      AND COALESCE(json_array_length(json_extract(payload, '$.chipPurchases')), 0) > 0

    UNION ALL

    SELECT
        src_id,
        live_cash_game_session_id,
        live_tournament_session_id,
        occurred_at,
        base_sort_order,
        payload,
        idx + 1,
        total
    FROM chip_purchase_iter
    WHERE idx + 1 < total
)
INSERT INTO session_event (
    id,
    live_cash_game_session_id,
    live_tournament_session_id,
    event_type,
    occurred_at,
    sort_order,
    payload,
    created_at,
    updated_at
)
SELECT
    hex(randomblob(16)),
    live_cash_game_session_id,
    live_tournament_session_id,
    'purchase_chips',
    occurred_at,
    base_sort_order,
    '{' ||
        '"name":"'  || REPLACE(json_extract(payload, '$.chipPurchases[' || idx || '].name'), '"', '\"') || '",' ||
        '"cost":'   || json_extract(payload, '$.chipPurchases[' || idx || '].cost')   || ',' ||
        '"chips":'  || json_extract(payload, '$.chipPurchases[' || idx || '].chips')  ||
    '}',
    unixepoch(),
    unixepoch()
FROM chip_purchase_iter;
--> statement-breakpoint

-- 3b. INSERT update_tournament_info events from tournament_stack_record events
--     that carry remainingPlayers or totalEntries fields.
--
--     averageStack is not present in the old payload, so defaults to null.
INSERT INTO session_event (
    id,
    live_cash_game_session_id,
    live_tournament_session_id,
    event_type,
    occurred_at,
    sort_order,
    payload,
    created_at,
    updated_at
)
SELECT
    hex(randomblob(16)),
    live_cash_game_session_id,
    live_tournament_session_id,
    'update_tournament_info',
    occurred_at,
    sort_order,
    '{' ||
        '"remainingPlayers":' || COALESCE(CAST(json_extract(payload, '$.remainingPlayers') AS TEXT), 'null') || ',' ||
        '"totalEntries":'     || COALESCE(CAST(json_extract(payload, '$.totalEntries')     AS TEXT), 'null') || ',' ||
        '"averageStack":null' ||
    '}',
    unixepoch(),
    unixepoch()
FROM session_event
WHERE event_type = 'tournament_stack_record'
  AND live_tournament_session_id IS NOT NULL
  AND (
      json_extract(payload, '$.remainingPlayers') IS NOT NULL
      OR json_extract(payload, '$.totalEntries') IS NOT NULL
  );
--> statement-breakpoint

-- 3c. UPDATE tournament_stack_record to update_stack.
--     Keep only stackAmount.
UPDATE session_event
SET
    event_type = 'update_stack',
    payload = '{"stackAmount":' || COALESCE(json_extract(payload, '$.stackAmount'), 0) || '}',
    updated_at = unixepoch()
WHERE event_type = 'tournament_stack_record'
  AND live_tournament_session_id IS NOT NULL;
--> statement-breakpoint

-- 3d. UPDATE the session_end payload with tournament_result data.
--     Find the tournament_result event for the same session and merge its
--     fields into the session_end payload.
--
--     tournament_result payload is expected to have:
--       placement, totalEntries, prizeMoney, bountyPrizes
--     We always set beforeDeadline = false (only completed tournaments
--     have a tournament_result event).
UPDATE session_event
SET
    payload = '{' ||
        '"beforeDeadline":false,' ||
        '"placement":'    || COALESCE(json_extract(
            (SELECT tr.payload FROM session_event tr
             WHERE tr.live_tournament_session_id = session_event.live_tournament_session_id
               AND tr.event_type = 'tournament_result'
             LIMIT 1),
            '$.placement'), 0) || ',' ||
        '"totalEntries":' || COALESCE(json_extract(
            (SELECT tr.payload FROM session_event tr
             WHERE tr.live_tournament_session_id = session_event.live_tournament_session_id
               AND tr.event_type = 'tournament_result'
             LIMIT 1),
            '$.totalEntries'), 0) || ',' ||
        '"prizeMoney":'   || COALESCE(json_extract(
            (SELECT tr.payload FROM session_event tr
             WHERE tr.live_tournament_session_id = session_event.live_tournament_session_id
               AND tr.event_type = 'tournament_result'
             LIMIT 1),
            '$.prizeMoney'), 0) || ',' ||
        '"bountyPrizes":' || COALESCE(json_extract(
            (SELECT tr.payload FROM session_event tr
             WHERE tr.live_tournament_session_id = session_event.live_tournament_session_id
               AND tr.event_type = 'tournament_result'
             LIMIT 1),
            '$.bountyPrizes'), 0) ||
    '}',
    updated_at = unixepoch()
WHERE event_type = 'session_end'
  AND live_tournament_session_id IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM session_event tr
      WHERE tr.live_tournament_session_id = session_event.live_tournament_session_id
        AND tr.event_type = 'tournament_result'
  );
--> statement-breakpoint

-- 3e. DELETE tournament_result events (merged into session_end above).
DELETE FROM session_event
WHERE event_type = 'tournament_result';
--> statement-breakpoint

-- ============================================================
-- SECTION 4: LIFECYCLE EVENTS (reopen/pause migration)
-- ============================================================

-- 4a. Handle multiple session_start events per session (from old reopen flow).
--
--     Sessions with more than one session_start were reopened.
--     Keep the first (lowest sort_order) as session_start.
--     For 2nd and later session_start events:
--       - INSERT a session_pause event at (occurred_at, sort_order - 1)
--       - UPDATE the session_start to session_resume

-- Step 1: INSERT session_pause events before each non-first session_start.
--
--         We identify non-first session_start events by ranking them within
--         their session by sort_order. Rank > 1 are the ones to precede.
INSERT INTO session_event (
    id,
    live_cash_game_session_id,
    live_tournament_session_id,
    event_type,
    occurred_at,
    sort_order,
    payload,
    created_at,
    updated_at
)
SELECT
    hex(randomblob(16)),
    live_cash_game_session_id,
    live_tournament_session_id,
    'session_pause',
    occurred_at,
    sort_order - 1,
    '{}',
    unixepoch(),
    unixepoch()
FROM (
    SELECT
        id,
        live_cash_game_session_id,
        live_tournament_session_id,
        occurred_at,
        sort_order,
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(live_cash_game_session_id, live_tournament_session_id)
            ORDER BY sort_order ASC
        ) AS rn
    FROM session_event
    WHERE event_type = 'session_start'
) ranked
WHERE rn > 1;
--> statement-breakpoint

-- Step 2: UPDATE non-first session_start events to session_resume.
UPDATE session_event
SET
    event_type = 'session_resume',
    payload = '{}',
    updated_at = unixepoch()
WHERE event_type = 'session_start'
  AND id IN (
      SELECT id
      FROM (
          SELECT
              id,
              ROW_NUMBER() OVER (
                  PARTITION BY COALESCE(live_cash_game_session_id, live_tournament_session_id)
                  ORDER BY sort_order ASC
              ) AS rn
          FROM session_event
          WHERE event_type = 'session_start'
      ) ranked
      WHERE rn > 1
  );
--> statement-breakpoint

-- 4b. Handle multiple session_end events per session (defensive).
--
--     Keep the last (highest sort_order) as session_end.
--     Earlier session_end events become session_pause.
UPDATE session_event
SET
    event_type = 'session_pause',
    payload = '{}',
    updated_at = unixepoch()
WHERE event_type = 'session_end'
  AND id IN (
      SELECT id
      FROM (
          SELECT
              id,
              ROW_NUMBER() OVER (
                  PARTITION BY COALESCE(live_cash_game_session_id, live_tournament_session_id)
                  ORDER BY sort_order DESC
              ) AS rn
          FROM session_event
          WHERE event_type = 'session_end'
      ) ranked
      WHERE rn > 1
  );
