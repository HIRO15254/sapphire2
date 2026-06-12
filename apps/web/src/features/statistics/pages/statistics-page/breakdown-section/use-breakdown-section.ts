import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	type StatsSectionContext,
	statsValueUnit,
} from "@/features/statistics/types";
import {
	formatMinutes,
	formatPercent,
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
	| "dayOfWeek"
	| "hour"
	| "month";

export interface BreakdownTab {
	label: string;
	value: BreakdownGroupBy;
}

/** A single breakdown table row, fully formatted for rendering. */
export interface BreakdownViewRow {
	key: string;
	label: string;
	netColor: string;
	netText: string;
	playTimeText: string;
	sessions: number;
	winRateText: string;
}

export interface UseBreakdownSectionResult {
	activeTab: BreakdownGroupBy;
	isPending: boolean;
	rows: BreakdownViewRow[];
	setActiveTab: (tab: BreakdownGroupBy) => void;
	tabs: BreakdownTab[];
}

const TAB_LABELS: Record<BreakdownGroupBy, string> = {
	room: "Room",
	stakes: "Stakes",
	dayOfWeek: "Day of week",
	hour: "Hour",
	month: "Month",
};

/**
 * The grouping tabs available for the current game-type filter. `stakes` is
 * meaningful for cash games only (tournaments / "all" have no big-blind stake),
 * so it is added between `room` and the time-based dimensions when, and only
 * when, the type filter is pinned to cash game.
 */
function availableTabs(ctx: StatsSectionContext): BreakdownTab[] {
	const values: BreakdownGroupBy[] =
		ctx.type === "cash_game"
			? ["room", "stakes", "dayOfWeek", "hour", "month"]
			: ["room", "dayOfWeek", "hour", "month"];
	return values.map((value) => ({ value, label: TAB_LABELS[value] }));
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

	const unit = statsValueUnit(ctx);
	const rows: BreakdownViewRow[] = (query.data?.groups ?? []).map((group) => ({
		key: group.key,
		label: group.label,
		sessions: group.sessions,
		netText: formatProfitLoss(group.profitLoss, { currencyUnit: unit }),
		netColor: profitLossColorClass(group.profitLoss),
		winRateText: formatPercent(group.winRate),
		playTimeText: formatMinutes(group.playMinutes),
	}));

	return {
		tabs,
		activeTab,
		setActiveTab: setSelectedTab,
		rows,
		isPending: ctx.enabled && query.isPending,
	};
}
