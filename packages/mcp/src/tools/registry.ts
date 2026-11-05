import { assetListInputSchema } from "@sapphire2/api/routers/asset";
import { assetRateListInputSchema } from "@sapphire2/api/routers/asset-rate";
import {
	entryCreateCashInputSchema,
	entryCreateTournamentInputSchema,
	entryIdInputSchema,
	entryListInputSchema,
	entryUpdateInputSchema,
} from "@sapphire2/api/routers/entry";
import {
	gameGroupCreateInputSchema,
	gameGroupIdInputSchema,
	gameGroupListInputSchema,
	gameGroupUpdateInputSchema,
} from "@sapphire2/api/routers/game-group";
import {
	gameMixCreateInputSchema,
	gameMixIdInputSchema,
	gameMixListInputSchema,
	gameMixUpdateInputSchema,
} from "@sapphire2/api/routers/game-mix";
import {
	gameVariantCreateInputSchema,
	gameVariantIdInputSchema,
	gameVariantListInputSchema,
	gameVariantUpdateInputSchema,
} from "@sapphire2/api/routers/game-variant";
import {
	handIdInputSchema,
	handListInputSchema,
} from "@sapphire2/api/routers/hand";
import { playerListInputSchema } from "@sapphire2/api/routers/player";
import { playerTagCreateInputSchema } from "@sapphire2/api/routers/player-tag";
import {
	ringGameCreateInputSchema,
	ringGameIdInputSchema,
	ringGameListByRoomInputSchema,
	ringGameUpdateInputSchema,
} from "@sapphire2/api/routers/ring-game";
import {
	roomCreateInputSchema,
	roomIdInputSchema,
	roomListInputSchema,
	roomUpdateInputSchema,
} from "@sapphire2/api/routers/room";
import {
	breakdownFilterSchema,
	statsFilterSchema,
} from "@sapphire2/api/routers/stats";
import { tagCreateInputSchema } from "@sapphire2/api/routers/tag-router";
import {
	tournamentCreateWithLevelsInputSchema,
	tournamentIdInputSchema,
	tournamentListByRoomInputSchema,
	tournamentUpdateWithLevelsInputSchema,
} from "@sapphire2/api/routers/tournament";
import { getProcedureType } from "./resolve";

export interface ToolDefinition {
	description: string;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
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

const AMOUNT_CONVENTIONS =
	"Amounts (blinds, ante, buy-in, stack) are plain integers in the currency's display unit.";

const STAKE_BLINDS =
	"Each written stake must fill every blind its game group marks required (blind1Required-blind3Required in game_group_list) and leave empty every blind whose label is null; ante is exempt. This is checked whenever a new rule version is written, carried stakes included, and not when an unchanged version is kept.";

const RING_GAME_RULE = `rule.game selects exactly one of { variantId }, { gameMixId }, or { lineupId }. Use game_variant_list or game_mix_list for active IDs, or a lineupId from ring_game_list_by_room to preserve an existing composition, including archived selections. Newly selecting archived masters is rejected. rule.stakes, when supplied, must contain exactly one stake per resulting lineup group in order, each with its gameGroupId and optional blind1-3, ante, and anteType. A mix groups variants by their game group in first-appearance order. Omitted stakes carry forward by gameGroupId and occurrence, not position. ${STAKE_BLINDS}`;

export const TOURNAMENT_RULE_CONTRACT = `rule describes one immutable rule version. game is exactly one of { variantId } (game_variant_list), { gameMixId } (game_mix_list) or { lineupId } (a lineupId already returned by tournament_get_by_id); an archived variant or mix cannot be newly picked. levels (at most 100) and prices (at most 20) REPLACE the whole list whenever supplied — read tournament_get_by_id first and send back every row you keep. A level whose game is omitted or null plays the rule's game; a break (isBreak true) takes no game and no stakes. stakes, when supplied, list exactly one entry per group of the level's game, in the order lineups[lineupId].groups gives them, each gameGroupId matching its position; omit stakes to carry the blinds of the same level position by game group. ${STAKE_BLINDS} anteType is "none" | "all" | "bb". A price is { kind: "entry" | "reentry" | "addon", assetId (asset_list), amount, fee (integers in the asset's smallest unit), chips (stack granted, or null), label? }. Saving content identical to the current version creates nothing; any change creates a new version and keeps the old one.`;

const ENTRY_OUTPUT =
	"Each entry has playedOn (YYYY-MM-DD, the first day's local date), playSessions (its days in order, each with localDate, startedAt/endedAt unix seconds or null, breakMinutes, endState, endStack), handCount, playMinutes, tags, ruleVersion with lineups, ruleDrift (true when the linked master's current rule differs from the entry's version), lines (every money line, quantity signed: negative paid out, positive received, in the asset's smallest unit — see asset_list decimals), totals per asset and effect (buyIn, cashOut, profitLoss and roleTotals; real and virtual effects are never summed together), and valuation converted to the base asset (user_setting_get) with missingRates listing the assets that had no rate; valuation.real and valuation.virtual are null when no base asset is configured.";

const ENTRY_WRITE_RULES =
	"payments are { role, assetId, quantity, effect: real | virtual, priceId? }: quantity is a positive integer in the asset's smallest unit and the role gives the sign. Cash roles: buy_in, addon, chip_remove, cash_out. Tournament roles: buy_in, reentry, fee, chip_purchase, prize, bounty. assetId comes from asset_list; an archived asset is rejected unless the entry already uses it. Each playSessions item is one day: localDate (YYYY-MM-DD), optional label, startedAt/endedAt (unix seconds), breakMinutes, endState, endStack and its own payments. Days are in chronological order and must not overlap; every day before the last ends held (cash) or bagged (tournament) with endStack, and the last ends cashed_out or finished (cash) or busted or finished (tournament). playedOn must equal the first day's localDate. Send payments either at the top level or inside the single day, not both. Limits: 100 days, 1000 payments in total, 100 tagIds (unique, from entry_tag_list).";

const ENTRY_WRITE = `Required: playedOn (YYYY-MM-DD). Without playSessions one day on playedOn is recorded with the top-level payments, ending cashed_out (cash) or finished when placement is 1, busted otherwise (tournament). roomId comes from room_list. ${ENTRY_WRITE_RULES}`;
export const TOOL_DEFINITIONS: ToolDefinition[] = [
	{
		name: "stats_summary",
		procedurePath: "stats.summary",
		description: `Aggregate statistics (profit/loss, win rate, session counts, EV metrics) over the user's sessions. currencyId is required unless normalized is true. normalized does NOT convert or restate anything — it only lifts that requirement, so the query then spans every currency. The response is the same either way and always carries both kinds of figure. Anything built from raw amounts is meaningless once more than one currency is in scope: totalProfitLoss, avgProfitLoss, hourlyRate, totalPrizeMoney, totalEvProfitLoss, totalEvDiff, and also roi — a percentage, but one raw cross-currency sum divided by another. The currency-safe figures include cashNormalizedProfitLoss (big blinds, over cashBbCount), tournamentNormalizedProfitLoss (buy-ins, over tournamentBiCount), bbPerHour, cashEvDiffNormalized and avgRoi (the mean of per-session ROI, unlike roi); the counts and rates (totalSessions, winRate, itmRate, avgPlacement, totalPlayMinutes) do not depend on currency at all — winRate just counts profitLoss > 0. The two normalized P/L figures cover only the sessions that have a denominator: totalSessions minus (cashBbCount + tournamentBiCount) is exactly how many were left out — a cash session with no big blind, which every mixed-game rule produces since those store blind1-3 as null, and a tournament with nothing invested — while those sessions still count in totalProfitLoss and winRate. cashEvDiffNormalized covers the cash sessions that have a big blind AND a settled result, so it is narrower than cashNormalizedProfitLoss by exactly the sessions still in progress, and its count is not returned. The two hourly rates cover only the cash sessions with a recorded duration (both start and end times) — an untimed one still counts in totalProfitLoss (and in cashNormalizedProfitLoss when it has a big blind) but on neither side of a rate: hourlyRate is the profit of the timed cash sessions over their hours, and bbPerHour the bb of the timed cash sessions that also have a big blind over those sessions' hours alone, so it is null when no cash session has both. totalPlayMinutes also counts tournament time, so it is not the rates' denominator. The three EV figures (totalEvProfitLoss, totalEvDiff, cashEvDiffNormalized) are null unless a session each one actually covers has a recorded EV cash-out — for the two raw figures that is any cash session in scope, for cashEvDiffNormalized it has to be one with a big blind. Once one does, they span EVERY finished cash session they cover, not an EV-only subset: a session with no recorded EV cash-out is treated as having run exactly at EV, so it adds its actual result to totalEvProfitLoss and 0 to the two diffs. So totalEvProfitLoss is comparable with the CASH part of totalProfitLoss — that one also carries the tournaments, so the two match only in a cash-scoped query — and totalEvDiff being 0 means the recorded EV matched the results, NOT that EV is untracked; untracked reads as null. bb and bi are different scales that must never be summed. Pass a currencyId whenever the user asked about money. Optional filters: type, roomId, dateFrom/dateTo. ${DATE_CONVENTIONS}`,
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
		description: `Per-session profit/loss points in chronological order, for trend questions ("how did this month go?"). points[] are per-session DELTAS, not a running total — sum them for a period figure, or read stats_summary instead. Each point also carries bigBlind and buyInTotal so the caller can divide itself — cash points normalize by bigBlind (bb) and tournament points by buyInTotal (buy-ins), matching stats_summary; a cash point's buyInTotal is just its cash buy-in and is not a denominator anywhere in stats. A cash point whose bigBlind is null cannot be normalized at all — those are the same sessions stats_summary leaves out of cashBbCount, and every mixed-game rule produces them. Every point also carries evProfitLoss and evRecorded — both are inert on a tournament point (null and false), and on a cash point only the second one tells the two cases apart: evProfitLoss is filled in for EVERY finished cash session, falling back to the actual result when nothing was recorded, so evRecorded false means "equals profitLoss because nothing was tracked" while evRecorded true means the EV was measured and happens to be what it is. Summing evProfitLoss over points whose evRecorded is all false just re-derives the P/L sum — that is the same subset stats_summary reports as null. sortKey (startedAt, falling back to sessionDate) is what orders same-day sessions. Same filter rules as stats_summary (currencyId required unless normalized, which only lifts that requirement — it converts nothing, so currency amounts returned across a multi-currency scope are raw sums). ${DATE_CONVENTIONS}`,
		inputSchema: statsFilterSchema,
	},
	{
		name: "room_list",
		procedurePath: "room.list",
		description:
			"List the user's active poker rooms (venues/apps they play at), including favorites and archivedAt. Set includeArchived to list archived rooms instead. Use active ids as roomId for new data; archived rooms retain existing references.",
		inputSchema: roomListInputSchema,
	},
	{
		name: "asset_list",
		procedurePath: "asset.list",
		description:
			"List the user's assets: currencies and items (for example tournament tickets), with kind, decimals, unit and balance. balance is the signed sum of every real ledger line of the asset, as an integer in its smallest unit (decimals is the number of digits after the point); for an item it is the number held. It already includes the buy-ins of entries still in play, and virtual lines never count. Archived assets are left out unless includeArchived is true, which returns active and archived ones together. Use the returned ids wherever a tool asks for an assetId or a currencyId.",
		inputSchema: assetListInputSchema,
	},
	{
		name: "asset_rate_list",
		procedurePath: "assetRate.list",
		description:
			"List the exchange rates between the user's assets. A rate states that one smallest unit of baseAssetId is worth rateNum / rateDen smallest units of quoteAssetId, from effectiveFrom on (the Unix epoch means from the beginning). Without effectiveAt it returns the whole history, ordered by pair and then newest effectiveFrom first. With effectiveAt (Unix seconds) it returns, for each base/quote direction, only the rate in force at that instant: the latest effectiveFrom at or before it. Only stored directions are returned; no reciprocal or chained rate is derived. baseAssetId and quoteAssetId filter by ids from asset_list.",
		inputSchema: assetRateListInputSchema,
	},
	{
		name: "user_setting_get",
		procedurePath: "userSetting.get",
		description:
			"Get the user's settings: baseAssetId, the currency asset converted figures are reported in (null means conversion is not configured), and timeZone, the IANA zone that dates live play by (null means Asia/Tokyo). Both apply to past records as well: converted figures always use the current base, and each line uses the rate in force at its own time, so changing the base or a past rate changes past converted figures.",
	},
	{
		name: "player_list",
		procedurePath: "player.list",
		description:
			"List the user's tracked opponents, excluding their own Hero (self) player and temporary players. Optional: search (name substring), tagIds (player_tag_list ids; a player matches when it has any of them).",
		inputSchema: playerListInputSchema,
	},
	{
		name: "hand_list",
		procedurePath: "hand.list",
		description:
			"List the hands of one play session (one day of an entry), highest handNo first, limit 1-50 per page (default 20). Returns { items, nextCursor }: pass nextCursor back as cursor for the next page; null means there is no further page. A cursor only works with the playSessionId it came from. The play session's hand count is the number of its hands and its current button is buttonSeat of the hand with the highest handNo. Each item carries detail (count | summary | full), playedAt (null for hands migrated from the old hand counter), button seat, stakes snapshot, boards and seats; use hand_get_by_id for the actions. Deleting a hand renumbers the later ones, so paging across a deletion can repeat a hand but never skips one.",
		inputSchema: handListInputSchema,
	},
	{
		name: "hand_get_by_id",
		procedurePath: "hand.getById",
		description:
			"Get one hand by id with its boards, seats, actions (ordered by seq) and tags (with reviewedAt). Use hand_list to find hand ids.",
		inputSchema: handIdInputSchema,
	},
	{
		name: "entry_list",
		procedurePath: "entry.list",
		description: `List the user's entries (one cash game or tournament each, possibly spanning several days), newest playedOn first, limit 1-100 per page (default 20). Returns { items, nextCursor }: pass nextCursor back as cursor with the same filters for the next page; null means no further page. Optional filters: kind (cash | tournament), status (open = live and still in play, settled), roomId, assetId (entries with any money line in that asset), dateFrom/dateTo (inclusive, compared with playedOn). ${ENTRY_OUTPUT}`,
		inputSchema: entryListInputSchema,
	},
	{
		name: "entry_get_by_id",
		procedurePath: "entry.getById",
		description: `Get one entry by id. ${ENTRY_OUTPUT}`,
		inputSchema: entryIdInputSchema,
	},
	{
		name: "entry_create_cash",
		procedurePath: "entry.create",
		description: `Record a finished cash-game entry (kind must be "cash"). ${ENTRY_WRITE} Link a ring game with ringGameId (ring_game_list_by_room; archived ones are rejected — restore first) to use its current rule, or pass rule to record the table's rule for this entry: rule.game picks { variantId } or { gameMixId } (built-in NLH when omitted) and rule.stakes must give each lineup group's blinds. ${STAKE_BLINDS} evDiff is the signed all-in EV difference in the entry's asset smallest unit.`,
		inputSchema: entryCreateCashInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "entry_create_tournament",
		procedurePath: "entry.create",
		description: `Record a finished tournament entry (kind must be "tournament"). ${ENTRY_WRITE} Link a tournament with tournamentId (tournament_list_by_room; archived ones are rejected — restore first) to use its current rule, or pass rule to record this entry's own structure (${TOURNAMENT_RULE_CONTRACT}). A payment may carry priceId only for a price of the linked tournament's current rule as tournament_get_by_id returns it, and only without rule: its asset must match, an entry price pays buy_in or fee, a reentry price reentry or fee, an addon price chip_purchase or fee. placement and totalEntries are positive integers and placement must be <= totalEntries; with beforeDeadline true no placement is stored.`,
		inputSchema: entryCreateTournamentInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "entry_update",
		procedurePath: "entry.update",
		description: `Update an entry by id. Only supplied fields change; pass null to clear roomId, assetId, title, memo, evDiff, placement or totalEntries. kind, source, the linked master and the rule cannot be changed here. tagIds, playSessions and payments REPLACE the whole list when supplied — read entry_get_by_id first and send back everything you keep. To keep an existing day (and its hands), send its playSessions[].id; a day left out is deleted with its hands and a day without id is created. Top-level payments are only for a single-day entry. Sending playSessions whose first localDate differs from the stored playedOn needs playedOn too. Live entries (source "live") accept only roomId, assetId, title, memo and tagIds: their days, money and results come from their events. Cash entries reject tournament fields and tournament entries reject evDiff. ${ENTRY_WRITE_RULES}`,
		inputSchema: entryUpdateInputSchema,
		destructiveHint: true,
		idempotentHint: true,
	},
	{
		name: "entry_tag_list",
		procedurePath: "entryTag.list",
		description:
			"List the user's entry tags ordered by position. Use the returned ids as tagIds of entry tools.",
	},
	{
		name: "entry_tag_create",
		procedurePath: "entryTag.create",
		description:
			"Create an entry tag by name (trimmed, 1-50 characters). Names are unique per user ignoring case; a duplicate is rejected, so check entry_tag_list first. A user has at most 500 entry tags.",
		inputSchema: tagCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "tournament_tag_list",
		procedurePath: "tournamentTag.list",
		description:
			"List the user's tournament tags ordered by position. Use the returned ids as tagIds of tournament_create_with_levels and tournament_update_with_levels.",
	},
	{
		name: "tournament_tag_create",
		procedurePath: "tournamentTag.create",
		description:
			"Create a tournament tag by name (trimmed, 1-50 characters). Names are unique per user ignoring case; a duplicate is rejected, so check tournament_tag_list first. A user has at most 500 tournament tags.",
		inputSchema: tagCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "hand_tag_list",
		procedurePath: "handTag.list",
		description:
			"List the user's hand tags ordered by position. hand_get_by_id and hand_list return the tags attached to each hand.",
	},
	{
		name: "hand_tag_create",
		procedurePath: "handTag.create",
		description:
			"Create a hand tag by name (trimmed, 1-50 characters). Names are unique per user ignoring case; a duplicate is rejected, so check hand_tag_list first. A user has at most 500 hand tags.",
		inputSchema: tagCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "player_tag_list",
		procedurePath: "playerTag.list",
		description:
			"List the user's player tags ordered by position, with their color. Use the returned ids as tagIds of player_list.",
	},
	{
		name: "player_tag_create",
		procedurePath: "playerTag.create",
		description:
			"Create a player tag by name (trimmed, 1-50 characters) and optional color (default gray). Names are unique per user ignoring case; a duplicate is rejected, so check player_tag_list first. A user has at most 500 player tags.",
		inputSchema: playerTagCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "ring_game_list_by_room",
		procedurePath: "ringGame.listByRoom",
		description:
			"List the ring-game (cash-game) masters of one room. Each result includes currentRuleId, ruleVersion with lineupId and stakes, and lineups keyed by ID. Set includeArchived to also include archived ones.",
		inputSchema: ringGameListByRoomInputSchema,
	},
	{
		name: "tournament_list_by_room",
		procedurePath: "tournament.listByRoom",
		description:
			"List the tournament masters of one room, each with its current rule version (game, levels with stakes, prices) and a lineups map that names the games every lineupId points at. Set includeArchived to include archived ones alongside active ones.",
		inputSchema: tournamentListByRoomInputSchema,
	},

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
		name: "room_archive",
		procedurePath: "room.archive",
		description:
			"Archive a poker room so it stops appearing in pickers for new data. Reversible with room_restore; existing sessions and games keep their links. List archived rooms with room_list and includeArchived.",
		inputSchema: roomIdInputSchema,
		destructiveHint: false,
		idempotentHint: true,
	},
	{
		name: "room_restore",
		procedurePath: "room.restore",
		description:
			"Restore an archived poker room so it appears in pickers again.",
		inputSchema: roomIdInputSchema,
		destructiveHint: false,
		idempotentHint: true,
	},
	{
		name: "ring_game_create",
		procedurePath: "ringGame.create",
		description: `Create a ring-game master inside a room. Supply roomId, name, and rule; defaultAssetId and memo are optional. The rule holds game, stakes, minBuyIn, maxBuyIn, tableSize, and houseRules; minBuyIn must not exceed maxBuyIn. If game is omitted, the builtin NLH lineup is used. ${RING_GAME_RULE} ${AMOUNT_CONVENTIONS}`,
		inputSchema: ringGameCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "ring_game_update",
		procedurePath: "ringGame.update",
		description: `Update a ring-game master by id. Supplied rule fields merge with the current rule; omitted fields stay unchanged and nullable fields can be cleared with null. The resulting minBuyIn must not exceed maxBuyIn. A changed rule creates an immutable version; unchanged content reuses the current version. Read ring_game_list_by_room for the current rule and lineup. ${RING_GAME_RULE} ${AMOUNT_CONVENTIONS}`,
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
			"Get one tournament master by id with its current rule version: ruleVersion.levels (ordinal, level number or null for a break, minutes, game null = plays the rule's game, stakes per game group with blind1-3 / ante / anteType), ruleVersion.prices, and lineups (lineupId -> display name and groups). Read this before tournament_update_with_levels — that tool replaces the whole level list.",
		inputSchema: tournamentIdInputSchema,
	},
	{
		name: "tournament_create_with_levels",
		procedurePath: "tournament.createWithLevels",
		description: `Create a tournament master inside a room with its first rule version and tags in one call. Required: roomId, name, rule.levels (may be empty). rule.game defaults to NL Hold'em. defaultAssetId (asset_list) is the asset sessions default to. tagIds are tournament tag ids from tournament_tag_list (unique, at most 100). ${TOURNAMENT_RULE_CONTRACT}`,
		inputSchema: tournamentCreateWithLevelsInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "tournament_update_with_levels",
		procedurePath: "tournament.updateWithLevels",
		description: `Update a tournament master by id. rule.levels is REQUIRED and REPLACES the entire level list — read tournament_get_by_id first and send back the full list, or the existing levels are lost. Omitted rule fields (game, startingStack, tableSize, bountyAmount, houseRules, prices) keep the current version's values. tagIds (tournament_tag_list ids, unique, at most 100) REPLACES the whole tag list when supplied — send back every tag you keep; [] removes all, omitted keeps them. ${TOURNAMENT_RULE_CONTRACT}`,
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
			"List the user's game groups (the families game variants belong to, e.g. Hold'em / Omaha), including the labels their three blind fields use and whether each field is required (blind1Required-blind3Required). Archived groups are omitted unless includeArchived is true.",
		inputSchema: gameGroupListInputSchema,
	},
	{
		name: "game_group_create",
		procedurePath: "gameGroup.create",
		description:
			"Create a game group. label must be unique across the user's groups, ignoring case and surrounding spaces, archived groups included — a label held by an archived group is rejected with a hint to restore that group with game_group_restore instead. The blind label fields name that family's blind columns (e.g. SB / BB). blind1Required-blind3Required (default false) mark a field that every newly written stake must fill; only a labeled field can be required.",
		inputSchema: gameGroupCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "game_group_update",
		procedurePath: "gameGroup.update",
		description:
			"Update a game group by id. Only the supplied fields change; pass null to clear a blind label. Only a labeled field can be required, so clearing the label of a required field needs its blindNRequired false in the same call. Clearing a label is rejected while any saved ring-game or tournament stake still has a value in that field. Renaming it re-labels every variant shown under it, and for a user-created group it also moves the group's position in game_group_list — which is the entry order mixGames must use.",
		inputSchema: gameGroupUpdateInputSchema,
		destructiveHint: true,
		idempotentHint: true,
	},
	{
		name: "game_group_archive",
		procedurePath: "gameGroup.archive",
		description:
			"Archive a game group so it stops appearing in game_group_list and cannot be picked for new variants. Reversible with game_group_restore; existing variants and records keep their link, name and blind labels. Rejected while any active variant still belongs to the group — archive those variants first.",
		inputSchema: gameGroupIdInputSchema,
		destructiveHint: false,
		idempotentHint: true,
	},
	{
		name: "game_group_restore",
		procedurePath: "gameGroup.restore",
		description:
			"Restore an archived game group so it appears in game_group_list and can be picked again.",
		inputSchema: gameGroupIdInputSchema,
		destructiveHint: false,
		idempotentHint: true,
	},
	{
		name: "game_variant_list",
		procedurePath: "gameVariant.list",
		description:
			"List the user's game variants (NLH, PLO, …) with their group and short labels. Use a variant's label as the variant field of a rule master. Archived variants are omitted unless includeArchived is true.",
		inputSchema: gameVariantListInputSchema,
	},
	{
		name: "game_variant_create",
		procedurePath: "gameVariant.create",
		description:
			"Create a game variant inside an active group. label must be unique across the user's variants, ignoring case and surrounding spaces, archived variants included — a label held by an archived variant is rejected with a hint to restore it with game_variant_restore instead. A mix may share a variant's label. shortLabel is the compact form shown in mixes and blind levels.",
		inputSchema: gameVariantCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "game_variant_update",
		procedurePath: "gameVariant.update",
		description:
			"Update a game variant by id. Only supplied fields change; pass null to clear shortLabel. Ring-game lineups reference variants by ID: renaming changes their displayed labels without changing saved composition, and moving a variant to another group affects future lineups but not existing lineup structures. Legacy tournament rules and sessions store labels, so renaming does not rewrite their stored text. Tournament edits require the full blindLevels list; read tournament_get_by_id first.",
		inputSchema: gameVariantUpdateInputSchema,
		destructiveHint: true,
		idempotentHint: true,
	},
	{
		name: "game_variant_archive",
		procedurePath: "gameVariant.archive",
		description:
			"Archive a game variant so it stops appearing in game_variant_list and cannot be added to a mix. Reversible with game_variant_restore; mixes, lineups and hands already naming it keep their link and label. Rejected while an active game mix contains it — remove it from that mix or archive the mix first.",
		inputSchema: gameVariantIdInputSchema,
		destructiveHint: false,
		idempotentHint: true,
	},
	{
		name: "game_variant_restore",
		procedurePath: "gameVariant.restore",
		description:
			"Restore an archived game variant so it appears in game_variant_list again. Rejected while its group is archived — restore the group first with game_group_restore.",
		inputSchema: gameVariantIdInputSchema,
		destructiveHint: false,
		idempotentHint: true,
	},
	{
		name: "game_mix_list",
		procedurePath: "gameMix.list",
		description:
			"List the user's game mixes (named rotations such as HORSE) and the variants each one contains. Archived mixes are omitted unless includeArchived is true.",
		inputSchema: gameMixListInputSchema,
	},
	{
		name: "game_mix_create",
		procedurePath: "gameMix.create",
		description:
			"Create a game mix from existing active variants. label must be unique across the user's mixes, ignoring case and surrounding spaces, archived mixes included — a label held by an archived mix is rejected with a hint to restore it with game_mix_restore instead. A variant may share the mix's label. games lists the variant ids in rotation order and may not repeat one.",
		inputSchema: gameMixCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "game_mix_update",
		procedurePath: "gameMix.update",
		description:
			"Update a game mix by id. Only supplied fields change, except that games REPLACES the whole rotation — read game_mix_list first (with includeArchived: true when the mix is archived) and send back the full list. Sending label alone leaves games untouched. Existing ring-game lineups retain their saved composition when the mix changes; selecting the mix again uses its current rotation. Renaming changes their displayed mix name without changing their composition.",
		inputSchema: gameMixUpdateInputSchema,
		destructiveHint: true,
		idempotentHint: true,
	},
	{
		name: "game_mix_archive",
		procedurePath: "gameMix.archive",
		description:
			"Archive a game mix so it stops appearing in game_mix_list. Reversible with game_mix_restore; lineups already using it keep their link.",
		inputSchema: gameMixIdInputSchema,
		destructiveHint: false,
		idempotentHint: true,
	},
	{
		name: "game_mix_restore",
		procedurePath: "gameMix.restore",
		description:
			"Restore an archived game mix so it appears in game_mix_list again. Rejected while any of its variants is archived — restore them first with game_variant_restore.",
		inputSchema: gameMixIdInputSchema,
		destructiveHint: false,
		idempotentHint: true,
	},
];

const ENTITY_NAMES: Record<string, string> = {
	stats: "statistics",
	entry: "entries",
	entryTag: "entry tags",
	tournamentTag: "tournament tags",
	handTag: "hand tags",
	playerTag: "player tags",
	room: "rooms",
	asset: "assets",
	assetRate: "asset rates",
	userSetting: "settings",
	player: "players",
	hand: "hands",
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

export function toolPermissionSummary(): string[] {
	const readable = entityNames((def) => toolAnnotations(def).readOnlyHint);
	const writable = entityNames((def) => !toolAnnotations(def).readOnlyHint);
	const overwritable = entityNames(
		(def) => toolAnnotations(def).destructiveHint === true
	);

	const permissions = [`Read your ${humanList(readable)}`];
	if (writable.length > 0) {
		permissions.push(`Create or change your ${humanList(writable)}`);
	}
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

export const DELIBERATELY_EXCLUDED: {
	reason: string;
	paths: string[];
}[] = [
	{
		reason: "Infra/debug endpoints with no agent value",
		paths: ["healthCheck"],
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
			"Irreversible master deletion: these masters have reversible archive/restore counterparts, which are exposed instead. Deletion is refused while records reference the master",
		paths: [
			"room.delete",
			"ringGame.delete",
			"tournament.delete",
			"gameGroup.delete",
			"gameVariant.delete",
			"gameMix.delete",
		],
	},
	{
		reason:
			"Screen-only Undo: restore an existing ring-game rule version without creating another version",
		paths: ["ringGame.restoreRule"],
	},
	{
		reason:
			"Destructive: deleting a tag removes it from every entry, tournament, hand or player it is linked to, and no API can restore the links",
		paths: [
			"entryTag.delete",
			"tournamentTag.delete",
			"handTag.delete",
			"playerTag.delete",
		],
	},
	{
		reason:
			"Toggle semantics are not idempotent — a retried call silently reverses the previous one, which a model cannot detect",
		paths: ["room.toggleFavorite", "asset.toggleFavorite"],
	},
	{
		reason:
			"Superseded by the WithLevels variants, which are supersets: exposing both invites the model to pick the lesser one and then be unable to set blind levels",
		paths: ["tournament.create", "tournament.update"],
	},
	{
		reason:
			"Rule-version history is browsed and restored on the tournament screen; the tools expose only the current version, so a model has no version ids to restore from",
		paths: ["tournament.restoreRule"],
	},
	{
		reason:
			"Outside the requested MCP scope: players are opponent notes maintained on the player screens, not rooms or game masters",
		paths: ["player.create", "player.update", "player.delete"],
	},
	{
		reason:
			"Wallet: assets and rates define how every balance and converted figure is read, so creating, editing, archiving or restoring them belongs to the asset screens; asset_list and asset_rate_list expose them read-only",
		paths: [
			"asset.create",
			"asset.update",
			"asset.archive",
			"asset.restore",
			"assetRate.create",
		],
	},
	{
		reason:
			"Destructive: deleting an asset or a rate cannot be undone, and a deleted rate silently changes every past converted figure that used it",
		paths: ["asset.delete", "assetRate.delete"],
	},
	{
		reason:
			"Wallet: an asset's history, deposits and withdrawals, exchanges and their categories belong to the wallet screens; asset_list exposes the resulting balances read-only, and entry money changes only through the entry itself",
		paths: [
			"ledger.listByAsset",
			"ledger.createAdjustment",
			"ledger.createExchange",
			"ledger.update",
			"ledgerCategory.list",
			"ledgerCategory.create",
			"ledgerCategory.update",
			"ledgerCategory.archive",
			"ledgerCategory.restore",
		],
	},
	{
		reason:
			"Destructive: deleting a wallet line (both legs of an exchange) or a category cannot be undone; a referenced category is archived instead",
		paths: ["ledger.delete", "ledgerCategory.delete"],
	},
	{
		reason:
			"asset.list already returns these rows, so a by-id tool would be a second way to read the same data",
		paths: ["asset.getById"],
	},
	{
		reason:
			"Screen settings: the base asset and time zone change how every past figure and live date is shown, so they are edited on the settings screen; user_setting_get exposes them read-only",
		paths: ["userSetting.update"],
	},
	{
		reason:
			"Tag maintenance: renaming a tag relabels every entry, tournament, hand or player it is linked to, and recoloring a player tag restyles every opponent, which belongs to the tag screen; the *_tag_list and *_tag_create tools cover what an agent needs to attach tags",
		paths: [
			"entryTag.update",
			"tournamentTag.update",
			"handTag.update",
			"playerTag.update",
		],
	},
	{
		reason:
			"Screen ordering: tag order is arranged by drag on the tag screen and every call must list all tags of the kind; list order does not change what a tag means",
		paths: [
			"entryTag.reorder",
			"tournamentTag.reorder",
			"handTag.reorder",
			"playerTag.reorder",
		],
	},
	{
		reason:
			"Destructive: deleting an entry removes its days, hands and money lines, and no API can restore them",
		paths: ["entry.delete"],
	},
	{
		reason:
			"player.list already returns these rows, so a by-id tool would be a second way to read the same data",
		paths: ["player.getById"],
	},
	{
		reason:
			"Cockpit identity: the live table screen reads the Hero identity; an agent has no use for it and player_list deliberately hides it",
		paths: ["player.getSelf"],
	},
	{
		reason:
			"Cockpit: the live hand counter's +1 and undo belong to the table screen and are allowed only while the play session is active; a retried call silently adds or removes a hand, which a model cannot detect",
		paths: ["hand.add", "hand.undoLast"],
	},
	{
		reason:
			"Destructive: deleting a hand drops its boards, seats and actions and renumbers the later hands, and no API can restore them",
		paths: ["hand.delete"],
	},
	{
		reason:
			"Cockpit: live recording follows the table in real time — starts, completions, events and seat changes are timestamped as they happen and retried calls append duplicate events; agents record finished play through the entry tools",
		paths: [
			"live.list",
			"live.getById",
			"live.create",
			"live.update",
			"live.complete",
			"live.discard",
			"playEvent.list",
			"playEvent.create",
			"playEvent.update",
			"playEvent.delete",
			"tablePlayer.list",
			"tablePlayer.add",
			"tablePlayer.addNew",
			"tablePlayer.addTemporary",
			"tablePlayer.updateSeat",
			"tablePlayer.remove",
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
