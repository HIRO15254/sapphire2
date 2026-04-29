-- Move hero seat position from `game_session.hero_seat_position` into
-- `player_join` event payloads.
--
-- The hero's current seat used to live on `game_session.hero_seat_position`,
-- with `player_join` / `player_leave` events emitted alongside as bare
-- markers. The events on their own couldn't reconstruct the seat number,
-- so the column was the de-facto source of truth.
--
-- Moving forward, the seat number is carried on the `player_join` event
-- payload (`seatPosition`) and `heroSeatPosition` is derived from the
-- event stream. Migration steps:
--   1. Backfill `seatPosition` onto the latest unmatched hero `player_join`
--      event for any session with a non-null hero_seat_position column.
--   2. Drop the column from game_session.

UPDATE session_event AS pj
SET
    payload = json_set(pj.payload, '$.seatPosition', gs.hero_seat_position),
    updated_at = unixepoch()
FROM game_session AS gs
WHERE pj.session_id = gs.id
  AND gs.hero_seat_position IS NOT NULL
  AND pj.event_type = 'player_join'
  AND json_extract(pj.payload, '$.isHero') = 1
  AND pj.id = (
      SELECT inner_pj.id
      FROM session_event AS inner_pj
      WHERE inner_pj.session_id = gs.id
        AND inner_pj.event_type = 'player_join'
        AND json_extract(inner_pj.payload, '$.isHero') = 1
        AND NOT EXISTS (
            SELECT 1 FROM session_event AS pl
            WHERE pl.session_id = gs.id
              AND pl.event_type = 'player_leave'
              AND json_extract(pl.payload, '$.isHero') = 1
              AND pl.sort_order > inner_pj.sort_order
        )
      ORDER BY inner_pj.sort_order DESC
      LIMIT 1
  );
--> statement-breakpoint

ALTER TABLE `game_session` DROP COLUMN `hero_seat_position`;
