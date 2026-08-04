import {
	gameGroupCreateInputSchema,
	gameGroupUpdateInputSchema,
} from "@sapphire2/api/routers/game-group";
import {
	gameMixCreateInputSchema,
	gameMixUpdateInputSchema,
} from "@sapphire2/api/routers/game-mix";
import {
	gameVariantCreateInputSchema,
	gameVariantUpdateInputSchema,
} from "@sapphire2/api/routers/game-variant";
import { playerListInputSchema } from "@sapphire2/api/routers/player";
import {
	ringGameCreateInputSchema,
	ringGameIdInputSchema,
	ringGameListByRoomInputSchema,
	ringGameUpdateInputSchema,
} from "@sapphire2/api/routers/ring-game";
import {
	roomCreateInputSchema,
	roomIdInputSchema,
	roomUpdateInputSchema,
} from "@sapphire2/api/routers/room";
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
import {
	tournamentCreateWithLevelsInputSchema,
	tournamentIdInputSchema,
	tournamentListByRoomInputSchema,
	tournamentUpdateWithLevelsInputSchema,
} from "@sapphire2/api/routers/tournament";
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

/** Master-data tools carry no dates, only the amount half of the convention. */
const AMOUNT_CONVENTIONS =
	"Amounts (blinds, ante, buy-in, stack) are plain integers in the currency's display unit.";

/**
 * variant and mixGames are one setting, not two. The router rejects mixGames
 * unless variant names a mix, and freezes the flat blind fields whenever one
 * is set — neither is visible in the JSON Schema, so the description is the
 * only contract the model gets (mcp-tools.md rule 7).
 */
const MIX_RULE =
	'A mixed-game rule is variant + mixGames together: variant must be the label of a game mix from game_mix_list (or the legacy "mix" sentinel), and mixGames its rotation. Sending mixGames without such a variant is rejected. While a mix is set, blind1-3, ante and anteType are always stored as null, so values sent for those flat fields are dropped.';

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

	// --- Master data ---------------------------------------------------------
	// Rooms and the game rules attached to them. Sessions reference these, so
	// editing one changes how existing sessions read: every mutation below is
	// annotated destructive except pure creation.
	{
		name: "room_get_by_id",
		procedurePath: "room.getById",
		description:
			"Get one poker room by id, including its memo and coordinates. Use room_list to find the id.",
		inputSchema: roomIdInputSchema,
	},
	{
		name: "room_create",
		procedurePath: "room.create",
		description:
			"Create a poker room (a venue or app the user plays at). Only name is required. latitude and longitude must be supplied together or not at all.",
		inputSchema: roomCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "room_update",
		procedurePath: "room.update",
		description:
			"Update a room by id. Only the supplied fields change; pass null to clear memo or the coordinates (latitude and longitude must be cleared together). Existing sessions display the new name.",
		inputSchema: roomUpdateInputSchema,
		destructiveHint: true,
		idempotentHint: true,
	},
	{
		name: "ring_game_create",
		procedurePath: "ringGame.create",
		description: `Create a ring-game (cash-game) rule master inside a room: blinds, ante, buy-in range, table size. Sessions linked to it inherit these values. Required: roomId, name. ${MIX_RULE} variant defaults to a non-mixed label, so a create that passes mixGames must set variant too. ${AMOUNT_CONVENTIONS}`,
		inputSchema: ringGameCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "ring_game_update",
		procedurePath: "ringGame.update",
		description: `Update a ring-game rule master by id. Only the supplied fields change; pass null to clear a nullable one. ${MIX_RULE} To move a mixed rule back to flat blinds, set variant to a non-mixed label — that clears mixGames for you. Sending mixGames: null on its own is rejected, because the unchanged variant still names a mix. ${AMOUNT_CONVENTIONS}`,
		inputSchema: ringGameUpdateInputSchema,
		destructiveHint: true,
		idempotentHint: true,
	},
	{
		name: "ring_game_archive",
		procedurePath: "ringGame.archive",
		description:
			"Archive a ring-game rule master so it stops appearing in pickers. Reversible with ring_game_restore; existing sessions keep their link. List archived ones with ring_game_list_by_room and includeArchived.",
		inputSchema: ringGameIdInputSchema,
		destructiveHint: false,
		idempotentHint: true,
	},
	{
		name: "ring_game_restore",
		procedurePath: "ringGame.restore",
		description:
			"Un-archive a ring-game rule master so it appears in pickers again.",
		inputSchema: ringGameIdInputSchema,
		destructiveHint: false,
		idempotentHint: true,
	},
	{
		name: "tournament_get_by_id",
		procedurePath: "tournament.getById",
		description:
			"Get one tournament master by id with its blind levels, chip purchases and tags. Read this before tournament_update_with_levels — that tool replaces the whole blind structure.",
		inputSchema: tournamentIdInputSchema,
	},
	{
		name: "tournament_create_with_levels",
		procedurePath: "tournament.createWithLevels",
		description: `Create a tournament master inside a room, together with its blind levels, chip purchases and tags in one call. Required: roomId, name. blindLevels are ordered as given (level 1 first); every row requires isBreak (true for a break, false for a playing level). ${AMOUNT_CONVENTIONS}`,
		inputSchema: tournamentCreateWithLevelsInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "tournament_update_with_levels",
		procedurePath: "tournament.updateWithLevels",
		description: `Update a tournament master by id. blindLevels is REQUIRED and REPLACES the entire structure — read tournament_get_by_id first and send back the full list, or the existing levels are lost. tags and chipPurchases replace their lists too when supplied. ${AMOUNT_CONVENTIONS}`,
		inputSchema: tournamentUpdateWithLevelsInputSchema,
		destructiveHint: true,
		idempotentHint: true,
	},
	{
		name: "tournament_archive",
		procedurePath: "tournament.archive",
		description:
			"Archive a tournament master so it stops appearing in pickers. Reversible with tournament_restore; existing sessions keep their link.",
		inputSchema: tournamentIdInputSchema,
		destructiveHint: false,
		idempotentHint: true,
	},
	{
		name: "tournament_restore",
		procedurePath: "tournament.restore",
		description:
			"Un-archive a tournament master so it appears in pickers again.",
		inputSchema: tournamentIdInputSchema,
		destructiveHint: false,
		idempotentHint: true,
	},
	{
		name: "game_group_list",
		procedurePath: "gameGroup.list",
		description:
			"List the user's game groups (the families game variants belong to, e.g. Hold'em / Omaha), including the labels their three blind fields use.",
	},
	{
		name: "game_group_create",
		procedurePath: "gameGroup.create",
		description:
			"Create a game group. label must be unique across the user's groups. The blind label fields name that family's blind columns (e.g. SB / BB / straddle).",
		inputSchema: gameGroupCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "game_group_update",
		procedurePath: "gameGroup.update",
		description:
			"Update a game group by id. Renaming it re-labels every variant shown under it.",
		inputSchema: gameGroupUpdateInputSchema,
		destructiveHint: true,
		idempotentHint: true,
	},
	{
		name: "game_variant_list",
		procedurePath: "gameVariant.list",
		description:
			"List the user's game variants (NLH, PLO, …) with their group and short labels. Use a variant's label as the variant field of a session or rule master.",
	},
	{
		name: "game_variant_create",
		procedurePath: "gameVariant.create",
		description:
			"Create a game variant inside a group. label must be unique across the user's variants and mixes; shortLabel is the compact form shown in mixes and blind levels.",
		inputSchema: gameVariantCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "game_variant_update",
		procedurePath: "gameVariant.update",
		description:
			"Update a game variant by id. Renaming changes the label sessions and rule masters display, and moving it to another group changes which blind labels apply.",
		inputSchema: gameVariantUpdateInputSchema,
		destructiveHint: true,
		idempotentHint: true,
	},
	{
		name: "game_mix_list",
		procedurePath: "gameMix.list",
		description:
			"List the user's game mixes (named rotations such as HORSE) and the variants each one contains.",
	},
	{
		name: "game_mix_create",
		procedurePath: "gameMix.create",
		description:
			"Create a game mix from existing variants. label must be unique across the user's variants and mixes; games lists the variant ids in rotation order and may not repeat one.",
		inputSchema: gameMixCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "game_mix_update",
		procedurePath: "gameMix.update",
		description:
			"Update a game mix by id. Supplying games REPLACES the whole rotation — read game_mix_list first and send back the full list.",
		inputSchema: gameMixUpdateInputSchema,
		destructiveHint: true,
		idempotentHint: true,
	},
];

/**
 * Plain-language name for each router namespace the catalogue exposes, in the
 * order the consent screen should read them.
 *
 * A namespace with no entry here is a bug, not a default: the screen would
 * silently omit a newly exposed entity, which is the under-representation
 * rule 8 exists to prevent. coupling.test.ts fails on an unnamed namespace
 * rather than letting the copy quietly go stale.
 */
const ENTITY_NAMES: Record<string, string> = {
	session: "poker sessions",
	stats: "statistics",
	sessionTag: "session tags",
	room: "rooms",
	currency: "currencies",
	player: "players",
	ringGame: "ring-game rules",
	tournament: "tournament rules",
	gameGroup: "game groups",
	gameVariant: "game variants",
	gameMix: "game mixes",
};

export function toolNamespace(def: ToolDefinition): string {
	return def.procedurePath.split(".")[0] ?? def.procedurePath;
}

export function entityName(namespace: string): string | undefined {
	return ENTITY_NAMES[namespace];
}

/** Distinct entity names behind the tools matching `predicate`, ENTITY_NAMES order. */
function entityNames(predicate: (def: ToolDefinition) => boolean): string[] {
	const namespaces = new Set(
		TOOL_DEFINITIONS.filter(predicate).map(toolNamespace)
	);
	return Object.entries(ENTITY_NAMES)
		.filter(([namespace]) => namespaces.has(namespace))
		.map(([, name]) => name);
}

function humanList(names: string[]): string {
	if (names.length <= 1) {
		return names.join("");
	}
	return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * Plain-language description of what an issued access token can actually do,
 * derived from the tool catalogue.
 *
 * The consent screen must show THIS, not the OAuth scopes: authorization does
 * not consult scopes at all (see buildMcpSession), so every token grants the
 * full tool surface. Deriving the copy from TOOL_DEFINITIONS means adding a
 * write tool cannot silently leave the consent screen under-representing the
 * grant.
 */
export function toolPermissionSummary(): string[] {
	const readable = entityNames((def) => toolAnnotations(def).readOnlyHint);
	const writable = entityNames((def) => !toolAnnotations(def).readOnlyHint);
	const overwritable = entityNames(
		(def) => toolAnnotations(def).destructiveHint === true
	);

	const permissions = [`Read your ${humanList(readable)}`];
	if (writable.length > 0) {
		permissions.push(`Create and edit your ${humanList(writable)}`);
	}
	// Tracked separately from plain writes: a destructive tool overwrites or
	// removes data the user already has, which is a materially bigger ask than
	// appending to it — and the two sets drift apart as tools are added.
	if (overwritable.length > 0) {
		permissions.push(
			`Overwrite ${humanList(overwritable)} that are already in your account — these edits cannot be undone`
		);
	}
	return permissions;
}

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
			"Irreversible master deletion: sessions reference these rows, so removing one rewrites history the user cannot get back. These two have an archive/restore counterpart on the router, which is exposed instead",
		paths: ["ringGame.delete", "tournament.delete"],
	},
	{
		reason:
			"Irreversible deletion with NO archive counterpart on the router: creating these is exposed but removing them is not, so a mistaken create leaves a row only the web UI can clear. Exposing delete instead would put an unrecoverable operation on the tool surface, which is the worse trade",
		paths: [
			"room.delete",
			"gameGroup.delete",
			"gameVariant.delete",
			"gameMix.delete",
			"sessionTag.delete",
		],
	},
	{
		reason:
			"Toggle semantics are not idempotent — a retried call silently reverses the previous one, which a model cannot detect",
		paths: ["room.toggleFavorite", "currency.toggleFavorite"],
	},
	{
		reason:
			"Superseded by the WithLevels variants, which are supersets: exposing both invites the model to pick the lesser one and then be unable to set blind levels",
		paths: ["tournament.create", "tournament.update"],
	},
	{
		reason:
			"Tournament sub-resources are managed wholesale through tournament.createWithLevels / updateWithLevels (and read back via tournament.getById), so per-row CRUD would be a second, drift-prone way to do the same thing",
		paths: [
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
		],
	},
	{
		reason:
			"Master-data CRUD not requested for the MCP surface yet; the web wizards carry required-field logic a model would have to guess",
		paths: [
			"transactionType.list",
			"transactionType.create",
			"transactionType.update",
			"transactionType.delete",
			"currency.create",
			"currency.update",
			"currency.delete",
			"sessionTag.update",
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
