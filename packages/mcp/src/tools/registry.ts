import { assetListInputSchema } from "@sapphire2/api/routers/asset";
import { assetRateListInputSchema } from "@sapphire2/api/routers/asset-rate";
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

export const MIX_RULE =
	'A mixed-game rule is variant + mixGames together: variant must be the label of a game mix from game_mix_list (or the legacy "mix" sentinel), and mixGames its rotation. Sending mixGames without such a variant is rejected. For an available named mix, mixGames must reproduce that mix EXACTLY: one entry per game group its variants belong to, entries in the order game_group_list returns those groups, and each entry naming its variants by their game_variant_list label in the mix\'s own games order. Note game_mix_list returns variant IDS, not labels, so build the labels from game_variant_list. Any other grouping or order is rejected as "references an unavailable game master" — the message names ownership, but the cause is usually shape. If a named mix is no longer available, an update can retain its stored variant and exact ordered mixGames structure. The legacy "mix" sentinel is the loose form: owned variant labels, or labels already stored on the ring game when retaining that sentinel, grouped and ordered however you like, except that the variants of each entry must belong to ONE game group (their groupId in game_variant_list) — an entry spanning two groups is rejected with "must share a game group". On update, an entry whose variants span groups may be sent back using only labels from one entry already stored on the ring game being updated; create has no such exception. While a mix is set, the top-level blind1-3, ante and anteType are always stored as null, so values sent for those flat fields are dropped — the blinds of a mix live on each mixGames entry instead (its own blind1-3 / ante / anteType, per group).';

export const LEVEL_GAMES_RULE =
	'A blind level may carry games: groups of variant labels, each with its own blind1-3 / ante, played in rotation during that level. The known variants of each group must belong to ONE game group (their groupId in game_variant_list) — a group spanning two is rejected with "must share a game group". On update, a group spanning game groups may be sent back using only labels from one group already stored on the tournament being updated; create has no such exception.';

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
			"List the user's tracked opponents/players. Optional: search (name substring), tagIds (player-tag ids).",
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
			"Get one hand by id with its boards, seats and actions (ordered by seq). Use hand_list to find hand ids.",
		inputSchema: handIdInputSchema,
	},
	{
		name: "session_tag_list",
		procedurePath: "sessionTag.list",
		description: "List the user's session tags.",
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
			"List the ring-game (cash-game) rule masters of one room — blinds, variant, buy-in range. Set includeArchived to list archived ones instead.",
		inputSchema: ringGameListByRoomInputSchema,
	},
	{
		name: "tournament_list_by_room",
		procedurePath: "tournament.listByRoom",
		description:
			"List the tournament masters of one room — buy-in, starting stack, chip purchases, and blindLevelCount (the number of blind levels, not the levels themselves; tournament_get_by_id returns those). Set includeArchived to list archived ones instead.",
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
		description: `Create a ring-game (cash-game) rule master inside a room: blinds, ante, buy-in range, table size, and free-text houseRules (the table's rules — memo is a separate note about the master). Sessions linked to it copy these values at link time. Required: roomId, name. When both buy-in bounds are supplied, minBuyIn must be <= maxBuyIn. ${MIX_RULE} variant defaults to a non-mixed label, so a create that passes mixGames must set variant too. ${AMOUNT_CONVENTIONS}`,
		inputSchema: ringGameCreateInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "ring_game_update",
		procedurePath: "ringGame.update",
		description: `Update a ring-game rule master by id. Only the supplied fields change; pass null to clear a nullable one. When both resulting buy-in bounds are set, minBuyIn must be <= maxBuyIn; a one-sided update is checked against the stored opposite bound. Omit a bound to keep it, or pass null to remove that bound. ${MIX_RULE} To edit only the blinds of a mixed rule, echo back the mixGames that ring_game_list_by_room returned — but only while the mix master is untouched, because the check rebuilds the expected shape from the CURRENT variant labels and groups and the mix's current games. After a game_mix_update that replaced games, a game_variant_update that changed a label or group, or a game_group_update that renamed a user-created group (those sort by label, and that order is the entry order), rebuild mixGames from the current masters instead. Renaming the mix inverts that: variant is a copied label rather than a foreign key, so it stops resolving and the stored mixGames becomes the reference instead of the masters — send its grouping and variant labels back unchanged (only the per-entry blinds may differ), or set variant to the new mix label and send a rebuilt mixGames. To move a mixed rule back to flat blinds, set variant to a non-mixed label — that clears mixGames for you. Sending mixGames: null on its own is rejected either way, because leaving variant unchanged keeps the rule mixed. ring_game_list_by_room lists either active or archived rules, so pass includeArchived to find archived ones. Rules without a roomId never appear in that list and cannot be assigned a room here. Editing a rule does not change existing sessions' frozen snapshots. ${AMOUNT_CONVENTIONS}`,
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
		description: `Create a tournament master inside a room, together with its blind levels, chip purchases and tags in one call. Required: roomId, name. blindLevels are ordered as given (level 1 first); every row requires isBreak (true for a break, false for a playing level). ${LEVEL_GAMES_RULE} ${AMOUNT_CONVENTIONS}`,
		inputSchema: tournamentCreateWithLevelsInputSchema,
		destructiveHint: false,
		idempotentHint: false,
	},
	{
		name: "tournament_update_with_levels",
		procedurePath: "tournament.updateWithLevels",
		description: `Update a tournament master by id. blindLevels is REQUIRED and REPLACES the entire structure — read tournament_get_by_id first and send back the full list, or the existing levels are lost. tags and chipPurchases replace their lists too when supplied. ${LEVEL_GAMES_RULE} ${AMOUNT_CONVENTIONS}`,
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
			"List the user's game groups (the families game variants belong to, e.g. Hold'em / Omaha), including the labels their three blind fields use. Archived groups are omitted unless includeArchived is true.",
		inputSchema: gameGroupListInputSchema,
	},
	{
		name: "game_group_create",
		procedurePath: "gameGroup.create",
		description:
			"Create a game group. label must be unique across the user's groups, ignoring case and surrounding spaces, archived groups included — a label held by an archived group is rejected with a hint to restore that group with game_group_restore instead. The blind label fields name that family's blind columns (e.g. SB / BB / straddle).",
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
			'Update a game variant by id. Only the supplied fields change; pass null to clear shortLabel. Renaming rewrites NOTHING already stored: sessions and rule masters keep the label text they were written with, so a renamed variant splits into two buckets in stats_breakdown groupBy "variant" and renaming to tidy up past records leaves their text exactly as it was. It is not inert, though — those rows are tied back to this variant by that stored text alone, so moving it to another group (which is what names the blind fields) applies to every row still naming it, while a rename leaves the old ones matching no variant at all and falling back to generic SB / BB / Straddle blind labels, plus a third blind slot their real group may not have. To relabel rule masters — and to re-link those orphans — write the new label into each row instead: ring_game_update and tournament_update_with_levels accept variant, and a plain (non-mix) label needs no matching master row — except that tournament_update_with_levels also REQUIRES the full blindLevels list and replaces it, so read tournament_get_by_id and send that list back rather than an empty one. Recorded sessions cannot currently be relabeled through MCP. Either edit also changes the mixGames shape every mix containing this variant expects, so ring-game rules using such a mix need a rebuilt mixGames the next time they send one — updates touching neither variant nor mixGames stay unaffected.',
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
			"Update a game mix by id. Only the supplied fields change, with one exception: supplying games REPLACES the whole rotation — read game_mix_list first (with includeArchived: true when the mix is archived, since the default list hides it) and send back the full list. Sending label alone leaves games untouched. Replacing it also changes the mixGames shape ring-game rules using this mix must send when they next send one. Renaming it does the opposite: their variant keeps the old label, which no longer resolves, so from then on their mixGames is checked against their own stored grouping and variant labels rather than against this mix.",
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
	sessionTag: "session tags",
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
			"Irreversible deletion with NO archive counterpart on the router: creating a session tag is exposed but removing it is not, so a mistaken create leaves a row only the web UI can clear. Exposing delete instead would put an unrecoverable operation on the tool surface, which is the worse trade",
		paths: ["sessionTag.delete"],
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
			"Outside the requested MCP scope: players and player tags are opponent notes maintained on the player screens, not rooms or game masters",
		paths: [
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
			"Renaming a tag has no safe undo here: neither create nor update dedupes names, so a rename onto an existing one leaves two tags a model cannot tell apart, and delete is not exposed to clean up. sessionTag.create remains exposed for managing tags used by sessions and entries; renaming is a different operation and needs the dedupe question answered first",
		paths: ["sessionTag.update"],
	},
	{
		reason:
			"player.list already returns these rows, so a by-id tool would be a second way to read the same data",
		paths: ["player.getById"],
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
