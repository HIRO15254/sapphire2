import {
	type Database,
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
	stringValue,
} from "./sqlite";

const FIRST_UNRELEASED = "0054_";
const day = Date.parse("2026-10-08T00:00:00Z") / 1000;

const LEGACY_SEED = `
INSERT INTO user (id, name, email) VALUES ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO room (id, user_id, name, updated_at) VALUES ('club', 'alice', 'Club', 2), ('bar', 'alice', 'Bar', 3);
INSERT INTO currency (id, user_id, name, updated_at) VALUES ('chips', 'alice', 'Chips', 2);
INSERT INTO game_group (id, user_id, builtin_key, label, blind1_label, blind2_label, created_at, updated_at) VALUES
 ('group', 'alice', 'bigbet', 'Big Bet', 'SB', 'BB', 1, 2);
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at) VALUES
 ('nlh', 'alice', 'nlh', 'NL Hold''em', 'NLH', 'group', 0, 1, 2);
INSERT INTO ring_game (id, user_id, room_id, currency_id, name, variant, blind1, blind2, created_at, updated_at) VALUES
 ('ring', 'alice', 'club', 'chips', 'Cash', 'NL Hold''em', 1, 2, 1, 2);
INSERT INTO tournament (id, room_id, currency_id, name, variant, buy_in, entry_fee, starting_stack, table_size, created_at, updated_at) VALUES
 ('mtt', 'club', 'chips', 'Daily', 'NL Hold''em', 1000, 100, 5000, 9, 1, 2);
INSERT INTO blind_level (id, tournament_id, level, is_break, blind1, blind2, minutes) VALUES
 ('level', 'mtt', 1, 0, 25, 50, 20);
INSERT INTO player (id, user_id, name, created_at, updated_at) VALUES ('player', 'alice', 'Opponent', 1, 2);
INSERT INTO player_tag (id, user_id, name, color, created_at, updated_at) VALUES ('pt', 'alice', 'Loose', 'red', 1, 2);
INSERT INTO player_to_player_tag (player_id, player_tag_id, position) VALUES ('player', 'pt', 4);
INSERT INTO game_session (id, user_id, kind, source, status, session_date, break_minutes, room_id, currency_id, created_at, updated_at) VALUES
 ('cash', 'alice', 'cash_game', 'manual', 'completed', ${day}, 0, 'club', 'chips', 1, 2),
 ('roomless', 'alice', 'cash_game', 'manual', 'completed', ${day}, 0, NULL, NULL, 1, 2),
 ('tournament-entry', 'alice', 'tournament', 'manual', 'completed', ${day}, 0, 'club', 'chips', 1, 2),
 ('live', 'alice', 'cash_game', 'live', 'completed', ${day}, 0, 'club', 'chips', 1, 2);
UPDATE game_session SET started_at = ${day + 3600}, ended_at = ${day + 4200} WHERE id = 'live';
INSERT INTO session_cash_detail (session_id, ring_game_id, buy_in, cash_out, variant, blind1, blind2) VALUES
 ('cash', 'ring', 100, 150, 'NL Hold''em', 1, 2),
 ('roomless', NULL, 100, 50, 'NL Hold''em', 1, 2),
 ('live', 'ring', 100, 150, 'NL Hold''em', 1, 2);
INSERT INTO session_event (id, session_id, event_type, occurred_at, sort_order, payload, created_at, updated_at) VALUES
 ('live-start', 'live', 'session_start', ${day + 3600}, 0, '{"buyInAmount":100}', 1, 2),
 ('live-end', 'live', 'session_end', ${day + 4200}, 1, '{"cashOutAmount":150}', 1, 2);
INSERT INTO session_tournament_detail (session_id, tournament_id, tournament_buy_in, entry_fee, placement, total_entries, prize_money) VALUES
 ('tournament-entry', 'mtt', 1000, 100, 2, 10, 2000);
INSERT INTO transaction_type (id, user_id, name, updated_at) VALUES ('type', 'alice', 'Adjustment', 1);
INSERT INTO currency_transaction (id, currency_id, transaction_type_id, session_id, amount, transacted_at, created_at) VALUES
 ('deposit', 'chips', 'type', NULL, 100, ${day}, 2);
`;

const V2_SEED = `
UPDATE room SET is_favorite = 1, latitude = 35.6812, longitude = 139.7671 WHERE id = 'club';
UPDATE player SET is_temporary = 1 WHERE id = 'player';
UPDATE play_session SET clock_started_at = ${day}, clock_start_level = 3 WHERE id = 'tournament-entry';
UPDATE play_session SET next_hand_seq = 2 WHERE id = 'live';
INSERT INTO hand (id, user_id, play_session_id, hand_no, seq, played_at, detail, button_seat, table_size, level_ordinal, stakes, variant_id, pot, rake, memo, updated_at) VALUES
 ('h1', 'alice', 'live', 1, 1, ${day + 3700}, 'full', 3, 6, 2, '{"blind1":1,"blind2":2}', 'nlh', 40, 2, 'cooler', 5),
 ('h2', 'alice', 'live', 2, 2, NULL, 'count', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 6);
INSERT INTO hand_board (hand_id, user_id, board_no, cards) VALUES ('h1', 'alice', 1, 'AsKsQs');
INSERT INTO hand_seat (hand_id, user_id, seat, player_id, is_hero, start_stack, hole_cards, net, showed) VALUES
 ('h1', 'alice', 3, NULL, 1, 200, 'AhAd', 20, 1),
 ('h1', 'alice', 5, 'player', 0, 150, NULL, -20, 0);
INSERT INTO hand_action (hand_id, user_id, seq, street, seat, action, amount, all_in) VALUES
 ('h1', 'alice', 1, 0, 5, 'raise', 6, 0),
 ('h1', 'alice', 2, 0, 3, 'call', 6, 1);
INSERT INTO hand_tag (id, user_id, name, created_at, updated_at) VALUES ('ht', 'alice', 'Review', 1, 2);
INSERT INTO hand_tag_link (user_id, hand_id, tag_id, reviewed_at) VALUES ('alice', 'h1', 'ht', ${day});
INSERT INTO play_event (id, user_id, entry_id, entry_source, play_session_id, type, schema_version, occurred_at, sort_order, payload, updated_at, hand_id) VALUES
 ('live-hand', 'alice', 'live', 'live', 'live', 'hand_complete', 2, ${day + 3700}, 2, '{"playerId":"player"}', 7, 'h1');
`;

export function apply(db: Database, file: string): void {
	for (const statement of statementsOf(file)) {
		db.exec(statement);
	}
}

export function populatedDatabase(target: string): Database {
	const db = openDatabase();
	try {
		db.exec("PRAGMA foreign_keys=ON");
		for (const file of migrationFiles(FIRST_UNRELEASED)) {
			apply(db, file);
		}
		db.exec(LEGACY_SEED);
		for (const file of migrationFiles(target).filter(
			(name) => name >= FIRST_UNRELEASED
		)) {
			apply(db, file);
		}
		db.exec(V2_SEED);
		return db;
	} catch (error) {
		db.close();
		throw error;
	}
}

export function values(db: Database, sql: string) {
	return rowValues(db.prepare(sql));
}

export function tableContents(db: Database, table: string) {
	const columns = values(db, `PRAGMA table_info("${table}")`)
		.map((row) => `"${stringValue(row[1])}"`)
		.toSorted();
	return values(
		db,
		`SELECT ${columns.join(", ")} FROM "${table}" ORDER BY ${columns.join(", ")}`
	);
}

export function indexDefinitions(db: Database, table: string) {
	return values(
		db,
		`SELECT name, sql FROM sqlite_schema WHERE type = 'index' AND tbl_name = '${table}' ORDER BY name`
	);
}
