import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export type RecentSessionsWidgetTypeFilter = "all" | "cash_game" | "tournament";

interface ParsedConfig {
	limit: number;
	type: RecentSessionsWidgetTypeFilter;
}

export function parseRecentSessionsWidgetConfig(
	raw: Record<string, unknown>
): ParsedConfig {
	const limit =
		typeof raw.limit === "number" && raw.limit > 0 && raw.limit <= 20
			? Math.floor(raw.limit)
			: 5;
	const type =
		raw.type === "cash_game" || raw.type === "tournament"
			? (raw.type as RecentSessionsWidgetTypeFilter)
			: ("all" as RecentSessionsWidgetTypeFilter);
	return { limit, type };
}

interface SessionItem {
	cashBuyIn: number | null;
	cashOut: number | null;
	id: string;
	kind: string;
	prizeMoney: number | null;
	ringGameName: string | null;
	sessionDate: string | Date;
	tournamentBuyIn: number | null;
	tournamentEntryFee: number | null;
	tournamentName: string | null;
}

interface UseRecentSessionsWidgetResult {
	isLoading: boolean;
	items: SessionItem[];
	limit: number;
}

export function useRecentSessionsWidget(
	config: Record<string, unknown>
): UseRecentSessionsWidgetResult {
	const parsed = parseRecentSessionsWidgetConfig(config);
	const query = useQuery(
		trpc.session.list.queryOptions({
			type: parsed.type === "all" ? undefined : parsed.type,
		})
	);

	const items = (query.data?.items ?? [])
		.map((item) => ({
			id: item.id,
			cashBuyIn: item.cashBuyIn ?? null,
			cashOut: item.cashOut ?? null,
			kind: item.kind,
			prizeMoney: item.prizeMoney ?? null,
			ringGameName: item.ringGameName ?? null,
			sessionDate: item.sessionDate,
			tournamentBuyIn: item.tournamentBuyIn ?? null,
			tournamentEntryFee: item.tournamentEntryFee ?? null,
			tournamentName: item.tournamentName ?? null,
		}))
		.slice(0, parsed.limit);

	return {
		isLoading: query.isLoading,
		items,
		limit: parsed.limit,
	};
}
