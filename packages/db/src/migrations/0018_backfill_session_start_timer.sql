-- Backfill timerStartedAt onto session_start event payloads for tournaments
-- that already have a start time recorded on live_tournament_session.
UPDATE session_event
SET
    payload = json_set(
        COALESCE(NULLIF(session_event.payload, ''), '{}'),
        '$.timerStartedAt',
        (
            SELECT lts.timer_started_at
            FROM live_tournament_session lts
            WHERE lts.id = session_event.live_tournament_session_id
        )
    ),
    updated_at = unixepoch()
WHERE session_event.event_type = 'session_start'
    AND session_event.live_tournament_session_id IS NOT NULL
    AND EXISTS (
        SELECT 1
        FROM live_tournament_session lts
        WHERE lts.id = session_event.live_tournament_session_id
            AND lts.timer_started_at IS NOT NULL
    );
