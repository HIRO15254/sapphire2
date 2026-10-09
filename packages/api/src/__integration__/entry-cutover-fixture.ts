import type { TestD1Database } from "./test-database";

const BACKFILL_STATEMENTS = [
	`INSERT INTO entry
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
LEFT JOIN session_tournament_detail std ON std.session_id = gs.id`,
	`INSERT INTO entry_cash (entry_id, user_id, ring_game_id, ev_diff)
SELECT e.id, e.user_id, rg.id,
  CASE WHEN scd.ev_cash_out IS NOT NULL THEN CAST(ROUND(scd.ev_cash_out - scd.cash_out) AS INTEGER) END
FROM entry e
JOIN session_cash_detail scd ON scd.session_id = e.id
LEFT JOIN ring_game rg ON rg.id = scd.ring_game_id AND rg.user_id = e.user_id
WHERE e.kind = 'cash'`,
	`INSERT INTO entry_tournament (entry_id, user_id, tournament_id, placement, total_entries, before_deadline)
SELECT e.id, e.user_id, t.id,
  CASE WHEN std.before_deadline = 1 THEN NULL ELSE std.placement END,
  std.total_entries, std.before_deadline
FROM entry e
JOIN session_tournament_detail std ON std.session_id = e.id
LEFT JOIN tournament t ON t.id = std.tournament_id AND t.user_id = e.user_id
WHERE e.kind = 'tournament'`,
	`INSERT INTO play_session
  (id, user_id, entry_id, kind, seq, local_date, started_at, ended_at, break_minutes,
   status, end_state, end_stack, clock_started_at, created_at, updated_at)
SELECT gs.id, gs.user_id, e.id, e.kind, 1, e.played_on, gs.started_at,
  CASE WHEN gs.ended_at >= gs.started_at OR gs.started_at IS NULL THEN gs.ended_at END,
  COALESCE(gs.break_minutes, 0),
  CASE gs.status WHEN 'completed' THEN 'ended' WHEN 'paused' THEN 'paused' ELSE 'active' END,
  CASE WHEN gs.status <> 'completed' THEN NULL
       WHEN e.kind = 'cash' THEN 'cashed_out'
       WHEN std.before_deadline = 1 AND e.source = 'live' THEN 'busted'
       WHEN std.before_deadline = 1 THEN 'finished'
       WHEN std.placement = 1 THEN 'finished'
       WHEN e.source = 'live' OR std.placement > 1 THEN 'busted'
       ELSE 'finished' END,
  CASE WHEN e.kind = 'cash' AND gs.status = 'completed' THEN scd.cash_out END,
  std.timer_started_at, gs.created_at, gs.updated_at
FROM game_session gs
JOIN entry e ON e.id = gs.id AND e.user_id = gs.user_id
LEFT JOIN session_cash_detail scd ON scd.session_id = gs.id
LEFT JOIN session_tournament_detail std ON std.session_id = gs.id`,
	`INSERT INTO play_event
  (id, user_id, entry_id, play_session_id, type, schema_version, occurred_at, sort_order, payload, created_at, updated_at)
SELECT se.id, gs.user_id, se.session_id, se.session_id, se.event_type, 1, se.occurred_at, se.sort_order,
  CASE WHEN json_valid(se.payload) THEN se.payload ELSE '{}' END, se.created_at, se.updated_at
FROM session_event se
JOIN game_session gs ON gs.id = se.session_id`,
];

const RETIRE_STATEMENTS = [
	"UPDATE game_session SET status = 'completed', session_date = 0, started_at = NULL, ended_at = NULL, break_minutes = NULL, memo = NULL, room_id = NULL, currency_id = NULL",
	"UPDATE session_cash_detail SET ring_game_id = NULL, ev_cash_out = NULL",
	"UPDATE session_tournament_detail SET tournament_id = NULL, placement = NULL, total_entries = NULL, before_deadline = NULL, timer_started_at = NULL",
	"DELETE FROM session_event",
];

export async function backfillEntryTables(d1: TestD1Database): Promise<void> {
	await d1.batch(BACKFILL_STATEMENTS.map((statement) => d1.prepare(statement)));
}

export async function retireMovedLegacyColumns(
	d1: TestD1Database
): Promise<void> {
	await d1.batch(RETIRE_STATEMENTS.map((statement) => d1.prepare(statement)));
}
