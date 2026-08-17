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
	isError: boolean;
	isPending: boolean;
	normalized: boolean;
	retry: () => void;
	rows: BreakdownViewRow[];
	setActiveTab: (tab: BreakdownGroupBy) => void;
	showCashColumn: boolean;
	showNetColumn: boolean;
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

	const showCashColumn =
		ctx.normalized && groups.some((g) => g.cashNormalizedProfitLoss !== null);
	const showTournamentColumn =
		ctx.normalized &&
		groups.some((g) => g.tournamentNormalizedProfitLoss !== null);
	const showNetColumn =
		ctx.normalized &&
		groups.some(
			(group) =>
				group.cashNormalizedProfitLoss === null &&
				group.tournamentNormalizedProfitLoss === null
		);

	return {
		tabs,
		activeTab,
		setActiveTab: setSelectedTab,
		rows,
		normalized: ctx.normalized,
		showCashColumn,
		isError: ctx.enabled && query.isError,
		retry: () => {
			query.refetch();
		},
		showNetColumn,
		showTournamentColumn,
		isPending: ctx.enabled && query.isPending,
	};
}
