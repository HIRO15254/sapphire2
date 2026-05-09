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

interface SessionItem {
	id: string;
	kind: "cash_game" | "tournament";
	source: string;
	startedAt: string | Date | null;
	status: string;
}

interface UseActiveSessionWidgetResult {
	isLoading: boolean;
	sessions: SessionItem[];
}

export function useActiveSessionWidget(
	config: Record<string, unknown>
): UseActiveSessionWidgetResult {
	const parsed = parseActiveSessionWidgetConfig(config);

	const listQuery = useQuery({
		...trpc.session.list.queryOptions(
			parsed.sessionType === "all" ? {} : { type: parsed.sessionType }
		),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
	});

	const isLoading = listQuery.isLoading;
	const allItems = listQuery.data?.items ?? [];

	// Filter to only live active/paused sessions
	const sessions = allItems
		.filter(
			(item) =>
				item.source === "live" &&
				(item.status === "active" || item.status === "paused")
		)
		.map((item) => ({
			id: item.id,
			kind: item.kind as "cash_game" | "tournament",
			source: item.source,
			startedAt: item.startedAt,
			status: item.status,
		}));

	return { isLoading, sessions };
}
