import { useQuery } from "@tanstack/react-query";
import { useGlobalFilter } from "@/features/dashboard/hooks/use-global-filter";
import {
	parseSessionFilterWidgetConfig,
	resolveSessionListQueryInput,
	type SessionFilterWidgetConfig,
	type SessionTypeFilter,
} from "@/features/dashboard/utils/session-filter";
import { trpc } from "@/utils/trpc";

export type RecentSessionsWidgetTypeFilter = SessionTypeFilter;

interface ParsedConfig extends SessionFilterWidgetConfig {
	limit: number;
}

export function parseRecentSessionsWidgetConfig(
	raw: Record<string, unknown>
): ParsedConfig {
	const sessionFilter = parseSessionFilterWidgetConfig(raw);
	const limit =
		typeof raw.limit === "number" && raw.limit > 0 && raw.limit <= 20
			? Math.floor(raw.limit)
			: 5;
	return { ...sessionFilter, limit };
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
	const queryInput = resolveSessionListQueryInput(parsed, globalFilter);
	const query = useQuery(trpc.session.list.queryOptions(queryInput));

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
