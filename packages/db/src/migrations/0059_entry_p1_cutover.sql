INSERT INTO entry
  (id, user_id, kind, source, status, room_id, asset_id, title, played_on, memo, created_at, updated_at)
SELECT gs.id, gs.user_id,
  CASE gs.kind WHEN 'cash_game' THEN 'cash' ELSE 'tournament' END,
  gs.source,
  CASE gs.status WHEN 'completed' THEN 'settled' ELSE 'open' END,
  r.id, c.id,
  CASE WHEN scd.ring_game_id IS NULL AND std.tournament_id IS NULL
       THEN COALESCE(scd.rule_name, std.rule_name) END,
  CASE gs.source
    WHEN 'live' THEN strftime('%Y-%m-%d', COALESCE(gs.started_at, gs.session_date), 'unixepoch', '+9 hours')
    ELSE strftime('%Y-%m-%d', gs.session_date, 'unixepoch') END,
  gs.memo, gs.created_at, gs.updated_at
FROM game_session gs
LEFT JOIN room r ON r.id = gs.room_id AND r.user_id = gs.user_id
LEFT JOIN currency c ON c.id = gs.currency_id AND c.user_id = gs.user_id
LEFT JOIN session_cash_detail scd ON scd.session_id = gs.id
LEFT JOIN session_tournament_detail std ON std.session_id = gs.id;
--> statement-breakpoint
INSERT INTO entry_cash (entry_id, user_id, ring_game_id, ev_diff)
SELECT e.id, e.user_id, rg.id,
  CASE WHEN e.status = 'settled' AND scd.ev_cash_out IS NOT NULL
       THEN CAST(floor(scd.ev_cash_out - scd.cash_out + 0.5) AS INTEGER) END
FROM entry e
LEFT JOIN session_cash_detail scd ON scd.session_id = e.id
LEFT JOIN ring_game rg ON rg.id = scd.ring_game_id AND rg.user_id = e.user_id
WHERE e.kind = 'cash';
--> statement-breakpoint
INSERT INTO entry_tournament (entry_id, user_id, tournament_id, placement, total_entries, before_deadline)
SELECT e.id, e.user_id, t.id,
  CASE WHEN std.before_deadline = 1 THEN NULL
       WHEN std.placement >= 1 AND (std.total_entries IS NULL OR std.total_entries < 1 OR std.placement <= std.total_entries)
       THEN std.placement END,
  CASE WHEN std.total_entries >= 1 THEN std.total_entries END,
  CASE WHEN std.before_deadline = 1 THEN 1 END
FROM entry e
LEFT JOIN session_tournament_detail std ON std.session_id = e.id
LEFT JOIN tournament t ON t.id = std.tournament_id AND t.user_id = e.user_id
WHERE e.kind = 'tournament';
--> statement-breakpoint
INSERT INTO play_session
  (id, user_id, entry_id, kind, seq, local_date, started_at, ended_at, break_minutes,
   status, end_state, end_stack, clock_started_at, created_at, updated_at)
SELECT gs.id, gs.user_id, e.id, e.kind, 1, e.played_on, gs.started_at,
  CASE WHEN gs.ended_at >= gs.started_at OR gs.started_at IS NULL THEN gs.ended_at END,
  CASE WHEN gs.break_minutes >= 0 THEN gs.break_minutes ELSE 0 END,
  CASE gs.status WHEN 'completed' THEN 'ended' WHEN 'paused' THEN 'paused' ELSE 'active' END,
  CASE WHEN gs.status <> 'completed' THEN NULL
       WHEN e.kind = 'cash' THEN 'cashed_out'
       WHEN et.placement = 1 THEN 'finished'
       WHEN e.source = 'live' OR et.placement > 1 THEN 'busted'
       ELSE 'finished' END,
  CASE WHEN e.kind = 'cash' AND gs.status = 'completed' AND scd.cash_out >= 0 THEN scd.cash_out END,
  std.timer_started_at, gs.created_at, gs.updated_at
FROM game_session gs
JOIN entry e ON e.id = gs.id AND e.user_id = gs.user_id
LEFT JOIN entry_tournament et ON et.entry_id = e.id AND et.user_id = e.user_id
LEFT JOIN session_cash_detail scd ON scd.session_id = gs.id
LEFT JOIN session_tournament_detail std ON std.session_id = gs.id;
--> statement-breakpoint
INSERT INTO play_event
  (id, user_id, entry_id, play_session_id, type, schema_version, occurred_at, sort_order, payload, created_at, updated_at)
SELECT se.id, gs.user_id, se.session_id, se.session_id, se.event_type, 1, se.occurred_at, se.sort_order,
  CASE WHEN json_valid(se.payload) THEN se.payload ELSE '{}' END, se.created_at, se.updated_at
FROM session_event se
JOIN game_session gs ON gs.id = se.session_id;
--> statement-breakpoint
CREATE TABLE _migration_check (v INTEGER NOT NULL);
--> statement-breakpoint
INSERT INTO _migration_check (v)
SELECT NULL WHERE EXISTS (
  SELECT 1 FROM game_session gs LEFT JOIN entry e ON e.id = gs.id WHERE e.id IS NULL
) OR EXISTS (
  SELECT 1 FROM entry e LEFT JOIN game_session gs ON gs.id = e.id WHERE gs.id IS NULL
) OR EXISTS (
  SELECT 1 FROM game_session gs LEFT JOIN play_session ps ON ps.id = gs.id AND ps.seq = 1 WHERE ps.id IS NULL
) OR EXISTS (
  SELECT 1 FROM play_session ps LEFT JOIN game_session gs ON gs.id = ps.id WHERE ps.seq = 1 AND gs.id IS NULL
) OR EXISTS (
  SELECT 1 FROM session_event se LEFT JOIN play_event pe ON pe.id = se.id WHERE pe.id IS NULL
) OR EXISTS (
  SELECT 1 FROM play_event pe LEFT JOIN session_event se ON se.id = pe.id WHERE se.id IS NULL
) OR EXISTS (
  SELECT 1 FROM game_session gs JOIN play_session ps ON ps.id = gs.id AND ps.seq = 1
  WHERE ps.started_at IS NOT gs.started_at
     OR ps.ended_at IS NOT (CASE WHEN gs.ended_at >= gs.started_at OR gs.started_at IS NULL THEN gs.ended_at END)
     OR ps.break_minutes IS NOT (CASE WHEN gs.break_minutes >= 0 THEN gs.break_minutes ELSE 0 END)
     OR ps.status IS NOT (CASE gs.status WHEN 'completed' THEN 'ended' WHEN 'paused' THEN 'paused' ELSE 'active' END)
);
--> statement-breakpoint
DROP TABLE _migration_check;
