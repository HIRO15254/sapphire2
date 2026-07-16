import {
	formatMixSummary,
	type GameGroupLike,
} from "@/features/live-sessions/utils/game-scene-formatters";
import { createGroupFormatter } from "@/utils/format-number";

interface RingGameBlindFields {
	ante: number | null;
	anteType: string | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	mixGames?: GameGroupLike[] | null;
}

/**
 * Compact one-line summary of a cash game's blind structure plus ante, with an
 * optional trailing currency unit. Extracted from the legacy ring-game tab so
 * both the V2 row and any future surface share one implementation. Mix games
 * render their grouped summary ("Mix · Limit 400/800 · …") instead.
 */
export function formatRingGameBlinds(
	game: RingGameBlindFields,
	currencyUnit?: string | null
): string {
	if (game.mixGames && game.mixGames.length > 0) {
		const unitStr = currencyUnit ?? "";
		return [formatMixSummary(game.mixGames), unitStr].filter(Boolean).join(" ");
	}
	const fmt = createGroupFormatter([
		game.blind1,
		game.blind2,
		game.blind3,
		game.ante,
	]);

	const parts: string[] = [];
	if (game.blind1 != null) {
		parts.push(fmt(game.blind1));
	}
	if (game.blind2 != null) {
		parts.push(fmt(game.blind2));
	} else if (parts.length > 0) {
		parts.push("—");
	}
	if (game.blind3 != null) {
		parts.push(fmt(game.blind3));
	}

	const blindStr = parts.length > 0 ? parts.join("/") : "";

	let anteStr = "";
	if (game.ante != null && game.anteType !== "none" && game.anteType != null) {
		if (game.anteType === "bb") {
			anteStr = `(BBA:${fmt(game.ante)})`;
		} else if (game.anteType === "all") {
			anteStr = `(Ante:${fmt(game.ante)})`;
		}
	}

	const unitStr = currencyUnit ?? "";

	return [blindStr, anteStr, unitStr].filter(Boolean).join(" ");
}

interface TournamentBuyInFields {
	buyIn: number | null;
	entryFee: number | null;
}

/**
 * Compact `buyIn(+entryFee)` summary with an optional trailing currency unit.
 * Returns an empty string when no buy-in is set. Extracted from the legacy
 * tournament tab.
 */
export function formatTournamentBuyIn(
	tournament: TournamentBuyInFields,
	currencyUnit?: string | null
): string {
	if (tournament.buyIn == null) {
		return "";
	}
	const fmt = createGroupFormatter([tournament.buyIn, tournament.entryFee]);
	const unitStr = currencyUnit ? ` ${currencyUnit}` : "";
	if (tournament.entryFee != null) {
		return `${fmt(tournament.buyIn)}+${fmt(tournament.entryFee)}${unitStr}`;
	}
	return `${fmt(tournament.buyIn)}${unitStr}`;
}
