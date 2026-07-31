import { playerListInputSchema } from "@sapphire2/api/routers/player";
import { ringGameListByRoomInputSchema } from "@sapphire2/api/routers/ring-game";
import {
	cashGameCreateSchema,
	sessionGetByIdInputSchema,
	sessionListInputSchema,
	sessionUpdateInputSchema,
	tournamentCreateSchema,
} from "@sapphire2/api/routers/session";
import { sessionTagCreateInputSchema } from "@sapphire2/api/routers/session-tag";
import {
	breakdownFilterSchema,
	statsFilterSchema,
} from "@sapphire2/api/routers/stats";
import { tournamentListByRoomInputSchema } from "@sapphire2/api/routers/tournament";
import { getProcedureType } from "./resolve";

/**
 * One MCP tool = one appRouter procedure (session.create maps to two tools,
 * one per discriminated-union branch). `inputSchema` is the router's own Zod
 * object — never a redefinition — so the MCP contract IS the API contract.
 * See .claude/rules/mcp-tools.md and coupling.test.ts.
 */
export interface ToolDefinition {
	description: string;
	/** Mutations only — queries derive their annotations from the router type. */
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	/** The router's exact input Zod schema; undefined for no-input procedures. */
	inputSchema?: unknown;
	name: string;
	procedurePath: string;
}

export interface ToolAnnotations {
	destructiveHint: boolean;
	idempotentHint: boolean;
	openWorldHint: boolean;
	readOnlyHint: boolean;
}

const DATE_CONVENTIONS =
	"Dates are unix SECONDS; date-only values (sessionDate, dateFrom, dateTo) are UTC-midnight timestamps. Amounts are plain integers in the currency's display unit.";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
	{
		name: "session_list",
		procedurePath: "session.list",
		description: `List the user's completed poker sessions, newest first, 20 per page. Optional filters: type ("cash_game" | "tournament"), roomId, currencyId, dateFrom/dateTo (inclusive). Returns { items, nextCursor, summary }; summary aggregates ALL matching sessions, not only the returned page. Pass nextCursor back as cursor for the next page. ${DATE_CONVENTIONS}`,
		inputSchema: sessionListInputSchema,
	},
	{
		name: "session_get_by_id",
		procedurePath: "session.getById",
		description:
			"Get a single session by id, including its cash-game or tournament details, tags, blind levels and chip purchases.",
		inputSchema: sessionGetByIdInputSchema,
	},
	{
		name: "session_create_cash_game",
		procedurePath: "session.create",
		description: `Record a completed cash-game session (type must be "cash_game"). Required: sessionDate, buyIn, cashOut. Link roomId/ringGameId/currencyId from the list tools when known — a linked ring game fills rule fields (blinds, variant) automatically. This writes real data: confirm the values with the user before calling. ${DATE_CONVENTIONS}`,
		inputSchema: cashGameCreateSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "session_create_tournament",
		procedurePath: "session.create",
		description: `Record a completed tournament session (type must be "tournament"). Required: sessionDate, tournamentBuyIn. placement must be <= totalEntries unless beforeDeadline is true. Link roomId/tournamentId/currencyId from the list tools when known. This writes real data: confirm the values with the user before calling. ${DATE_CONVENTIONS}`,
		inputSchema: tournamentCreateSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "session_update",
		procedurePath: "session.update",
		description: `Update an existing session by id. Only the provided fields change; pass null to clear a nullable field, omit a field to leave it unchanged. Sessions recorded live (source "live") reject edits to fields derived from their timeline events — buy-ins, cash-outs and times come from the events themselves. Overwrites stored values with no undo — confirm with the user first. ${DATE_CONVENTIONS}`,
		inputSchema: sessionUpdateInputSchema,
		destructiveHint: true,
		idempotentHint: true,
	},
	{
		name: "stats_summary",
		procedurePath: "stats.summary",
		description: `Aggregate statistics (profit/loss, win rate, session counts, EV metrics) over the user's sessions. currencyId is required unless normalized is true (normalized converts all currencies via their rates). Optional filters: type, roomId, dateFrom/dateTo. ${DATE_CONVENTIONS}`,
		inputSchema: statsFilterSchema,
	},
	{
		name: "stats_breakdown",
		procedurePath: "stats.breakdown",
		description: `Statistics grouped by one dimension: groupBy is "room" | "stakes" | "type" | "dayOfWeek" | "length" | "month" | "year" | "variant". Same filter rules as stats_summary (currencyId required unless normalized). ${DATE_CONVENTIONS}`,
		inputSchema: breakdownFilterSchema,
	},
	{
		name: "stats_profit_loss_series",
		procedurePath: "stats.profitLossSeries",
		description: `Cumulative profit/loss time series across sessions, for trend questions ("how did this month go?"). Same filter rules as stats_summary (currencyId required unless normalized). ${DATE_CONVENTIONS}`,
		inputSchema: statsFilterSchema,
	},
	{
		name: "room_list",
		procedurePath: "room.list",
		description:
			"List the user's poker rooms (venues/apps they play at), including favorites. Use the returned ids as roomId in other tools.",
	},
	{
		name: "currency_list",
		procedurePath: "currency.list",
		description:
			"List the user's currencies with units and rates. Use the returned ids as currencyId in other tools.",
	},
	{
		name: "player_list",
		procedurePath: "player.list",
		description:
			"List the user's tracked opponents/players. Optional: search (name substring), tagIds (player-tag ids).",
		inputSchema: playerListInputSchema,
	},
	{
		name: "session_tag_list",
		procedurePath: "sessionTag.list",
		description:
			"List the user's session tags. Use the returned ids as tagIds when creating or updating sessions.",
	},
	{
		name: "session_tag_create",
		procedurePath: "sessionTag.create",
		description:
			"Create a new session tag by name. Check session_tag_list first to avoid duplicates.",
		inputSchema: sessionTagCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "ring_game_list_by_room",
		procedurePath: "ringGame.listByRoom",
		description:
			"List the ring-game (cash-game) rule masters of one room — blinds, variant, buy-in range. Use the returned ids as ringGameId in session_create_cash_game. Set includeArchived to list archived ones instead.",
		inputSchema: ringGameListByRoomInputSchema,
	},
	{
		name: "tournament_list_by_room",
		procedurePath: "tournament.listByRoom",
		description:
			"List the tournament masters of one room — buy-in, starting stack, blind structure. Use the returned ids as tournamentId in session_create_tournament. Set includeArchived to list archived ones instead.",
		inputSchema: tournamentListByRoomInputSchema,
	},
];

export function toolAnnotations(def: ToolDefinition): ToolAnnotations {
	const readOnly = getProcedureType(def.procedurePath) === "query";
	return {
		readOnlyHint: readOnly,
		destructiveHint: readOnly ? false : (def.destructiveHint ?? true),
		idempotentHint: readOnly ? true : (def.idempotentHint ?? false),
		openWorldHint: false,
	};
}

/**
 * Every appRouter procedure NOT exposed as a tool must appear here with the
 * reason. coupling.test.ts fails when a backend procedure is neither exposed
 * nor listed — adding an API procedure forces an explicit MCP decision.
 */
export const DELIBERATELY_EXCLUDED: {
	reason: string;
	paths: string[];
}[] = [
	{
		reason: "Infra/debug endpoints with no agent value",
		paths: ["healthCheck", "privateData"],
	},
	{
		reason:
			"Product decision: MCP clients are themselves multimodal LLMs and can read images directly",
		paths: ["aiExtract.extractTournamentData", "aiExtract.extractTablePlayers"],
	},
	{
		reason:
			"Calls Google Places (external quota) for venue autocomplete; agents can search the web themselves",
		paths: ["location.search", "location.resolveLink"],
	},
	{
		reason:
			"Master-data CRUD is wizard-driven in the web UI; exposing it would make the model guess required-field logic",
		paths: [
			"room.getById",
			"room.create",
			"room.update",
			"room.delete",
			"room.toggleFavorite",
			"transactionType.list",
			"transactionType.create",
			"transactionType.update",
			"transactionType.delete",
			"currency.create",
			"currency.update",
			"currency.delete",
			"currency.toggleFavorite",
			"gameVariant.list",
			"gameVariant.create",
			"gameVariant.update",
			"gameVariant.delete",
			"gameGroup.list",
			"gameGroup.create",
			"gameGroup.update",
			"gameGroup.delete",
			"gameMix.list",
			"gameMix.create",
			"gameMix.update",
			"gameMix.delete",
			"ringGame.create",
			"ringGame.update",
			"ringGame.archive",
			"ringGame.restore",
			"ringGame.delete",
			"tournament.getById",
			"tournament.create",
			"tournament.update",
			"tournament.archive",
			"tournament.restore",
			"tournament.delete",
			"tournament.createWithLevels",
			"tournament.updateWithLevels",
			"tournament.addTag",
			"tournament.removeTag",
			"blindLevel.listByTournament",
			"blindLevel.create",
			"blindLevel.update",
			"blindLevel.delete",
			"blindLevel.reorder",
			"tournamentChipPurchase.listByTournament",
			"tournamentChipPurchase.create",
			"tournamentChipPurchase.update",
			"tournamentChipPurchase.delete",
			"tournamentChipPurchase.reorder",
			"sessionTag.update",
			"sessionTag.delete",
			"player.getById",
			"player.create",
			"player.update",
			"player.delete",
			"playerTag.list",
			"playerTag.create",
			"playerTag.update",
			"playerTag.delete",
		],
	},
	{
		reason:
			"Bankroll ledger writes are high-blast-radius; out of scope for the first MCP surface",
		paths: [
			"currencyTransaction.listByCurrency",
			"currencyTransaction.create",
			"currencyTransaction.update",
			"currencyTransaction.delete",
		],
	},
	{
		reason:
			"Irreversible destructive operation with no undo; deliberately kept off the MCP surface",
		paths: ["session.delete"],
	},
	{
		reason:
			"Chart-shaped duplicate of stats.profitLossSeries used by the web sessions page",
		paths: ["session.profitLossSeries"],
	},
	{
		reason:
			"Live-session state machine (clock, seats, in-flight events); highest blast radius and needs its own design",
		paths: [
			"sessionEvent.list",
			"sessionEvent.create",
			"sessionEvent.update",
			"sessionEvent.delete",
			"liveCashGameSession.list",
			"liveCashGameSession.getById",
			"liveCashGameSession.create",
			"liveCashGameSession.createAndAssignRingGame",
			"liveCashGameSession.update",
			"liveCashGameSession.updateSnapshot",
			"liveCashGameSession.complete",
			"liveCashGameSession.reopen",
			"liveCashGameSession.discard",
			"liveCashGameSession.updateHeroSeat",
			"liveTournamentSession.list",
			"liveTournamentSession.getById",
			"liveTournamentSession.create",
			"liveTournamentSession.createAndAssignTournament",
			"liveTournamentSession.update",
			"liveTournamentSession.updateSnapshot",
			"liveTournamentSession.complete",
			"liveTournamentSession.reopen",
			"liveTournamentSession.discard",
			"liveTournamentSession.updateHeroSeat",
			"sessionTablePlayer.list",
			"sessionTablePlayer.add",
			"sessionTablePlayer.addNew",
			"sessionTablePlayer.updateSeat",
			"sessionTablePlayer.remove",
			"sessionTablePlayer.addTemporary",
		],
	},
	{
		reason: "Web-only release-note read tracking",
		paths: ["updateNoteView.list", "updateNoteView.markViewed"],
	},
	{
		reason:
			"Web UI filter presets — screen state persistence, not data an agent needs",
		paths: [
			"filterPreset.list",
			"filterPreset.create",
			"filterPreset.update",
			"filterPreset.delete",
			"filterPreset.setDefault",
			"filterPreset.clearDefault",
		],
	},
];
