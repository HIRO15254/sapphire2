import { variantDisplayLabel } from "@sapphire2/db/constants/game-variants";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { StatsSectionContext } from "@/features/statistics/types";
import {
	formatMinutes,
	formatStatAmount,
} from "@/features/statistics/utils/format-stats";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";
import { trpc } from "@/utils/trpc";

/** Server-side grouping dimensions surfaced as tabs in the breakdown UI. */
export type BreakdownGroupBy =
	| "room"
	| "stakes"
	| "variant"
	| "dayOfWeek"
	| "length"
	| "month";

export interface BreakdownTab {
	label: string;
	value: BreakdownGroupBy;
}

/**
 * A single breakdown table row, fully formatted for rendering. `netText` is the
 * currency value (shown when normalization is off); `cashText` (bb) and
 * `tournamentText` (bi) are the normalized values, kept apart because bb and bi
 * are on different scales and must never be combined.
 */
export interface BreakdownViewRow {
	cashColor: string;
	cashText: string;
	key: string;
	label: string;
	netColor: string;
	netText: string;
	playTimeText: string;
	sessions: number;
	tournamentColor: string;
	tournamentText: string;
}

export interface UseBreakdownSectionResult {
	activeTab: BreakdownGroupBy;
	isPending: boolean;
	normalized: boolean;
	rows: BreakdownViewRow[];
	setActiveTab: (tab: BreakdownGroupBy) => void;
	showCashColumn: boolean;
	showTournamentColumn: boolean;
	tabs: BreakdownTab[];
}

const TAB_LABELS: Record<BreakdownGroupBy, string> = {
	room: "Room",
	stakes: "Stakes",
	variant: "Variant",
	dayOfWeek: "Day of week",
	length: "Length",
	month: "Month",
};

/**
 * The grouping tabs available for the current game-type filter. `stakes` is
 * meaningful for cash games only (tournaments / "all" have no big-blind stake),
 * so it is added between `room` and the time-based dimensions when, and only
 * when, the type filter is pinned to cash game. `variant` is meaningful for
 * every type filter, positioned after room/stakes and before the time-based
 * dimensions.
 */
function availableTabs(ctx: StatsSectionContext): BreakdownTab[] {
	const values: BreakdownGroupBy[] =
		ctx.type === "cash_game"
			? ["room", "stakes", "variant", "dayOfWeek", "length", "month"]
			: ["room", "variant", "dayOfWeek", "length", "month"];
	return values.map((value) => ({ value, label: TAB_LABELS[value] }));
}

interface BreakdownGroup {
	cashNormalizedProfitLoss: number | null;
	key: string;
	label: string;
	playMinutes: number;
	profitLoss: number;
	sessions: number;
	tournamentNormalizedProfitLoss: number | null;
}

/**
 * The server returns the raw variant string as both key and label (a mix
 * session groups as a single "mix" bucket). Only the "variant" tab maps that
 * raw string through `variantDisplayLabel` for display — "mix" resolves to
 * "Mixed Game", every other stored variant is already a display label (or a
 * legacy cached preset key) and passes through verbatim. Every other tab
 * keeps the server's label as-is.
 */
function toViewRow(
	group: BreakdownGroup,
	currencyUnit: string | null,
	activeTab: BreakdownGroupBy
): BreakdownViewRow {
	return {
		key: group.key,
		label:
			activeTab === "variant" ? variantDisplayLabel(group.label) : group.label,
		sessions: group.sessions,
		netText: formatProfitLoss(group.profitLoss, { currencyUnit }),
		netColor: profitLossColorClass(group.profitLoss),
		cashText: formatStatAmount(group.cashNormalizedProfitLoss, "bb"),
		cashColor: profitLossColorClass(group.cashNormalizedProfitLoss),
		tournamentText: formatStatAmount(
			group.tournamentNormalizedProfitLoss,
			"bi"
		),
		tournamentColor: profitLossColorClass(group.tournamentNormalizedProfitLoss),
		playTimeText: formatMinutes(group.playMinutes),
	};
}

/**
 * Drives the breakdown analysis section: owns the active grouping tab, runs the
 * `stats.breakdown` query for that grouping, and turns each server row into a
 * fully formatted view model. The active tab is always coerced to a currently
 * available dimension, so switching the type filter away from cash game while
 * `stakes` is selected never sends an invalid grouping to the server.
 */
export function useBreakdownSection(
	ctx: StatsSectionContext
): UseBreakdownSectionResult {
	const [selectedTab, setSelectedTab] = useState<BreakdownGroupBy>("room");

	const tabs = availableTabs(ctx);
	const activeTab = tabs.some((tab) => tab.value === selectedTab)
		? selectedTab
		: "room";

	const query = useQuery(
		trpc.stats.breakdown.queryOptions(
			{ ...ctx.statsInput, groupBy: activeTab },
			{ enabled: ctx.enabled }
		)
	);

	const groups = (query.data?.groups ?? []) as BreakdownGroup[];
	const rows = groups.map((group) =>
		toViewRow(group, ctx.currencyUnit, activeTab)
	);

	// In normalized mode bb / bi are separate columns; hide a column when no
	// group has a value for it (e.g. a cash-only scope has no bi figures).
	const showCashColumn =
		ctx.normalized && groups.some((g) => g.cashNormalizedProfitLoss !== null);
	const showTournamentColumn =
		ctx.normalized &&
		groups.some((g) => g.tournamentNormalizedProfitLoss !== null);

	return {
		tabs,
		activeTab,
		setActiveTab: setSelectedTab,
		rows,
		normalized: ctx.normalized,
		showCashColumn,
		showTournamentColumn,
		isPending: ctx.enabled && query.isPending,
	};
}
