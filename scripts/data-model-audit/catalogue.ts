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
	B09: "B09 (SA2-394)",
	B10: "B10 (SA2-395)",
	B12: "B12 (SA2-397)",
	B13: "B13 (SA2-398)",
	B15: "B15 (SA2-401)",
	B18: "B18 (SA2-404)",
	B23: "B23 (SA2-410)",
	B25: "B25 (SA2-418)",
} as const;

export const B01_MIGRATION = "0059_v2_final_empty_schema.sql";
export const B06_MIGRATION = "0061_entry_p1_cutover.sql";

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

function pending(enabledBy: string): { state: "pending"; enabledBy: string } {
	return { state: "pending", enabledBy };
}

function sqlList(values: readonly string[]): string {
	return values.map((value) => `'${value}'`).join(",");
}

const contiguousFromOne = (table: string, group: string, ordinal: string) =>
	`SELECT ${group} AS id, min(${ordinal}) AS first_ordinal, max(${ordinal}) AS last_ordinal, count(*) AS row_count FROM ${table} GROUP BY ${group} HAVING min(${ordinal}) <> 1 OR max(${ordinal}) <> count(*)`;

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
WHERE NOT EXISTS (SELECT 1 FROM play_event pe WHERE pe.id = se.id AND pe.entry_id = gs.id AND pe.user_id = gs.user_id)
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
		part: "normalized source start/end/break/status equal seq-1 play_session",
		kind: "sql",
		activation: SINCE_B06,
		deletedBy: TASK.B25,
		tables: ["game_session", "play_session"],
		sql: (cutoverAt) => `SELECT p.id AS id FROM game_session gs
JOIN play_session p ON p.id = gs.id AND p.user_id = gs.user_id AND p.seq = 1
WHERE p.updated_at <= ${cutoverAt} AND (
p.started_at IS NOT gs.started_at
OR p.ended_at IS NOT (CASE WHEN gs.ended_at >= gs.started_at OR gs.started_at IS NULL THEN gs.ended_at END)
OR p.break_minutes IS NOT (CASE WHEN gs.break_minutes >= 0 THEN gs.break_minutes ELSE 0 END)
OR p.status IS NOT (CASE gs.status WHEN 'completed' THEN 'ended' WHEN 'paused' THEN 'paused' ELSE 'active' END))`,
	},
	{
		audit: "A-5",
		part: "settled entry real-line P/L equals the legacy formula",
		kind: "sql",
		activation: pending(TASK.B09),
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
			"session_tournament_detail",
			"tournament",
		],
	},
	{
		audit: "A-6",
		part: "projectEntry replay: projected ledger lines",
		kind: "replay",
		replay: "a6-lines",
		activation: pending(TASK.B09),
		tables: ["ledger_line"],
	},
	{
		audit: "A-6",
		part: "projectEntry replay: open cash entry EV",
		kind: "replay",
		replay: "a6-open-ev",
		activation: pending(TASK.B12),
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
		activation: pending(TASK.B10),
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
OR (gs.hand_count > 0 AND (SELECT h.button_seat FROM hand h WHERE h.play_session_id = p.id AND h.user_id = p.user_id ORDER BY h.hand_no DESC LIMIT 1) IS NOT gs.dealer_seat))`,
	},
	{
		audit: "A-11",
		part: "per-asset balance vs legacy currency_transaction (historical drift, report only)",
		kind: "sql",
		activation: pending(TASK.B09),
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
		part: "mapped/deduplicated old tag-link set equals the new set per target",
		kind: "deferred",
		activation: pending(TASK.B18),
		deletedBy: TASK.B25,
		tables: [],
	},
	{
		audit: "A-13",
		part: "ring_game current rule belongs to that master",
		kind: "sql",
		activation: pending(TASK.B07),
		tables: ["ring_game", "cash_rule"],
		sql: () => `SELECT r.id AS id FROM ring_game r
LEFT JOIN cash_rule v ON v.id = r.current_rule_id AND v.user_id = r.user_id
WHERE v.id IS NULL OR v.ring_game_id IS NOT r.id`,
	},
	{
		audit: "A-13",
		part: "tournament current rule belongs to that master",
		kind: "sql",
		activation: pending(TASK.B08),
		tables: ["tournament", "tournament_rule"],
		sql: () => `SELECT t.id AS id FROM tournament t
LEFT JOIN tournament_rule v ON v.id = t.current_rule_id AND v.user_id = t.user_id
WHERE v.id IS NULL OR v.tournament_id IS NOT t.id`,
	},
	{
		audit: "A-13",
		part: "master and entry rule content equals staged/source snapshots",
		kind: "deferred",
		activation: pending(`${TASK.B07}, ${TASK.B08}, ${TASK.B13}`),
		deletedBy: TASK.B25,
		tables: [],
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
		activation: pending(TASK.B07),
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
		activation: pending(TASK.B08),
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
		activation: pending(TASK.B07),
		tables: ["cash_rule", "game_lineup_group", "cash_rule_stake"],
		sql: () => `SELECT r.id AS rule_id, g.id AS lineup_group_id FROM cash_rule r
JOIN game_lineup_group g ON g.lineup_id = r.lineup_id AND g.user_id = r.user_id
WHERE NOT EXISTS (SELECT 1 FROM cash_rule_stake s WHERE s.rule_id = r.id AND s.lineup_group_id = g.id)`,
	},
	{
		audit: "A-14",
		part: "tournament level stakes cover every group; breaks have none",
		kind: "sql",
		activation: pending(TASK.B08),
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
		activation: pending(TASK.B13),
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
		kind: "deferred",
		activation: pending(TASK.B15),
		tables: [],
	},
	{
		audit: "A-15",
		part: "stored events use a supported schema_version and parse with the payload registry",
		kind: "replay",
		replay: "a15-payload-schema",
		activation: SINCE_B01,
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
		activation: SINCE_B01,
		tables: ["ledger_line", "play_event"],
		sql: () => `SELECT l.id AS id, l.price_id AS line_price_id,
json_extract(pe.payload, '$.payments[' || substr(l.id, length(pe.id) + 2) || '].priceId') AS payload_price_id
FROM ledger_line l
JOIN play_event pe ON pe.id = l.source_event_id AND pe.user_id = l.user_id
WHERE pe.schema_version = 2
AND l.price_id IS NOT json_extract(pe.payload, '$.payments[' || substr(l.id, length(pe.id) + 2) || '].priceId')`,
	},
	{
		audit: "A-16",
		part: "B23 cleanup mappings, recomputed local dates and no seed placeholder",
		kind: "deferred",
		activation: pending(TASK.B23),
		tables: [],
	},
];
