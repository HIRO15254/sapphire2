import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { trpc } from "@/utils/trpc";

export type StatisticsSessionType = "all" | "cash_game" | "tournament";

export interface StatisticsSummary {
	avgPlacement: number | null;
	avgProfitLoss: number | null;
	itmRate: number | null;
	totalEvDiff: number | null;
	totalEvProfitLoss: number | null;
	totalPrizeMoney: number | null;
	totalProfitLoss: number;
	totalSessions: number;
	winRate: number;
}

export interface UseStatisticsPageResult {
	isLoading: boolean;
	sessionType: StatisticsSessionType;
	setSessionType: (type: StatisticsSessionType) => void;
	summary: StatisticsSummary | undefined;
}

export function useStatisticsPage(): UseStatisticsPageResult {
	const [sessionType, setSessionType] = useState<StatisticsSessionType>("all");

	const query = useQuery(
		trpc.session.list.queryOptions({
			type: sessionType === "all" ? undefined : sessionType,
		})
	);

	return {
		isLoading: query.isLoading,
		sessionType,
		setSessionType,
		summary: query.data?.summary as StatisticsSummary | undefined,
	};
}
