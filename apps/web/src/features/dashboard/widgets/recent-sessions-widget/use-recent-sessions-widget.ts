import { useQuery } from "@tanstack/react-query";
import {
	resolveDateFromEpoch,
	resolveDateToEpoch,
	resolveSessionType,
	useGlobalFilter,
} from "@/features/dashboard/hooks/use-global-filter";
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
	id: string;
	profitLoss: number | null;
	ringGameName: string | null;
	sessionDate: string | Date;
	tournamentName: string | null;
	type: string;
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
	const globalFilter = useGlobalFilter();
	const effectiveType = resolveSessionType(parsed.type, globalFilter);
	const dateFrom = resolveDateFromEpoch(globalFilter);
	const dateTo = resolveDateToEpoch(globalFilter);
	const query = useQuery(
		trpc.session.list.queryOptions({
			type: effectiveType === "all" ? undefined : effectiveType,
			storeId: globalFilter.storeId ?? undefined,
			currencyId: globalFilter.currencyId ?? undefined,
			dateFrom,
			dateTo,
		})
	);

	const items = ((query.data?.items ?? []) as SessionItem[]).slice(
		0,
		parsed.limit
	);

	return {
		isLoading: query.isLoading,
		items,
		limit: parsed.limit,
	};
}
