-- Trigger: block INSERT of events into manual sessions at the DB level.
-- The API layer provides the UX guard; this is the final defence.
CREATE TRIGGER session_event_block_manual
BEFORE INSERT ON session_event
BEGIN
  SELECT RAISE(ABORT, 'manual sessions cannot have events')
  WHERE (SELECT source FROM game_session WHERE id = NEW.session_id) = 'manual';
END;
