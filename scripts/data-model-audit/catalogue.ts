import { LEDGER_ENTRY_ROLES_BY_KIND } from "../../packages/db/src/constants/ledger";

export const AUDIT_IDS = [
	"FK",
	"A-6",
	"A-8",
	"A-9",
	"A-13",
	"A-14",
	"A-15",
	"A-16",
] as const;
export type AuditId = (typeof AUDIT_IDS)[number];

export const B01_MIGRATION = "0059_v2_final_empty_schema.sql";
export const B06_MIGRATION = "0061_entry_p1_cutover.sql";
export const B07_MIGRATION = "0067_ring_game_rule_versions.sql";
export const B09_MIGRATION = "0063_ledger_cutover.sql";
export const B12_MIGRATION = "0064_open_live_cash_ev.sql";
export const B08_MIGRATION = "0066_tournament_final.sql";
export const B13_MIGRATION = "0069_entry_rule_versions.sql";
export const B15_MIGRATION = "0070_self_player_event_v2.sql";
export const B23_MIGRATION = "0074_stand_in_cleanup.sql";

export interface Activation {
	since: string | null;
}

export type ReplayPart =
	| "a6-core"
	| "a6-lines"
	| "a6-open-ev"
	| "a15-payload-schema";

interface CheckBase {
	activation: Activation;
	audit: AuditId;
	part: string;
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

export type Check = SqlCheck | ReplayCheck;

const SINCE_B01: Activation = { since: B01_MIGRATION };
const SINCE_B06: Activation = { since: B06_MIGRATION };
const SINCE_B07: Activation = { since: B07_MIGRATION };
const SINCE_B09: Activation = { since: B09_MIGRATION };
const SINCE_B12: Activation = { since: B12_MIGRATION };
const SINCE_B08: Activation = { since: B08_MIGRATION };
const SINCE_B13: Activation = { since: B13_MIGRATION };
const SINCE_B15: Activation = { since: B15_MIGRATION };
const SINCE_B23: Activation = { since: B23_MIGRATION };

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
		activation: { since: null },
		tables: [],
		sql: () => "PRAGMA foreign_key_check",
	},
	{
		audit: "A-6",
		part: "projectEntry replay: entry status/played_on, every play_session, kind detail",
		kind: "replay",
		replay: "a6-core",
		activation: SINCE_B06,
		tables: [
			"entry",
			"entry_cash",
			"entry_tournament",
			"play_session",
			"play_event",
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
SELECT pe.id, 'asset', json_extract(pe.payload, '$.assetId') FROM play_event pe
WHERE json_extract(pe.payload, '$.assetId') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM asset a WHERE a.id = json_extract(pe.payload, '$.assetId') AND a.user_id = pe.user_id)
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
