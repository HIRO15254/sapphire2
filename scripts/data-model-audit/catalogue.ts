import { LEDGER_ENTRY_ROLES_BY_KIND } from "../../packages/db/src/constants/ledger";

export const AUDIT_IDS = [
	"FK",
	"A-3",
	"A-4",
	"A-5",
	"A-6",
	"A-8",
	"A-9",
	"A-10",
	"A-11",
	"A-12",
	"A-13",
	"A-14",
	"A-15",
	"A-16",
] as const;
export type AuditId = (typeof AUDIT_IDS)[number];

export const TASK = {
	B01: "B01 (SA2-385)",
	B07: "B07 (SA2-392)",
	B08: "B08 (SA2-393)",
	B13: "B13 (SA2-398)",
	B18: "B18 (SA2-404)",
	B25: "B25 (SA2-418)",
} as const;

export const B01_MIGRATION = "0059_v2_final_empty_schema.sql";
export const B06_MIGRATION = "0061_entry_p1_cutover.sql";
export const B07_MIGRATION = "0067_ring_game_rule_versions.sql";
export const B10_MIGRATION = "0062_hand_count_cutover.sql";
export const B09_MIGRATION = "0063_ledger_cutover.sql";
export const B12_MIGRATION = "0064_open_live_cash_ev.sql";
export const B08_MIGRATION = "0066_tournament_final.sql";
export const B13_MIGRATION = "0069_entry_rule_versions.sql";
export const B15_MIGRATION = "0070_self_player_event_v2.sql";
export const B16_MIGRATION = "0071_entry_tag_tables.sql";
export const B18_MIGRATION = "0072_tag_tables.sql";
export const B23_MIGRATION = "0074_stand_in_cleanup.sql";

export type Activation =
	| { state: "active"; since: string | null }
	| { state: "pending"; enabledBy: string };

export type ReplayPart =
	| "a6-core"
	| "a6-lines"
	| "a6-open-ev"
	| "a15-payload-schema";

interface CheckBase {
	activation: Activation;
	audit: AuditId;
	deletedBy?: string;
	part: string;
	reportOnly?: boolean;
	tables: readonly string[];
}

export interface SqlCheck extends CheckBase {
	kind: "sql";
	sql: (cutoverAt: number) => string;
}

export interface ReplayCheck extends CheckBase {
	kind: "replay";
	replay: ReplayPart;
}

export interface DeferredCheck extends CheckBase {
	activation: { state: "pending"; enabledBy: string };
	kind: "deferred";
}

export type Check = SqlCheck | ReplayCheck | DeferredCheck;

const SINCE_B01: Activation = { state: "active", since: B01_MIGRATION };
const SINCE_B06: Activation = { state: "active", since: B06_MIGRATION };
const SINCE_B07: Activation = { state: "active", since: B07_MIGRATION };
const SINCE_B10: Activation = { state: "active", since: B10_MIGRATION };
const SINCE_B09: Activation = { state: "active", since: B09_MIGRATION };
const SINCE_B12: Activation = { state: "active", since: B12_MIGRATION };
const SINCE_B08: Activation = { state: "active", since: B08_MIGRATION };
const SINCE_B13: Activation = { state: "active", since: B13_MIGRATION };
const SINCE_B15: Activation = { state: "active", since: B15_MIGRATION };
const SINCE_B16: Activation = { state: "active", since: B16_MIGRATION };
const SINCE_B18: Activation = { state: "active", since: B18_MIGRATION };
const SINCE_B23: Activation = { state: "active", since: B23_MIGRATION };

function sqlList(values: readonly string[]): string {
	return values.map((value) => `'${value}'`).join(",");
}

const contiguousFromOne = (table: string, group: string, ordinal: string) =>
	`SELECT ${group} AS id, min(${ordinal}) AS first_ordinal, max(${ordinal}) AS last_ordinal, count(*) AS row_count FROM ${table} GROUP BY ${group} HAVING min(${ordinal}) <> 1 OR max(${ordinal}) <> count(*)`;

const UNASSIGNED = (user: string) => `'unassigned:' || ${user}`;

const mappedRoom = (user: string, room: string) =>
	`EXISTS (SELECT 1 FROM room rm WHERE rm.id = ${room} AND rm.user_id = ${user} AND trim(rm.name) <> ''
AND lower(trim(rm.name)) IS NOT (SELECT lower(trim(u.name)) FROM asset u WHERE u.id = ${UNASSIGNED(user)}))`;

export const CHECKS: readonly Check[] = [
	{
		audit: "FK",
		part: "PRAGMA foreign_key_check",
		kind: "sql",
		activation: { state: "active", since: null },
		tables: [],
		sql: () => "PRAGMA foreign_key_check",
	},
	{
		audit: "A-3",
		part: "game_session/session_event ids and declared source match entry, seq-1 play_session and play_event",
		kind: "sql",
		activation: SINCE_B06,
		deletedBy: TASK.B25,
		tables: [
			"game_session",
			"session_event",
			"entry",
			"play_session",
			"play_event",
			"player",
			"d1_migrations",
		],
		sql: (
			cutoverAt
		) => `SELECT 'game_session' AS source, gs.id AS id FROM game_session gs
LEFT JOIN entry e ON e.id = gs.id AND e.user_id = gs.user_id
LEFT JOIN play_session p ON p.id = gs.id AND p.entry_id = gs.id AND p.user_id = gs.user_id AND p.seq = 1
WHERE e.id IS NULL OR p.id IS NULL
UNION ALL
SELECT 'entry', e.id FROM entry e
WHERE e.created_at <= ${cutoverAt}
AND NOT EXISTS (SELECT 1 FROM game_session gs WHERE gs.id = e.id AND gs.user_id = e.user_id)
UNION ALL
SELECT 'session_event', se.id FROM session_event se
JOIN game_session gs ON gs.id = se.session_id
WHERE (se.event_type <> 'purchase_chips' OR (CASE WHEN json_valid(se.payload)
THEN json_type(se.payload, '$.sessionChipPurchaseId') = 'text' AND json_extract(se.payload, '$.sessionChipPurchaseId') <> '' END) IS 1)
AND NOT (se.event_type IN ('player_join', 'player_leave')
AND EXISTS (SELECT 1 FROM d1_migrations WHERE name = '${B15_MIGRATION}')
AND CASE WHEN json_valid(se.payload) THEN
  json_extract(se.payload, '$.isHero') IS NOT 1
  AND NOT EXISTS (SELECT 1 FROM player p WHERE p.id = json_extract(se.payload, '$.playerId') AND p.user_id = gs.user_id)
ELSE 1 END)
AND NOT EXISTS (SELECT 1 FROM play_event pe WHERE pe.id = se.id AND pe.entry_id = gs.id AND pe.user_id = gs.user_id)
UNION ALL
SELECT 'play_event', pe.id FROM play_event pe
WHERE pe.created_at <= ${cutoverAt}
AND NOT EXISTS (SELECT 1 FROM session_event se JOIN game_session gs ON gs.id = se.session_id WHERE se.id = pe.id AND gs.id = pe.entry_id AND gs.user_id = pe.user_id)
UNION ALL
SELECT 'entry source', e.id FROM entry e
JOIN game_session gs ON gs.id = e.id AND gs.user_id = e.user_id
WHERE e.updated_at <= ${cutoverAt}
AND e.source IS NOT (CASE WHEN gs.source = 'live' OR EXISTS (SELECT 1 FROM session_event se WHERE se.session_id = gs.id) THEN 'live' ELSE gs.source END)`,
	},
	{
		audit: "A-4",
		part: "normalized source start/end/break/status equal seq-1 play_session; a live day folds its session_event rows",
		kind: "sql",
		activation: SINCE_B06,
		deletedBy: TASK.B25,
		tables: ["game_session", "session_event", "play_session"],
		sql: (cutoverAt) => `WITH state_event AS (
SELECT session_id, event_type, occurred_at,
row_number() OVER (PARTITION BY session_id ORDER BY occurred_at, sort_order, id) AS n,
count(*) OVER (PARTITION BY session_id) AS events
FROM session_event WHERE event_type IN ('session_start', 'session_pause', 'session_resume', 'session_end')
), fold_step AS (
SELECT session_id, event_type, occurred_at, n, events,
max(CASE WHEN event_type = 'session_pause' THEN n END) OVER earlier AS pause_n,
max(CASE WHEN event_type = 'session_pause' THEN occurred_at END) OVER earlier AS paused_at,
max(CASE WHEN event_type = 'session_resume' THEN n END) OVER earlier AS resume_n
FROM state_event
WINDOW earlier AS (PARTITION BY session_id ORDER BY n ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
), fold AS (
SELECT session_id, min(CASE WHEN event_type = 'session_start' THEN occurred_at END) AS started_at,
max(CASE WHEN n = events AND event_type = 'session_end' THEN occurred_at END) AS ended_at,
CAST(sum(CASE WHEN pause_n > COALESCE(resume_n, 0)
AND (event_type = 'session_resume' OR (n = events AND event_type = 'session_end'))
THEN occurred_at - paused_at ELSE 0 END) / 60 AS INTEGER) AS break_minutes
FROM fold_step GROUP BY session_id
), legacy AS (
SELECT gs.id, gs.user_id, gs.status, gs.started_at, gs.ended_at, gs.break_minutes,
gs.source = 'live' OR EXISTS (SELECT 1 FROM session_event se WHERE se.session_id = gs.id) AS live
FROM game_session gs
)
SELECT p.id AS id FROM legacy s
JOIN play_session p ON p.id = s.id AND p.user_id = s.user_id AND p.seq = 1
LEFT JOIN fold f ON f.session_id = s.id
WHERE p.updated_at <= ${cutoverAt} AND (
p.started_at IS NOT (CASE WHEN s.live THEN f.started_at ELSE s.started_at END)
OR p.ended_at IS NOT (CASE WHEN s.live THEN f.ended_at WHEN s.ended_at >= s.started_at OR s.started_at IS NULL THEN s.ended_at END)
OR p.break_minutes IS NOT (CASE WHEN s.live THEN COALESCE(f.break_minutes, 0) WHEN s.break_minutes >= 0 THEN s.break_minutes ELSE 0 END)
OR p.status IS NOT (CASE s.status WHEN 'completed' THEN 'ended' WHEN 'paused' THEN 'paused' ELSE 'active' END))`,
	},
	{
		audit: "A-5",
		part: "settled entry real-line P/L equals the legacy formula",
		kind: "sql",
		activation: SINCE_B09,
		deletedBy: TASK.B25,
		tables: [
			"game_session",
			"session_cash_detail",
			"session_tournament_detail",
			"session_chip_purchase",
			"session_chip_purchase_result",
			"entry",
			"ledger_line",
		],
		sql: (cutoverAt) => `WITH expected AS (
SELECT gs.id AS id, gs.user_id AS user_id,
CASE gs.kind WHEN 'cash_game'
THEN COALESCE(scd.cash_out, 0) + COALESCE(scd.chip_remove_total, 0) - COALESCE(scd.buy_in, 0)
ELSE COALESCE(std.prize_money, 0) + COALESCE(std.bounty_prizes, 0) - COALESCE(std.tournament_buy_in, 0) - COALESCE(std.entry_fee, 0)
- COALESCE((SELECT sum(cp.cost * COALESCE(r.count, 0)) FROM session_chip_purchase cp
LEFT JOIN session_chip_purchase_result r ON r.session_chip_purchase_id = cp.id
WHERE cp.session_id = gs.id), 0)
END AS pl
FROM game_session gs
LEFT JOIN session_cash_detail scd ON scd.session_id = gs.id
LEFT JOIN session_tournament_detail std ON std.session_id = gs.id)
SELECT e.id AS id, x.pl AS expected, COALESCE(sum(l.quantity), 0) AS actual
FROM entry e
JOIN expected x ON x.id = e.id AND x.user_id = e.user_id
LEFT JOIN ledger_line l ON l.entry_id = e.id AND l.user_id = e.user_id AND l.effect = 'real'
WHERE e.status = 'settled'
AND NOT EXISTS (SELECT 1 FROM ledger_line m WHERE m.entry_id = e.id AND m.updated_at > ${cutoverAt})
GROUP BY e.id, x.pl
HAVING COALESCE(sum(l.quantity), 0) <> x.pl`,
	},
	{
		audit: "A-6",
		part: "projectEntry replay: entry status/played_on, every play_session, kind detail, Hero seat fold",
		kind: "replay",
		replay: "a6-core",
		activation: SINCE_B06,
		tables: [
			"entry",
			"entry_cash",
			"entry_tournament",
			"play_session",
			"play_event",
			"hand",
			"hand_seat",
			"player",
		],
	},
	{
		audit: "A-6",
		part: "projectEntry replay: projected ledger lines",
		kind: "replay",
		replay: "a6-lines",
		activation: SINCE_B09,
		tables: ["ledger_line"],
	},
	{
		audit: "A-6",
		part: "projectEntry replay: open cash entry EV",
		kind: "replay",
		replay: "a6-open-ev",
		activation: SINCE_B12,
		tables: ["entry_cash"],
	},
	{
		audit: "A-8",
		part: "every entry has a day and played_on = MIN(local_date)",
		kind: "sql",
		activation: SINCE_B06,
		tables: ["entry", "play_session"],
		sql: () => `SELECT e.id AS id, e.played_on AS played_on, min(p.local_date) AS first_local_date
FROM entry e LEFT JOIN play_session p ON p.entry_id = e.id AND p.user_id = e.user_id
GROUP BY e.id, e.played_on
HAVING count(p.id) = 0 OR e.played_on <> min(p.local_date)`,
	},
	{
		audit: "A-9",
		part: "entry settled iff every day ended and the highest seq settles",
		kind: "sql",
		activation: SINCE_B06,
		tables: ["entry", "play_session"],
		sql: () => `SELECT e.id AS id, e.source AS source, e.status AS status FROM entry e WHERE
(e.status = 'settled') <> (
NOT EXISTS (SELECT 1 FROM play_session p WHERE p.entry_id = e.id AND p.user_id = e.user_id AND p.status <> 'ended')
AND EXISTS (SELECT 1 FROM play_session p WHERE p.entry_id = e.id AND p.user_id = e.user_id
AND p.seq = (SELECT max(q.seq) FROM play_session q WHERE q.entry_id = e.id AND q.user_id = e.user_id)
AND p.end_state IN ('busted', 'cashed_out', 'finished')))`,
	},
	{
		audit: "A-10",
		part: "seq-1 hand count and last button equal source hand_count/dealer_seat",
		kind: "sql",
		activation: SINCE_B10,
		deletedBy: TASK.B25,
		tables: ["game_session", "play_session", "hand"],
		sql: (cutoverAt) => `SELECT p.id AS id,
(SELECT count(*) FROM hand h WHERE h.play_session_id = p.id AND h.user_id = p.user_id) AS hands,
gs.hand_count AS hand_count, gs.dealer_seat AS dealer_seat
FROM game_session gs
JOIN play_session p ON p.id = gs.id AND p.user_id = gs.user_id AND p.seq = 1
WHERE NOT EXISTS (SELECT 1 FROM hand h WHERE h.play_session_id = p.id AND h.user_id = p.user_id AND (h.created_at > ${cutoverAt} OR h.updated_at > ${cutoverAt}))
AND (
(SELECT count(*) FROM hand h WHERE h.play_session_id = p.id AND h.user_id = p.user_id)
<> (CASE WHEN gs.hand_count > 0 THEN gs.hand_count ELSE 0 END)
OR (gs.hand_count > 0 AND (SELECT h.button_seat FROM hand h WHERE h.play_session_id = p.id AND h.user_id = p.user_id ORDER BY h.hand_no DESC LIMIT 1) IS NOT (CASE WHEN gs.dealer_seat BETWEEN 0 AND 9 THEN gs.dealer_seat END)))`,
	},
	{
		audit: "A-11",
		part: "per-asset balance vs legacy currency_transaction (historical drift, report only)",
		kind: "sql",
		activation: SINCE_B09,
		deletedBy: TASK.B25,
		reportOnly: true,
		tables: ["currency_transaction", "asset", "ledger_line", "entry"],
		sql: () => `WITH legacy AS (
SELECT a.user_id AS user_id, ct.currency_id AS asset_id, sum(ct.amount) AS amount
FROM currency_transaction ct JOIN asset a ON a.id = ct.currency_id
GROUP BY a.user_id, ct.currency_id),
ledger AS (
SELECT l.user_id AS user_id, l.asset_id AS asset_id, sum(l.quantity) AS amount
FROM ledger_line l LEFT JOIN entry e ON e.id = l.entry_id AND e.user_id = l.user_id
WHERE l.effect = 'real' AND (l.entry_id IS NULL OR e.status = 'settled')
GROUP BY l.user_id, l.asset_id),
keys AS (SELECT user_id, asset_id FROM legacy UNION SELECT user_id, asset_id FROM ledger)
SELECT k.user_id AS user_id, k.asset_id AS asset_id, COALESCE(g.amount, 0) AS legacy, COALESCE(n.amount, 0) AS ledger
FROM keys k
LEFT JOIN legacy g ON g.user_id = k.user_id AND g.asset_id = k.asset_id
LEFT JOIN ledger n ON n.user_id = k.user_id AND n.asset_id = k.asset_id
WHERE COALESCE(g.amount, 0) <> COALESCE(n.amount, 0)`,
	},
	{
		audit: "A-12",
		part: "mapped/deduplicated session tag links equal entry tag links",
		kind: "sql",
		activation: SINCE_B16,
		deletedBy: TASK.B25,
		tables: [
			"game_session",
			"session_tag",
			"session_to_session_tag",
			"entry",
			"entry_tag_link",
		],
		sql: (cutoverAt) => `WITH historical AS (
SELECT e.id, e.user_id FROM entry e
JOIN game_session gs ON gs.id = e.id AND gs.user_id = e.user_id
WHERE e.created_at <= ${cutoverAt} AND e.updated_at <= ${cutoverAt}
),
expected AS (
SELECT DISTINCT h.id AS entry_id, h.user_id, (
SELECT representative.id FROM session_tag representative
WHERE representative.user_id = t.user_id AND lower(trim(representative.name)) = lower(trim(t.name))
ORDER BY representative.created_at, representative.id LIMIT 1
) AS tag_id
FROM historical h
JOIN session_to_session_tag l ON l.session_id = h.id
JOIN session_tag t ON t.id = l.session_tag_id AND t.user_id = h.user_id
),
actual AS (
SELECT l.entry_id, l.user_id, l.tag_id FROM entry_tag_link l
JOIN historical h ON h.id = l.entry_id AND h.user_id = l.user_id
)
SELECT 'missing' AS problem, entry_id, user_id, tag_id FROM (SELECT * FROM expected EXCEPT SELECT * FROM actual)
UNION ALL
SELECT 'unexpected', entry_id, user_id, tag_id FROM (SELECT * FROM actual EXCEPT SELECT * FROM expected)`,
	},
	{
		audit: "A-12",
		part: "mapped/deduplicated tournament tag links equal the new set",
		kind: "sql",
		activation: SINCE_B18,
		deletedBy: TASK.B25,
		tables: ["tournament", "tournament_tag", "tournament_tag_link"],
		sql: (cutoverAt) => `WITH historical AS (
SELECT id, user_id FROM tournament
WHERE created_at <= ${cutoverAt} AND updated_at <= ${cutoverAt}
), expected AS (
SELECT DISTINCT h.id AS tournament_id, h.user_id,
'tt:' || h.user_id || ':' || hex(lower(trim(t.name))) AS tag_id
FROM historical h JOIN tournament_tag t ON t.tournament_id = h.id
), actual AS (
SELECT l.tournament_id, l.user_id, l.tag_id FROM tournament_tag_link l
JOIN historical h ON h.id = l.tournament_id AND h.user_id = l.user_id
)
SELECT 'missing' AS problem, tournament_id, user_id, tag_id FROM (SELECT * FROM expected EXCEPT SELECT * FROM actual)
UNION ALL
SELECT 'unexpected', tournament_id, user_id, tag_id FROM (SELECT * FROM actual EXCEPT SELECT * FROM expected)`,
	},
	{
		audit: "A-12",
		part: "mapped/deduplicated player tag links equal the new set",
		kind: "sql",
		activation: SINCE_B18,
		deletedBy: TASK.B25,
		tables: ["player", "player_tag", "player_to_player_tag", "player_tag_link"],
		sql: (cutoverAt) => `WITH historical AS (
SELECT id, user_id FROM player
WHERE created_at <= ${cutoverAt} AND updated_at <= ${cutoverAt}
), expected AS (
SELECT DISTINCT h.id AS player_id, h.user_id, (
SELECT representative.id FROM player_tag representative
WHERE representative.user_id = t.user_id AND lower(trim(representative.name)) = lower(trim(t.name))
ORDER BY representative.created_at, representative.id LIMIT 1
) AS tag_id
FROM historical h
JOIN player_to_player_tag l ON l.player_id = h.id
JOIN player_tag t ON t.id = l.player_tag_id AND t.user_id = h.user_id
), actual AS (
SELECT l.player_id, l.user_id, l.tag_id FROM player_tag_link l
JOIN historical h ON h.id = l.player_id AND h.user_id = l.user_id
)
SELECT 'missing' AS problem, player_id, user_id, tag_id FROM (SELECT * FROM expected EXCEPT SELECT * FROM actual)
UNION ALL
SELECT 'unexpected', player_id, user_id, tag_id FROM (SELECT * FROM actual EXCEPT SELECT * FROM expected)`,
	},
	{
		audit: "A-13",
		part: "ring_game current rule belongs to that master",
		kind: "sql",
		activation: SINCE_B07,
		tables: ["ring_game", "cash_rule"],
		sql: () => `SELECT r.id AS id FROM ring_game r
LEFT JOIN cash_rule v ON v.id = r.current_rule_id AND v.user_id = r.user_id
WHERE v.id IS NULL OR v.ring_game_id IS NOT r.id`,
	},
	{
		audit: "A-13",
		part: "tournament current rule belongs to that master",
		kind: "sql",
		activation: SINCE_B08,
		tables: ["tournament", "tournament_rule"],
		sql: () => `SELECT t.id AS id FROM tournament t
LEFT JOIN tournament_rule v ON v.id = t.current_rule_id AND v.user_id = t.user_id
WHERE v.id IS NULL OR v.tournament_id IS NOT t.id`,
	},
	{
		audit: "A-13",
		part: "tournament master version content equals its legacy levels and chip purchases",
		kind: "sql",
		activation: SINCE_B08,
		deletedBy: TASK.B25,
		tables: [
			"tournament",
			"tournament_rule",
			"blind_level",
			"tournament_chip_purchase",
			"tournament_rule_level",
			"tournament_rule_level_stake",
			"tournament_rule_price",
		],
		sql: () => `WITH migrated AS (
SELECT r.id, r.user_id, r.tournament_id FROM tournament_rule r
JOIN tournament t ON t.id = r.tournament_id AND t.user_id = r.user_id
WHERE r.id = 'tr:' || t.id
), legacy_levels AS (
SELECT m.id AS rule_id, m.user_id, b.*,
ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY b.level, b.id) AS expected_ordinal
FROM migrated m JOIN blind_level b ON b.tournament_id = m.tournament_id
), expected_levels AS (
SELECT rule_id, user_id, 'trl:' || id AS id, expected_ordinal AS ordinal, level,
CASE WHEN is_break THEN 1 ELSE 0 END AS is_break,
CASE WHEN minutes >= 1 THEN minutes END AS minutes FROM legacy_levels
), actual_levels AS (
SELECT l.rule_id, l.user_id, l.id, l.ordinal, l.level, l.is_break, l.minutes
FROM tournament_rule_level l JOIN migrated m ON m.id = l.rule_id AND m.user_id = l.user_id
), expected_prices AS (
SELECT m.id AS rule_id, m.user_id, 'trp:' || p.id AS id, 'addon' AS kind, p.name AS label,
CASE WHEN p.cost < 0 THEN 0 ELSE p.cost END AS amount,
CASE WHEN p.chips >= 0 THEN p.chips END AS chips
FROM migrated m JOIN tournament_chip_purchase p ON p.tournament_id = m.tournament_id
), actual_prices AS (
SELECT p.rule_id, p.user_id, p.id, p.kind, p.label, p.amount, p.chips
FROM tournament_rule_price p JOIN migrated m ON m.id = p.rule_id AND m.user_id = p.user_id
WHERE (p.kind = 'addon' OR p.id LIKE 'trp:%') AND p.id <> 'trp:' || m.id || ':entry'
), level_diff AS (
SELECT * FROM expected_levels EXCEPT SELECT * FROM actual_levels
), extra_levels AS (
SELECT * FROM actual_levels EXCEPT SELECT * FROM expected_levels
), price_diff AS (
SELECT * FROM expected_prices EXCEPT SELECT * FROM actual_prices
), extra_prices AS (
SELECT * FROM actual_prices EXCEPT SELECT * FROM expected_prices
)
SELECT 'missing or changed level' AS problem, id FROM level_diff
UNION ALL SELECT 'extra or changed level', id FROM extra_levels
UNION ALL SELECT 'missing or changed addon', id FROM price_diff
UNION ALL SELECT 'extra or changed addon', id FROM extra_prices
UNION ALL
SELECT 'flat stakes', l.id FROM legacy_levels b
JOIN tournament_rule_level l ON l.id = 'trl:' || b.id AND l.user_id = b.user_id AND l.rule_id = b.rule_id
JOIN tournament_rule_level_stake s ON s.level_id = l.id AND s.user_id = l.user_id
WHERE NOT b.is_break AND NOT EXISTS (
  SELECT 1 FROM json_each(CASE WHEN json_valid(b.games) THEN CASE WHEN json_type(b.games) = 'array' THEN b.games ELSE '[]' END ELSE '[]' END) g,
  json_each(CASE WHEN g.type = 'object' THEN CASE WHEN json_type(g.value, '$.variants') = 'array' THEN json_extract(g.value, '$.variants') ELSE '[]' END ELSE '[]' END) v
  WHERE v.type = 'text' AND trim(v.value) <> ''
)
AND (s.blind1 IS NOT CASE WHEN b.blind1 >= 0 THEN b.blind1 END
OR s.blind2 IS NOT CASE WHEN b.blind2 >= 0 THEN b.blind2 END
OR s.blind3 IS NOT CASE WHEN b.blind3 >= 0 THEN b.blind3 END
OR s.ante IS NOT CASE WHEN b.ante >= 0 THEN b.ante END OR s.ante_type IS NOT NULL)`,
	},
	{
		audit: "A-13",
		part: "entry rule content equals staged/source snapshots",
		kind: "sql",
		activation: SINCE_B13,
		deletedBy: TASK.B25,
		tables: [
			"entry",
			"entry_cash",
			"entry_tournament",
			"cash_rule",
			"cash_rule_stake",
			"tournament_rule",
			"tournament_rule_level",
			"tournament_rule_level_stake",
			"tournament_rule_price",
			"session_cash_detail",
			"session_tournament_detail",
			"session_blind_level",
			"session_chip_purchase",
		],
		sql: (cutoverAt) => `WITH cash AS (
SELECT ec.entry_id, r.id AS rule_id, r.user_id, r.min_buy_in, r.max_buy_in, r.table_size, r.house_rules, s.session_id IS NOT NULL AS has_detail,
CASE WHEN typeof(s.min_buy_in) = 'integer' AND s.min_buy_in >= 0 THEN s.min_buy_in END AS e_min,
CASE WHEN typeof(s.max_buy_in) = 'integer' AND s.max_buy_in >= 0 AND (s.min_buy_in IS NULL OR typeof(s.min_buy_in) <> 'integer' OR s.min_buy_in < 0 OR s.max_buy_in >= s.min_buy_in) THEN s.max_buy_in END AS e_max,
CASE WHEN typeof(s.table_size) = 'integer' AND s.table_size BETWEEN 2 AND 10 THEN s.table_size END AS e_table_size,
s.house_rules AS e_house_rules,
CASE WHEN typeof(s.blind1) = 'integer' AND s.blind1 >= 0 THEN s.blind1 END AS e_blind1,
CASE WHEN typeof(s.blind2) = 'integer' AND s.blind2 >= 0 THEN s.blind2 END AS e_blind2,
CASE WHEN typeof(s.blind3) = 'integer' AND s.blind3 >= 0 THEN s.blind3 END AS e_blind3,
CASE WHEN typeof(s.ante) = 'integer' AND s.ante >= 0 THEN s.ante END AS e_ante,
CASE WHEN s.ante_type IN ('none','all','bb') THEN s.ante_type END AS e_ante_type,
NOT COALESCE(json_valid(s.mix_games) AND json_type(s.mix_games) = 'array' AND json_array_length(s.mix_games) > 0, 0) AS flat
FROM entry_cash ec JOIN entry e ON e.id = ec.entry_id AND e.user_id = ec.user_id
JOIN cash_rule r ON r.id = ec.cash_rule_id AND r.user_id = ec.user_id
LEFT JOIN session_cash_detail s ON s.session_id = ec.entry_id
WHERE e.updated_at <= ${cutoverAt} AND r.created_at <= ${cutoverAt}
), tour AS (
SELECT et.entry_id, r.id AS rule_id, r.user_id, r.starting_stack, r.table_size, r.bounty_amount, r.house_rules, s.session_id IS NOT NULL AS has_detail,
s.tournament_buy_in, s.entry_fee,
CASE WHEN s.starting_stack >= 0 THEN s.starting_stack END AS e_starting_stack,
CASE WHEN s.table_size BETWEEN 2 AND 10 THEN s.table_size END AS e_table_size,
CASE WHEN s.bounty_amount >= 0 THEN s.bounty_amount END AS e_bounty_amount, s.house_rules AS e_house_rules
FROM entry_tournament et JOIN entry e ON e.id = et.entry_id AND e.user_id = et.user_id
JOIN tournament_rule r ON r.id = et.tournament_rule_id AND r.user_id = et.user_id
LEFT JOIN session_tournament_detail s ON s.session_id = et.entry_id
WHERE e.updated_at <= ${cutoverAt} AND r.created_at <= ${cutoverAt}
), source_levels AS (
SELECT t.entry_id, t.rule_id, t.user_id, b.*, ROW_NUMBER() OVER (PARTITION BY t.entry_id ORDER BY b.level, b.id) AS ordinal
FROM tour t JOIN session_blind_level b ON b.session_id = t.entry_id
), expected_levels AS (
SELECT entry_id, ordinal, level, CASE WHEN is_break THEN 1 ELSE 0 END AS is_break, CASE WHEN minutes >= 1 THEN minutes END AS minutes
FROM source_levels
), actual_levels AS (
SELECT t.entry_id, l.ordinal, l.level, l.is_break, l.minutes
FROM tour t JOIN tournament_rule_level l ON l.rule_id = t.rule_id AND l.user_id = t.user_id
), expected_addons AS (
SELECT t.entry_id, ROW_NUMBER() OVER (PARTITION BY t.entry_id ORDER BY p.sort_order, p.id) AS position, p.name AS label,
CASE WHEN p.cost >= 0 THEN p.cost ELSE 0 END AS amount, CASE WHEN p.chips >= 0 THEN p.chips END AS chips
FROM tour t JOIN session_chip_purchase p ON p.session_id = t.entry_id
), actual_addons AS (
SELECT t.entry_id, ROW_NUMBER() OVER (PARTITION BY t.entry_id ORDER BY p.ordinal) AS position, p.label, p.amount, p.chips
FROM tour t JOIN tournament_rule_price p ON p.rule_id = t.rule_id AND p.user_id = t.user_id AND p.kind = 'addon'
), missing_levels AS (
SELECT * FROM expected_levels EXCEPT SELECT * FROM actual_levels
), extra_levels AS (
SELECT * FROM actual_levels EXCEPT SELECT * FROM expected_levels
), missing_addons AS (
SELECT * FROM expected_addons EXCEPT SELECT * FROM actual_addons
), extra_addons AS (
SELECT * FROM actual_addons EXCEPT SELECT * FROM expected_addons
)
SELECT * FROM (
SELECT 'cash scalars' AS problem, entry_id AS id FROM cash
WHERE has_detail AND (min_buy_in IS NOT e_min OR max_buy_in IS NOT e_max OR table_size IS NOT e_table_size
OR trim(replace(replace(COALESCE(house_rules, ''), char(13, 10), char(10)), char(13), char(10)), char(32, 9, 10, 11, 12, 13, 160, 65279, 8232, 8233, 12288))
IS NOT trim(replace(replace(COALESCE(e_house_rules, ''), char(13, 10), char(10)), char(13), char(10)), char(32, 9, 10, 11, 12, 13, 160, 65279, 8232, 8233, 12288)))
UNION ALL
SELECT 'cash flat stakes', c.entry_id FROM cash c JOIN cash_rule_stake st ON st.rule_id = c.rule_id AND st.user_id = c.user_id
WHERE c.has_detail AND c.flat AND (st.blind1 IS NOT c.e_blind1 OR st.blind2 IS NOT c.e_blind2 OR st.blind3 IS NOT c.e_blind3 OR st.ante IS NOT c.e_ante OR st.ante_type IS NOT c.e_ante_type)
UNION ALL
SELECT 'tournament scalars', entry_id FROM tour
WHERE has_detail AND (starting_stack IS NOT e_starting_stack OR table_size IS NOT e_table_size OR bounty_amount IS NOT e_bounty_amount
OR trim(replace(replace(COALESCE(house_rules, ''), char(13, 10), char(10)), char(13), char(10)), char(32, 9, 10, 11, 12, 13, 160, 65279, 8232, 8233, 12288))
IS NOT trim(replace(replace(COALESCE(e_house_rules, ''), char(13, 10), char(10)), char(13), char(10)), char(32, 9, 10, 11, 12, 13, 160, 65279, 8232, 8233, 12288))
OR (tournament_buy_in IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tournament_rule_price p WHERE p.rule_id = tour.rule_id AND p.user_id = tour.user_id AND p.kind = 'entry' AND p.amount = CASE WHEN tournament_buy_in >= 0 THEN tournament_buy_in ELSE 0 END))
OR (entry_fee IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tournament_rule_price p WHERE p.rule_id = tour.rule_id AND p.user_id = tour.user_id AND p.kind = 'entry' AND p.fee = CASE WHEN entry_fee >= 0 THEN entry_fee ELSE 0 END)))
)
UNION ALL
SELECT * FROM (
SELECT 'missing or changed level' AS problem, entry_id AS id FROM missing_levels
UNION ALL SELECT 'extra or changed level', entry_id FROM extra_levels
UNION ALL SELECT 'missing or changed addon', entry_id FROM missing_addons
UNION ALL SELECT 'extra or changed addon', entry_id FROM extra_addons
)
UNION ALL
SELECT 'tournament flat stakes', b.entry_id FROM source_levels b
JOIN tournament_rule_level l ON l.rule_id = b.rule_id AND l.user_id = b.user_id AND l.ordinal = b.ordinal
JOIN tournament_rule_level_stake s ON s.level_id = l.id AND s.user_id = l.user_id
WHERE NOT b.is_break AND NOT EXISTS (
  SELECT 1 FROM json_each(CASE WHEN json_valid(b.games) THEN CASE WHEN json_type(b.games) = 'array' THEN b.games ELSE '[]' END ELSE '[]' END) g,
  json_each(CASE WHEN g.type = 'object' THEN CASE WHEN json_type(g.value, '$.variants') = 'array' THEN json_extract(g.value, '$.variants') ELSE '[]' END ELSE '[]' END) v
  WHERE v.type = 'text' AND trim(v.value) <> ''
)
AND (s.blind1 IS NOT CASE WHEN b.blind1 >= 0 THEN b.blind1 END
OR s.blind2 IS NOT CASE WHEN b.blind2 >= 0 THEN b.blind2 END
OR s.blind3 IS NOT CASE WHEN b.blind3 >= 0 THEN b.blind3 END
OR s.ante IS NOT CASE WHEN b.ante >= 0 THEN b.ante END OR s.ante_type IS NOT NULL)`,
	},
	{
		audit: "A-14",
		part: "every entry has its kind detail",
		kind: "sql",
		activation: SINCE_B01,
		tables: ["entry", "entry_cash", "entry_tournament"],
		sql: () => `SELECT e.id AS id, e.kind AS kind FROM entry e
WHERE NOT EXISTS (SELECT 1 FROM entry_cash c WHERE c.entry_id = e.id AND c.user_id = e.user_id)
AND NOT EXISTS (SELECT 1 FROM entry_tournament t WHERE t.entry_id = e.id AND t.user_id = e.user_id)`,
	},
	{
		audit: "A-14",
		part: "play_session seq contiguous from 1",
		kind: "sql",
		activation: SINCE_B01,
		tables: ["play_session"],
		sql: () => contiguousFromOne("play_session", "entry_id", "seq"),
	},
	{
		audit: "A-14",
		part: "hand_no contiguous from 1",
		kind: "sql",
		activation: SINCE_B01,
		tables: ["hand"],
		sql: () => contiguousFromOne("hand", "play_session_id", "hand_no"),
	},
	{
		audit: "A-14",
		part: "hand_action seq contiguous from 1",
		kind: "sql",
		activation: SINCE_B01,
		tables: ["hand_action"],
		sql: () => contiguousFromOne("hand_action", "hand_id", "seq"),
	},
	{
		audit: "A-14",
		part: "tournament_rule_level ordinal contiguous from 1",
		kind: "sql",
		activation: SINCE_B01,
		tables: ["tournament_rule_level"],
		sql: () => contiguousFromOne("tournament_rule_level", "rule_id", "ordinal"),
	},
	{
		audit: "A-14",
		part: "manual entry days are ended",
		kind: "sql",
		activation: SINCE_B01,
		tables: ["entry", "play_session"],
		sql: () => `SELECT p.id AS id, p.status AS status FROM play_session p
JOIN entry e ON e.id = p.entry_id AND e.user_id = p.user_id
WHERE e.source = 'manual' AND p.status <> 'ended'`,
	},
	{
		audit: "A-14",
		part: "lineups have groups and groups have variants",
		kind: "sql",
		activation: SINCE_B01,
		tables: ["game_lineup", "game_lineup_group", "game_lineup_variant"],
		sql: () => `SELECT 'game_lineup' AS target, l.id AS id FROM game_lineup l
WHERE NOT EXISTS (SELECT 1 FROM game_lineup_group g WHERE g.lineup_id = l.id AND g.user_id = l.user_id)
UNION ALL
SELECT 'game_lineup_group', g.id FROM game_lineup_group g
WHERE NOT EXISTS (SELECT 1 FROM game_lineup_variant v WHERE v.lineup_group_id = g.id AND v.user_id = g.user_id)`,
	},
	{
		audit: "A-14",
		part: "exchange is two real lines of distinct assets with opposite signs",
		kind: "sql",
		activation: SINCE_B01,
		tables: ["ledger_line"],
		sql: () => `SELECT user_id, transfer_id FROM ledger_line WHERE role = 'exchange'
GROUP BY user_id, transfer_id
HAVING count(*) <> 2 OR count(DISTINCT asset_id) <> 2
OR sum(quantity > 0) <> 1 OR sum(quantity < 0) <> 1
OR count(DISTINCT occurred_at) <> 1 OR count(DISTINCT COALESCE(memo, '')) <> 1`,
	},
	{
		audit: "A-14",
		part: "entry line role matches the entry kind",
		kind: "sql",
		activation: SINCE_B01,
		tables: ["ledger_line", "entry"],
		sql: () => `SELECT l.id AS id, e.kind AS kind, l.role AS role FROM ledger_line l
JOIN entry e ON e.id = l.entry_id AND e.user_id = l.user_id
WHERE NOT ((e.kind = 'cash' AND l.role IN (${sqlList(LEDGER_ENTRY_ROLES_BY_KIND.cash)}))
OR (e.kind = 'tournament' AND l.role IN (${sqlList(LEDGER_ENTRY_ROLES_BY_KIND.tournament)})))`,
	},
	{
		audit: "A-14",
		part: "base setting asset is a currency",
		kind: "sql",
		activation: SINCE_B01,
		tables: ["user_setting", "asset"],
		sql: () => `SELECT s.user_id AS user_id, s.base_asset_id AS asset_id FROM user_setting s
JOIN asset a ON a.id = s.base_asset_id AND a.user_id = s.user_id
WHERE a.kind <> 'currency'`,
	},
	{
		audit: "A-14",
		part: "cash rule parent and entry rule keep NULL-master parity",
		kind: "sql",
		activation: SINCE_B07,
		tables: ["cash_rule", "entry_cash"],
		sql: () => `SELECT 'cash_rule' AS target, c.id AS id FROM cash_rule c
JOIN cash_rule p ON p.id = c.parent_rule_id AND p.user_id = c.user_id
WHERE p.ring_game_id IS NOT c.ring_game_id
UNION ALL
SELECT 'entry_cash', ec.entry_id FROM entry_cash ec
JOIN cash_rule r ON r.id = ec.cash_rule_id AND r.user_id = ec.user_id
WHERE r.ring_game_id IS NOT ec.ring_game_id`,
	},
	{
		audit: "A-14",
		part: "tournament rule parent and entry rule keep NULL-master parity",
		kind: "sql",
		activation: SINCE_B08,
		tables: ["tournament_rule", "entry_tournament"],
		sql: () => `SELECT 'tournament_rule' AS target, c.id AS id FROM tournament_rule c
JOIN tournament_rule p ON p.id = c.parent_rule_id AND p.user_id = c.user_id
WHERE p.tournament_id IS NOT c.tournament_id
UNION ALL
SELECT 'entry_tournament', et.entry_id FROM entry_tournament et
JOIN tournament_rule r ON r.id = et.tournament_rule_id AND r.user_id = et.user_id
WHERE r.tournament_id IS NOT et.tournament_id`,
	},
	{
		audit: "A-14",
		part: "cash rule has one stake per lineup group",
		kind: "sql",
		activation: SINCE_B07,
		tables: ["cash_rule", "game_lineup_group", "cash_rule_stake"],
		sql: () => `SELECT r.id AS rule_id, g.id AS lineup_group_id FROM cash_rule r
JOIN game_lineup_group g ON g.lineup_id = r.lineup_id AND g.user_id = r.user_id
WHERE NOT EXISTS (SELECT 1 FROM cash_rule_stake s WHERE s.rule_id = r.id AND s.lineup_group_id = g.id)`,
	},
	{
		audit: "A-14",
		part: "tournament level stakes cover every group; breaks have none",
		kind: "sql",
		activation: SINCE_B08,
		tables: [
			"tournament_rule_level",
			"game_lineup_group",
			"tournament_rule_level_stake",
		],
		sql: () => `SELECT 'missing' AS problem, l.id AS level_id, g.id AS lineup_group_id FROM tournament_rule_level l
JOIN game_lineup_group g ON g.lineup_id = l.lineup_id AND g.user_id = l.user_id
WHERE l.is_break = 0
AND NOT EXISTS (SELECT 1 FROM tournament_rule_level_stake s WHERE s.level_id = l.id AND s.lineup_group_id = g.id)
UNION ALL
SELECT 'break', l.id, s.lineup_group_id FROM tournament_rule_level l
JOIN tournament_rule_level_stake s ON s.level_id = l.id
WHERE l.is_break = 1`,
	},
	{
		audit: "A-14",
		part: "line price belongs to the entry's tournament rule or master and pays in its asset",
		kind: "sql",
		activation: SINCE_B13,
		tables: [
			"ledger_line",
			"tournament_rule_price",
			"tournament_rule",
			"entry_tournament",
		],
		sql: () => `SELECT l.id AS id, l.price_id AS price_id FROM ledger_line l
JOIN tournament_rule_price pr ON pr.id = l.price_id AND pr.user_id = l.user_id
JOIN tournament_rule r ON r.id = pr.rule_id AND r.user_id = pr.user_id
LEFT JOIN entry_tournament et ON et.entry_id = l.entry_id AND et.user_id = l.user_id
WHERE pr.asset_id <> l.asset_id OR et.entry_id IS NULL
OR NOT (pr.rule_id IS et.tournament_rule_id
OR (et.tournament_id IS NOT NULL AND r.tournament_id IS et.tournament_id))`,
	},
	{
		audit: "A-14",
		part: "self player / Hero consistency",
		kind: "sql",
		activation: SINCE_B15,
		tables: ["user", "player", "hand_seat"],
		sql: () => `SELECT u.id AS id, 'self count' AS problem FROM user u
LEFT JOIN player p ON p.user_id = u.id AND p.is_self = 1
GROUP BY u.id HAVING count(p.id) <> 1
UNION ALL
SELECT p.id, 'temporary self' FROM player p WHERE p.is_self = 1 AND p.is_temporary = 1
UNION ALL
SELECT s.hand_id, 'hero player' FROM hand_seat s
WHERE s.is_hero = 1 AND s.player_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM player p WHERE p.id = s.player_id AND p.user_id = s.user_id AND p.is_self = 1)
UNION ALL
SELECT s.hand_id, 'non-hero self' FROM hand_seat s
JOIN player p ON p.id = s.player_id AND p.user_id = s.user_id AND p.is_self = 1
WHERE s.is_hero = 0`,
	},
	{
		audit: "A-15",
		part: "stored events use schema_version 2 and parse with the payload registry",
		kind: "replay",
		replay: "a15-payload-schema",
		activation: SINCE_B15,
		tables: ["entry", "play_event"],
	},
	{
		audit: "A-15",
		part: "payload asset, price and player ids are owned",
		kind: "sql",
		activation: SINCE_B01,
		tables: ["play_event", "asset", "tournament_rule_price", "player"],
		sql: () => `SELECT pe.id AS id, 'asset' AS reference, json_extract(p.value, '$.assetId') AS ref_id
FROM play_event pe, json_each(pe.payload, '$.payments') p
WHERE json_type(pe.payload, '$.payments') = 'array'
AND NOT EXISTS (SELECT 1 FROM asset a WHERE a.id = json_extract(p.value, '$.assetId') AND a.user_id = pe.user_id)
UNION ALL
SELECT pe.id, 'price', json_extract(p.value, '$.priceId')
FROM play_event pe, json_each(pe.payload, '$.payments') p
WHERE json_type(pe.payload, '$.payments') = 'array' AND json_extract(p.value, '$.priceId') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM tournament_rule_price r WHERE r.id = json_extract(p.value, '$.priceId') AND r.user_id = pe.user_id)
UNION ALL
SELECT pe.id, 'price', json_extract(pe.payload, '$.priceId') FROM play_event pe
WHERE json_extract(pe.payload, '$.priceId') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM tournament_rule_price r WHERE r.id = json_extract(pe.payload, '$.priceId') AND r.user_id = pe.user_id)
UNION ALL
SELECT pe.id, 'player', json_extract(pe.payload, '$.playerId') FROM play_event pe
WHERE json_extract(pe.payload, '$.playerId') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM player x WHERE x.id = json_extract(pe.payload, '$.playerId') AND x.user_id = pe.user_id)`,
	},
	{
		audit: "A-15",
		part: "only all_in events link a hand",
		kind: "sql",
		activation: SINCE_B01,
		tables: ["play_event"],
		sql: () =>
			`SELECT id, type FROM play_event WHERE hand_id IS NOT NULL AND type <> 'all_in'`,
	},
	{
		audit: "A-15",
		part: "projected line price equals the same event's payment priceId",
		kind: "sql",
		activation: SINCE_B15,
		tables: ["ledger_line", "play_event"],
		sql: () => `SELECT l.id AS id, l.price_id AS line_price_id,
json_extract(pe.payload, '$.payments[' || substr(l.id, length(pe.id) + 2) || '].priceId') AS payload_price_id
FROM ledger_line l
JOIN play_event pe ON pe.id = l.source_event_id AND pe.user_id = l.user_id
WHERE l.price_id IS NOT json_extract(pe.payload, '$.payments[' || substr(l.id, length(pe.id) + 2) || '].priceId')`,
	},
	{
		audit: "A-16",
		part: "migrated entries, lines and payments in a named room left the Unassigned asset",
		kind: "sql",
		activation: SINCE_B23,
		tables: ["entry", "ledger_line", "play_event", "room", "asset"],
		sql: (cutoverAt) => `SELECT 'entry' AS source, e.id AS id FROM entry e
WHERE e.asset_id = ${UNASSIGNED("e.user_id")} AND e.created_at <= ${cutoverAt} AND e.updated_at <= ${cutoverAt}
AND ${mappedRoom("e.user_id", "e.room_id")}
UNION ALL
SELECT 'ledger_line', l.id FROM ledger_line l
JOIN entry e ON e.id = l.entry_id AND e.user_id = l.user_id
WHERE l.asset_id = ${UNASSIGNED("l.user_id")} AND l.created_at <= ${cutoverAt} AND l.updated_at <= ${cutoverAt}
AND ${mappedRoom("e.user_id", "e.room_id")}
UNION ALL
SELECT 'play_event', pe.id FROM play_event pe
JOIN entry e ON e.id = pe.entry_id AND e.user_id = pe.user_id
WHERE pe.created_at <= ${cutoverAt} AND pe.updated_at <= ${cutoverAt}
AND ${mappedRoom("e.user_id", "e.room_id")}
AND (json_extract(pe.payload, '$.assetId') = ${UNASSIGNED("pe.user_id")}
OR EXISTS (SELECT 1 FROM json_each(CASE WHEN json_type(pe.payload, '$.payments') = 'array' THEN json_extract(pe.payload, '$.payments') ELSE '[]' END) p
WHERE json_extract(p.value, '$.assetId') = ${UNASSIGNED("pe.user_id")}))`,
	},
	{
		audit: "A-16",
		part: "migrated prices and master default assets in a named room left the Unassigned asset",
		kind: "sql",
		activation: SINCE_B23,
		tables: [
			"tournament_rule_price",
			"tournament_rule",
			"tournament",
			"ring_game",
			"entry_tournament",
			"entry",
			"room",
			"asset",
		],
		sql: (
			cutoverAt
		) => `SELECT 'tournament_rule_price' AS source, p.id AS id FROM tournament_rule_price p
JOIN tournament_rule r ON r.id = p.rule_id AND r.user_id = p.user_id
LEFT JOIN tournament t ON t.id = r.tournament_id AND t.user_id = r.user_id
WHERE p.asset_id = ${UNASSIGNED("p.user_id")} AND p.created_at <= ${cutoverAt}
AND ${mappedRoom(
			"p.user_id",
			`COALESCE(t.room_id, (SELECT CASE WHEN count(DISTINCT e.room_id) = 1 THEN min(e.room_id) END
FROM entry_tournament et JOIN entry e ON e.id = et.entry_id AND e.user_id = et.user_id
WHERE et.tournament_rule_id = p.rule_id AND et.user_id = p.user_id AND e.room_id IS NOT NULL))`
		)}
UNION ALL
SELECT 'tournament', t.id FROM tournament t
WHERE t.default_asset_id = ${UNASSIGNED("t.user_id")} AND t.created_at <= ${cutoverAt} AND t.updated_at <= ${cutoverAt}
AND ${mappedRoom("t.user_id", "t.room_id")}
UNION ALL
SELECT 'ring_game', g.id FROM ring_game g
WHERE g.default_asset_id = ${UNASSIGNED("g.user_id")} AND g.created_at <= ${cutoverAt} AND g.updated_at <= ${cutoverAt}
AND ${mappedRoom("g.user_id", "g.room_id")}`,
	},
	{
		audit: "A-16",
		part: "no migrated live play_session kept a JST date for an owner outside Asia/Tokyo",
		kind: "sql",
		activation: SINCE_B23,
		tables: ["play_session", "entry", "user_setting"],
		sql: (
			cutoverAt
		) => `SELECT p.id AS id, s.time_zone AS time_zone FROM play_session p
JOIN entry e ON e.id = p.entry_id AND e.user_id = p.user_id AND e.source = 'live'
JOIN user_setting s ON s.user_id = p.user_id
WHERE s.time_zone IS NOT NULL AND s.time_zone <> 'Asia/Tokyo'
AND s.updated_at <= ${cutoverAt} AND p.created_at <= ${cutoverAt} AND p.updated_at <= ${cutoverAt}`,
	},
	{
		audit: "A-16",
		part: "no Unassigned asset or stand-in master created after the cleanup, and no stand-in carries a builtin key",
		kind: "sql",
		activation: SINCE_B23,
		tables: ["asset", "game_variant", "game_mix"],
		sql: (
			cutoverAt
		) => `SELECT 'asset' AS source, id FROM asset WHERE id LIKE 'unassigned:%' AND created_at > ${cutoverAt}
UNION ALL
SELECT 'game_variant', id FROM game_variant WHERE id LIKE 'sv:%' AND (created_at > ${cutoverAt} OR builtin_key IS NOT NULL)
UNION ALL
SELECT 'game_mix', id FROM game_mix WHERE id LIKE 'sm:%' AND (created_at > ${cutoverAt} OR builtin_key IS NOT NULL)`,
	},
];
