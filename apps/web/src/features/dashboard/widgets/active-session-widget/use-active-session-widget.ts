import { useQuery } from "@tanstack/react-query";
import {
	resolveSessionType,
	useGlobalFilter,
} from "@/features/dashboard/hooks/use-global-filter";
import {
	parseSessionType,
	type SessionTypeFilter,
} from "@/features/dashboard/utils/session-filter";
import { trpc } from "@/utils/trpc";

export type ActiveSessionWidgetSessionType = SessionTypeFilter;

interface ParsedConfig {
	type: ActiveSessionWidgetSessionType;
}

export function parseActiveSessionWidgetConfig(
	raw: Record<string, unknown>
): ParsedConfig {
	// Legacy configs persisted the field as `sessionType`; read it as a fallback
	// so existing dashboards keep their selection after the rename.
	return { type: parseSessionType(raw.type ?? raw.sessionType) };
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
	const effectiveType = resolveSessionType(parsed.type, globalFilter);

	const cashQuery = useQuery({
		...trpc.liveCashGameSession.list.queryOptions({
			status: "active",
			limit: 5,
		}),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		enabled: effectiveType !== "tournament",
	});

	const tournamentQuery = useQuery({
		...trpc.liveTournamentSession.list.queryOptions({
			status: "active",
			limit: 5,
		}),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		enabled: effectiveType !== "cash_game",
	});

	const isLoading = cashQuery.isLoading || tournamentQuery.isLoading;
	const cashItems: CashItem[] =
		effectiveType === "tournament" ? [] : (cashQuery.data?.items ?? []);
	const tournamentItems: TournamentItem[] =
		effectiveType === "cash_game" ? [] : (tournamentQuery.data?.items ?? []);

	return { isLoading, cashItems, tournamentItems };
}
