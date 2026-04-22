import { useQuery } from "@tanstack/react-query";
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

	const cashQuery = useQuery({
		...trpc.liveCashGameSession.list.queryOptions({
			status: "active",
			limit: 5,
		}),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		enabled: parsed.sessionType !== "tournament",
	});

	const tournamentQuery = useQuery({
		...trpc.liveTournamentSession.list.queryOptions({
			status: "active",
			limit: 5,
		}),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		enabled: parsed.sessionType !== "cash_game",
	});

	const isLoading = cashQuery.isLoading || tournamentQuery.isLoading;
	const cashItems: CashItem[] =
		parsed.sessionType === "tournament" ? [] : (cashQuery.data?.items ?? []);
	const tournamentItems: TournamentItem[] =
		parsed.sessionType === "cash_game"
			? []
			: (tournamentQuery.data?.items ?? []);

	return { isLoading, cashItems, tournamentItems };
}
