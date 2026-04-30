import { useQuery } from "@tanstack/react-query";
import {
	resolveSessionTypeFilter,
	useGlobalFilter,
} from "@/features/dashboard/hooks/use-global-filter";
import { trpc } from "@/utils/trpc";

export type ActiveSessionWidgetSessionType = "all" | "cash_game" | "tournament";

interface ParsedConfig {
	sessionType: ActiveSessionWidgetSessionType;
}

export function parseActiveSessionWidgetConfig(
	raw: Record<string, unknown>
): ParsedConfig {
	const sessionType =
		raw.sessionType === "cash_game" || raw.sessionType === "tournament"
			? (raw.sessionType as ActiveSessionWidgetSessionType)
			: ("all" as ActiveSessionWidgetSessionType);
	return { sessionType };
}

interface CashItem {
	id: string;
	latestStackAmount: number | null;
	ringGameName: string | null;
	startedAt: string | Date | null;
}

interface TournamentItem {
	id: string;
	latestStackAmount: number | null;
	startedAt: string | Date | null;
	tournamentName: string | null;
}

interface UseActiveSessionWidgetResult {
	cashItems: CashItem[];
	isLoading: boolean;
	tournamentItems: TournamentItem[];
}

export function useActiveSessionWidget(
	config: Record<string, unknown>
): UseActiveSessionWidgetResult {
	const parsed = parseActiveSessionWidgetConfig(config);
	const globalFilter = useGlobalFilter();
	const effectiveSessionType = resolveSessionTypeFilter(
		parsed.sessionType,
		globalFilter
	);

	const cashQuery = useQuery({
		...trpc.liveCashGameSession.list.queryOptions({
			status: "active",
			limit: 5,
		}),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		enabled: effectiveSessionType !== "tournament",
	});

	const tournamentQuery = useQuery({
		...trpc.liveTournamentSession.list.queryOptions({
			status: "active",
			limit: 5,
		}),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		enabled: effectiveSessionType !== "cash_game",
	});

	const isLoading = cashQuery.isLoading || tournamentQuery.isLoading;
	const cashItems: CashItem[] =
		effectiveSessionType === "tournament" ? [] : (cashQuery.data?.items ?? []);
	const tournamentItems: TournamentItem[] =
		effectiveSessionType === "cash_game"
			? []
			: (tournamentQuery.data?.items ?? []);

	return { isLoading, cashItems, tournamentItems };
}
