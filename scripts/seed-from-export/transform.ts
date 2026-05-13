import type { Database } from "bun:sqlite";

const OLD_VARIANT_TO_NEW_ID: Record<string, number> = {
	nlh: 1,
	plh: 2,
	flh: 3,
	plo: 4,
	ploh: 5,
	floh: 6,
	bigo: 7,
	short: 8,
	stud: 9,
	studhilo: 10,
	razz: 11,
};

const OLD_VARIANT_TO_LIMIT_FORMAT_ID: Record<string, number> = {
	nlh: 1,
	plh: 2,
	flh: 3,
	plo: 2,
	ploh: 2,
	floh: 3,
	bigo: 2,
	short: 1,
	stud: 4,
	studhilo: 4,
	razz: 4,
};

const DEFAULT_VARIANT_ID = 1;
const DEFAULT_LIMIT_FORMAT_ID = 1;

function quote(value: unknown): string {
	if (value === null || value === undefined) {
		return "NULL";
	}
	if (typeof value === "number") {
		return String(value);
	}
	if (typeof value === "boolean") {
		return value ? "1" : "0";
	}
	if (value instanceof Uint8Array) {
		return `X'${Buffer.from(value).toString("hex")}'`;
	}
	return `'${String(value).replace(/'/g, "''")}'`;
}

function selectAll(db: Database, table: string): Record<string, unknown>[] {
	try {
		return db.prepare(`SELECT * FROM "${table}"`).all() as Record<
			string,
			unknown
		>[];
	} catch {
		return [];
	}
}

function passthroughInsert(
	rows: Record<string, unknown>[],
	targetTable: string
): string {
	if (rows.length === 0) {
		return `-- ${targetTable}: no rows\n`;
	}
	const columns = Object.keys(rows[0]);
	const colList = columns.map((c) => `"${c}"`).join(", ");
	const valuesSql = rows
		.map((r) => `(${columns.map((c) => quote(r[c])).join(", ")})`)
		.join(",\n  ");
	return `INSERT INTO "${targetTable}" (${colList}) VALUES\n  ${valuesSql};\n`;
}

const PASSTHROUGH_TABLES: [oldTable: string, newTable: string][] = [
	["user", "user"],
	["account", "account"],
	["session", "session"],
	["verification", "verification"],
	["store", "store"],
	["currency", "currency"],
	["transaction_type", "transaction_type"],
	["player_tag", "player_tag"],
	["player", "player"],
	["player_to_player_tag", "player_to_player_tag"],
	["session_tag", "session_tag"],
	["dashboard_widget", "dashboard_widget"],
	["update_note_view", "update_note_view"],
];

function emitPassthrough(oldDb: Database, out: string[]): void {
	for (const [oldName, newName] of PASSTHROUGH_TABLES) {
		const rows = selectAll(oldDb, oldName);
		out.push(`-- ${oldName} -> ${newName} (${rows.length} rows)`);
		out.push(passthroughInsert(rows, newName));
	}
}

function emitTournaments(oldDb: Database, out: string[]): void {
	const rows = selectAll(oldDb, "tournament");
	out.push(`-- tournament (${rows.length} rows): variant string -> variant_id`);
	for (const t of rows) {
		const variantId =
			OLD_VARIANT_TO_NEW_ID[String(t.variant)] ?? DEFAULT_VARIANT_ID;
		out.push(
			`INSERT INTO "tournament" ("id","store_id","name","variant_id","buy_in","entry_fee","starting_stack","bounty_amount","table_size","currency_id","memo","archived_at","created_at","updated_at") VALUES (${quote(t.id)}, ${quote(t.store_id)}, ${quote(t.name)}, ${variantId}, ${quote(t.buy_in)}, ${quote(t.entry_fee)}, ${quote(t.starting_stack)}, ${quote(t.bounty_amount)}, ${quote(t.table_size)}, ${quote(t.currency_id)}, ${quote(t.memo)}, ${quote(t.archived_at)}, ${quote(t.created_at)}, ${quote(t.updated_at)});`
		);
	}
	out.push("");
}

function emitRingGames(oldDb: Database, out: string[]): void {
	const rows = selectAll(oldDb, "ring_game");
	out.push(
		`-- ring_game (${rows.length} rows): variant string + blind1..3 -> variant_id + ring_game_blind_set`
	);
	for (const rg of rows) {
		const variantStr = String(rg.variant);
		const variantId = OLD_VARIANT_TO_NEW_ID[variantStr] ?? DEFAULT_VARIANT_ID;
		const limitFormatId =
			OLD_VARIANT_TO_LIMIT_FORMAT_ID[variantStr] ?? DEFAULT_LIMIT_FORMAT_ID;
		out.push(
			`INSERT INTO "ring_game" ("id","store_id","name","variant_id","min_buy_in","max_buy_in","table_size","currency_id","memo","archived_at","created_at","updated_at") VALUES (${quote(rg.id)}, ${quote(rg.store_id)}, ${quote(rg.name)}, ${variantId}, ${quote(rg.min_buy_in)}, ${quote(rg.max_buy_in)}, ${quote(rg.table_size)}, ${quote(rg.currency_id)}, ${quote(rg.memo)}, ${quote(rg.archived_at)}, ${quote(rg.created_at)}, ${quote(rg.updated_at)});`
		);
		if (rg.blind1 !== null && rg.blind1 !== undefined) {
			out.push(
				`INSERT INTO "ring_game_blind_set" ("ring_game_id","limit_format_id","blind1","blind2","blind3","blind4","ante","ante_type","sort_order") VALUES (${quote(rg.id)}, ${limitFormatId}, ${quote(rg.blind1 ?? 0)}, ${quote(rg.blind2 ?? 0)}, ${quote(rg.blind3)}, NULL, ${quote(rg.ante)}, ${quote(rg.ante_type)}, 0);`
			);
		}
	}
	out.push("");
}

function emitTournamentBlindLevels(oldDb: Database, out: string[]): void {
	const rows = selectAll(oldDb, "blind_level");
	out.push(
		`-- blind_level (${rows.length} rows, OLD) -> tournament_blind_level (NEW)`
	);
	for (const lvl of rows) {
		out.push(
			`INSERT INTO "tournament_blind_level" ("tournament_id","level_index","is_break","minutes","sort_order") VALUES (${quote(lvl.tournament_id)}, ${quote(lvl.level)}, ${quote(lvl.is_break)}, NULL, ${quote(lvl.level)});`
		);
	}
	out.push(
		"-- TODO(seed): tournament_blind_set rows for each non-break level."
	);
	out.push(
		"--   blind_set requires the auto-incremented tournament_blind_level.id, which we cannot reference inline from a plain SQL file."
	);
	out.push(
		"--   Implement either via SELECT last_insert_rowid() per row, or by switching this script to write rows directly through Drizzle."
	);
	out.push("");
}

function emitGameSessions(oldDb: Database, out: string[]): void {
	const rows = selectAll(oldDb, "game_session");
	out.push(`-- game_session (${rows.length} rows)`);
	out.push(passthroughInsert(rows, "game_session"));
}

function emitTournamentTags(oldDb: Database, out: string[]): void {
	const rows = selectAll(oldDb, "tournament_tag");
	out.push(
		`-- tournament_tag (${rows.length} rows): depends on tournament, must come after emitTournaments`
	);
	out.push(passthroughInsert(rows, "tournament_tag"));
}

function emitCurrencyTransactions(oldDb: Database, out: string[]): void {
	const rows = selectAll(oldDb, "currency_transaction");
	out.push(
		`-- currency_transaction (${rows.length} rows): may reference game_session, must come after emitGameSessions`
	);
	out.push(passthroughInsert(rows, "currency_transaction"));
}

function emitSessionCashDetails(oldDb: Database, out: string[]): void {
	const rows = selectAll(oldDb, "session_cash_detail");
	out.push(
		`-- session_cash_detail (${rows.length} rows): + rule_name, variant_id (defaulted; refine if needed)`
	);
	for (const cd of rows) {
		out.push(
			`INSERT INTO "session_cash_detail" ("session_id","ring_game_id","rule_name","min_buy_in","max_buy_in","table_size","variant_id","buy_in","cash_out","ev_cash_out") VALUES (${quote(cd.session_id)}, ${quote(cd.ring_game_id)}, 'Imported', NULL, NULL, NULL, ${DEFAULT_VARIANT_ID}, ${quote(cd.buy_in)}, ${quote(cd.cash_out)}, ${quote(cd.ev_cash_out)});`
		);
	}
	out.push("");
}

function emitSessionTournamentDetails(oldDb: Database, out: string[]): void {
	const rows = selectAll(oldDb, "session_tournament_detail");
	out.push(
		`-- session_tournament_detail (${rows.length} rows): + rule_name, variant_id, buy_in/entry_fee NOT NULL`
	);
	for (const td of rows) {
		out.push(
			`INSERT INTO "session_tournament_detail" ("session_id","tournament_id","rule_name","starting_stack","bounty_amount","table_size","buy_in","entry_fee","variant_id","placement","total_entries","before_deadline","prize_money","bounty_prizes","timer_started_at") VALUES (${quote(td.session_id)}, ${quote(td.tournament_id)}, 'Imported', NULL, NULL, NULL, ${quote(td.tournament_buy_in ?? 0)}, ${quote(td.entry_fee ?? 0)}, ${DEFAULT_VARIANT_ID}, ${quote(td.placement)}, ${quote(td.total_entries)}, ${quote(td.before_deadline)}, ${quote(td.prize_money)}, ${quote(td.bounty_prizes)}, ${quote(td.timer_started_at)});`
		);
	}
	out.push("");
}

function emitSessionEvents(oldDb: Database, out: string[]): void {
	const rows = selectAll(oldDb, "session_event");
	out.push(
		`-- session_event (${rows.length} rows): copied verbatim. Payload schema may have evolved; verify after seeding.`
	);
	out.push(passthroughInsert(rows, "session_event"));
	out.push(
		"-- TODO(seed): backfill session_event(add_player/remove_player) rows from session_table_player."
	);
	out.push(
		"--   For each session_table_player row, emit an add_player event at joined_at, and a remove_player event at left_at when present."
	);
}

function emitSessionTagLinks(oldDb: Database, out: string[]): void {
	const rows = selectAll(oldDb, "session_to_session_tag");
	out.push(`-- session_to_session_tag (${rows.length} rows)`);
	out.push(passthroughInsert(rows, "session_to_session_tag"));
}

export function transformAll(oldDb: Database): string {
	const out: string[] = [];

	out.push("-- Generated by scripts/seed-from-export.");
	out.push("-- Source: prod D1 export (旧 schema)");
	out.push("-- Target: local D1 with new schema (post Phase 0 rewrite)");
	out.push("--");
	out.push(
		'-- NOTE: D1 rejects BEGIN TRANSACTION / SAVEPOINT ("please use state.storage.transaction()").'
	);
	out.push(
		"-- Statements are emitted without an explicit transaction; rely on wrangler d1 execute --file to apply them."
	);
	out.push("");

	emitPassthrough(oldDb, out);
	emitTournaments(oldDb, out);
	emitTournamentTags(oldDb, out);
	emitRingGames(oldDb, out);
	emitTournamentBlindLevels(oldDb, out);
	emitGameSessions(oldDb, out);
	emitCurrencyTransactions(oldDb, out);
	emitSessionCashDetails(oldDb, out);
	emitSessionTournamentDetails(oldDb, out);
	emitSessionEvents(oldDb, out);
	emitSessionTagLinks(oldDb, out);

	out.push("");
	out.push("-- END");

	return out.join("\n");
}
