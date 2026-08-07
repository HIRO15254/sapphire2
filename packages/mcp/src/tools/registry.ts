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
 * variant and mixGames are one setting, not two, and mixGames is not free-form:
 * assertNamedMixComposition rejects anything but an exact reproduction of the
 * named mix. None of that reaches the JSON Schema, and the router's rejection
 * message ("references an unavailable game master") points at ownership rather
 * than at shape — so the description is the only contract the model gets
 * (mcp-tools.md rule 7).
 */
export const MIX_RULE =
	'A mixed-game rule is variant + mixGames together: variant must be the label of a game mix from game_mix_list (or the legacy "mix" sentinel), and mixGames its rotation. Sending mixGames without such a variant is rejected. For a named mix, mixGames must reproduce that mix EXACTLY: one entry per game group its variants belong to, entries in the order game_group_list returns those groups, and each entry naming its variants by their game_variant_list label in the mix\'s own games order. Note game_mix_list returns variant IDS, not labels, so build the labels from game_variant_list. Any other grouping or order is rejected as "references an unavailable game master" — the message names ownership, but the cause is usually shape. The legacy "mix" sentinel is the loose form: any owned variant labels, grouped however you like. While a mix is set, the top-level blind1-3, ante and anteType are always stored as null, so values sent for those flat fields are dropped — the blinds of a mix live on each mixGames entry instead (its own blind1-3 / ante / anteType, per group).';

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
		description: `Record a completed cash-game session (type must be "cash_game"). Required: sessionDate, buyIn, cashOut. Link roomId/ringGameId/currencyId from the list tools when known — a linked ring game fills rule fields (blinds, variant) automatically. ${MIX_RULE} variant has no schema default here, but resolves to a non-mixed label whenever no mixed ring game is linked, so a create that passes mixGames must set variant too — unless the linked ring game is itself the mix, which supplies it. This writes real data: confirm the values with the user before calling. ${DATE_CONVENTIONS}`,
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
		description: `Update an existing session by id. Only the provided fields change; pass null to clear a nullable field, omit a field to leave it unchanged — except tagIds, blindLevels and chipPurchases, which REPLACE their whole list whenever supplied, so read session_get_by_id first and send the full list back. Two scalar fields replace lists as well, so omitting the lists is not by itself safe: tournamentId re-copies the whole blind structure and the chip purchases from that master with every purchase count reset to 0, so the session's chip cost drops to 0. Sending chipPurchases in the same call overrides that copy, but it replaces name, cost and chips as well, so echoing what session_get_by_id returned would keep the OLD master's prices under the new blind structure: take the new master's purchases from tournament_list_by_room (tournament_get_by_id does not return them, and that list is either/or on archive state — pass includeArchived when the master you relinked to is archived, which this tool still accepts) and carry the old counts onto those. ringGameId re-copies the cash rule fields (ruleName, variant, mixGames, blinds, ante, buy-in range, tableSize) from that master, except for any of them you send in the same call, which win — the flat blinds and ante excepted whenever the result is a mix, which nulls them per the mixed-game rule below — so a relink and a correction are one call, not two. Its tags come back as { id, name } objects while tagIds takes plain ids, and each chip purchase's count must be echoed too or it resets to 0 and stops counting toward the session's cost. This tool returns the session row alone, so a list you truncated is not visible in its result. Sessions recorded live (source "live") reject edits to fields derived from their timeline events — amounts and times come from the events themselves, and the rule fields go with them: for a cash session ringGameId, ruleName, variant, mixGames, blinds, ante, buy-in range and tableSize; for a tournament tournamentId, ruleName, variant, startingStack, bountyAmount, blindLevels, chipPurchases, tableSize and the result fields (placement, totalEntries, beforeDeadline, prizeMoney, bountyPrizes). Those change only through the live session itself, which this surface does not expose, so there is no alternative call to fall back on. ${MIX_RULE} Overwrites stored values with no undo — confirm with the user first. ${DATE_CONVENTIONS}`,
		inputSchema: sessionUpdateInputSchema,
		destructiveHint: true,
		idempotentHint: true,
	},
	{
		name: "stats_summary",
		procedurePath: "stats.summary",
		description: `Aggregate statistics (profit/loss, win rate, session counts, EV metrics) over the user's sessions. currencyId is required unless normalized is true. normalized does NOT convert or restate anything — it only lifts that requirement, so the query then spans every currency. The response is the same either way and always carries both kinds of figure. Anything built from raw amounts is meaningless once more than one currency is in scope: totalProfitLoss, avgProfitLoss, hourlyRate, totalPrizeMoney, totalEvProfitLoss, totalEvDiff, and also roi — a percentage, but one raw cross-currency sum divided by another. The currency-safe figures include cashNormalizedProfitLoss (big blinds, over cashBbCount), tournamentNormalizedProfitLoss (buy-ins, over tournamentBiCount), bbPerHour, cashEvDiffNormalized and avgRoi (the mean of per-session ROI, unlike roi); the counts and rates (totalSessions, winRate, itmRate, avgPlacement, totalPlayMinutes) do not depend on currency at all — winRate just counts profitLoss > 0. The two normalized P/L figures cover only the sessions that have a denominator: totalSessions minus (cashBbCount + tournamentBiCount) is exactly how many were left out — a cash session with no big blind, which every mixed-game rule produces since those store blind1-3 as null, and a tournament with nothing invested — while those sessions still count in totalProfitLoss and winRate. cashEvDiffNormalized covers exactly the same sessions as cashNormalizedProfitLoss — the cash ones that have a big blind — and its count is not returned, and bbPerHour divides the same bb subtotal by ALL cash hours, so it is pulled toward zero whenever some cash sessions have no big blind. The three EV figures (totalEvProfitLoss, totalEvDiff, cashEvDiffNormalized) are all null unless at least one session in scope has a recorded EV cash-out. Once one does, they span EVERY finished cash session in scope, not an EV-only subset: a session with no recorded EV cash-out is treated as having run exactly at EV, so it adds its actual result to totalEvProfitLoss and 0 to the two diffs. So totalEvProfitLoss is comparable with totalProfitLoss over the same sessions, and totalEvDiff being 0 means the recorded EV matched the results, NOT that EV is untracked — untracked reads as null. bb and bi are different scales that must never be summed. Pass a currencyId whenever the user asked about money. Optional filters: type, roomId, dateFrom/dateTo. ${DATE_CONVENTIONS}`,
		inputSchema: statsFilterSchema,
	},
	{
		name: "stats_breakdown",
		procedurePath: "stats.breakdown",
		description: `Statistics grouped by one dimension: groupBy is "room" | "stakes" | "type" | "dayOfWeek" | "length" | "month" | "year" | "variant". Same filter rules as stats_summary (currencyId required unless normalized, which only lifts that requirement — it converts nothing, so currency amounts returned across a multi-currency scope are raw sums), but the grouping is NOT a partition of the filtered sessions: groupBy "stakes" drops every tournament and "length" drops sessions with no recorded duration, so the groups' sessions and profitLoss need not add up to stats_summary's. The per-group cashNormalizedProfitLoss / tournamentNormalizedProfitLoss again cover only the sessions that have a denominator, and their counts are NOT returned, so that exclusion cannot be measured here at all. Stakes labels come from the raw blind1/blind2, so every mixed-game session lands in one "0/0" bucket. ${DATE_CONVENTIONS}`,
		inputSchema: breakdownFilterSchema,
	},
	{
		name: "stats_profit_loss_series",
		procedurePath: "stats.profitLossSeries",
		description: `Per-session profit/loss points in chronological order, for trend questions ("how did this month go?"). points[] are per-session DELTAS, not a running total — sum them for a period figure, or read stats_summary instead. Each point also carries bigBlind and buyInTotal so the caller can divide itself — cash points normalize by bigBlind (bb) and tournament points by buyInTotal (buy-ins), matching stats_summary; a cash point's buyInTotal is just its cash buy-in and is not a denominator anywhere in stats. A cash point whose bigBlind is null cannot be normalized at all — those are the same sessions stats_summary leaves out of cashBbCount, and every mixed-game rule produces them. sortKey (startedAt, falling back to sessionDate) is what orders same-day sessions. Same filter rules as stats_summary (currencyId required unless normalized, which only lifts that requirement — it converts nothing, so currency amounts returned across a multi-currency scope are raw sums). ${DATE_CONVENTIONS}`,
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
			"List the user's currencies with their unit and current balance (the sum of their ledger transactions). Use the returned ids as currencyId in other tools.",
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
			"List the tournament masters of one room — buy-in, starting stack, chip purchases, and blindLevelCount (the number of blind levels, not the levels themselves; tournament_get_by_id returns those). Use the returned ids as tournamentId in session_create_tournament. Set includeArchived to list archived ones instead.",
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
			"Update a room by id. Only the supplied fields change; pass null to clear memo or the coordinates (latitude and longitude must be set or cleared together — sending only one is rejected even when the other is already stored). Existing sessions display the new name.",
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
		description: `Update a ring-game rule master by id. Only the supplied fields change; pass null to clear a nullable one. ${MIX_RULE} To edit only the blinds of a mixed rule, echo back the mixGames that ring_game_list_by_room returned — but only while the mix master is untouched, because the check rebuilds the expected shape from the CURRENT variant labels and groups and the mix's current games. After a game_mix_update that replaced games, a game_variant_update that changed a label or group, or a game_group_update that renamed a user-created group (those sort by label, and that order is the entry order), rebuild mixGames from the current masters instead. Renaming the mix inverts that: variant is a copied label rather than a foreign key, so it stops resolving and the stored mixGames becomes the reference instead of the masters — send its grouping and variant labels back unchanged (only the per-entry blinds may differ), or set variant to the new mix label and send a rebuilt mixGames. To move a mixed rule back to flat blinds, set variant to a non-mixed label — that clears mixGames for you. Sending mixGames: null on its own is rejected either way, because leaving variant unchanged keeps the rule mixed. Two kinds of rule never come back from ring_game_list_by_room even though this tool still updates them: an archived one (that list is either/or on archive state, so pass includeArchived) and one auto-created by session_create_cash_game without a ringGameId, which is stored with no roomId and cannot be given one here, so no room ever lists it. That second kind is a per-session shadow: no EXISTING session reads it back, so editing it does NOT change what any recorded session shows — each displays its own frozen snapshot. To change that, send mixGames to session_update instead. Both that and the re-snapshot below are refused on live-recorded sessions, whose variant, mixGames and ringGameId are all event-derived. Edit the shadow only when a later read will actually use it — either re-snapshot onto it with session_update({ id, ringGameId }), or pass it as ringGameId to session_create_cash_game, which fills the new session's rule fields from it. Its id and current mixGames come from session_get_by_id (ringGameId / cashMixGames), frozen from the same snapshot. ${AMOUNT_CONVENTIONS}`,
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
			"Get one tournament master by id with its blind levels and tags. Read this before tournament_update_with_levels — that tool replaces the whole blind structure. It does NOT return chip purchases: those come from tournament_list_by_room, which by default lists only non-archived tournaments while includeArchived lists only archived ones — an archived tournament is still readable and updatable here, so pick the right one or its purchases look like none. tournament_update_with_levels replaces them wholesale too whenever chipPurchases is supplied, so an empty or partial list there deletes the rest. Its tags come back as { id, name } objects while the update tool takes plain name strings.",
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
			"Update a game group by id. Only the supplied fields change; pass null to clear a blind label. Renaming it re-labels every variant shown under it, and for a user-created group it also moves the group's position in game_group_list — which is the entry order mixGames must use.",
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
			'Update a game variant by id. Only the supplied fields change; pass null to clear shortLabel. Renaming rewrites NOTHING already stored: sessions and rule masters keep the label text they were written with, so a renamed variant splits into two buckets in stats_breakdown groupBy "variant" and renaming to tidy up past records leaves their text exactly as it was. It is not inert, though — those rows are tied back to this variant by that stored text alone, so moving it to another group (which is what names the blind fields) applies to every row still naming it, while a rename leaves the old ones matching no variant at all and falling back to generic SB / BB / Straddle blind labels, plus a third blind slot their real group may not have. To relabel past records — and to re-link those orphans — write the new label into each row instead: session_update, ring_game_update and tournament_update_with_levels all accept variant, and a plain (non-mix) label needs no matching master row — except that tournament_update_with_levels also REQUIRES the full blindLevels list and replaces it, so read tournament_get_by_id and send that list back rather than an empty one. Sessions recorded live reject it, though (variant is one of their event-derived fields), so those keep the old label. Either edit also changes the mixGames shape every mix containing this variant expects, so ring-game rules using such a mix need a rebuilt mixGames the next time they send one — updates touching neither variant nor mixGames stay unaffected.',
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
			"Update a game mix by id. Only the supplied fields change, with one exception: supplying games REPLACES the whole rotation — read game_mix_list first and send back the full list. Sending label alone leaves games untouched. Replacing it also changes the mixGames shape ring-game rules using this mix must send when they next send one. Renaming it does the opposite: their variant keeps the old label, which no longer resolves, so from then on their mixGames is checked against their own stored grouping and variant labels rather than against this mix.",
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
		// "or", not "and": an entity reaches this line on any write tool, and
		// some expose only one of the two (session tags can be created but not
		// renamed). The destructive line below names which ones can be changed.
		permissions.push(`Create or change your ${humanList(writable)}`);
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
			"Outside the requested MCP scope (sessions, plus the rooms and game masters the user asked for). Currencies also carry the bankroll ledger: transaction types include the reserved 'Session Result' row session recording writes to, and while the name is guarded against being taken, nothing stops that row being renamed away from it — the next recorded session then creates a second one and the existing ledger rows keep pointing at the renamed type. Exposing these needs a use case that settles that first",
		paths: [
			"transactionType.list",
			"transactionType.create",
			"transactionType.update",
			"transactionType.delete",
			"currency.create",
			"currency.update",
			"currency.delete",
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
			"Renaming a tag has no safe undo here: neither create nor update dedupes names, so a rename onto an existing one leaves two tags a model cannot tell apart, and delete is not exposed to clean up. sessionTag.create is exposed because recording a session may need a new tag — renaming is a different operation and needs the dedupe question answered first",
		paths: ["sessionTag.update"],
	},
	{
		reason:
			"player.list already returns these rows, so a by-id tool would be a second way to read the same data",
		paths: ["player.getById"],
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
