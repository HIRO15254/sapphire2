import { useQuery } from "@tanstack/react-query";
import {
	type CashTimelinePoint,
	deriveCashGameTimeline,
	deriveTournamentTimeline,
	type TimelineEvent,
	type TournamentTimelinePoint,
} from "@/features/live-sessions/utils/session-timeline";
import { trpc } from "@/utils/trpc";

export type SessionType = "cash_game" | "tournament";

export type SessionResultPoint = CashTimelinePoint | TournamentTimelinePoint;

interface UseSessionResultChartArgs {
	enabled: boolean;
	liveSessionId: string;
	sessionType: SessionType;
}

interface UseSessionResultChartResult {
	error: unknown;
	isEmpty: boolean;
	isLoading: boolean;
	points: SessionResultPoint[];
	sessionType: SessionType;
}

export function useSessionResultChart({
	liveSessionId,
	sessionType,
	enabled,
}: UseSessionResultChartArgs): UseSessionResultChartResult {
	const queryInput =
		sessionType === "tournament"
			? { liveTournamentSessionId: liveSessionId }
			: { liveCashGameSessionId: liveSessionId };

	const eventsQuery = useQuery({
		...trpc.sessionEvent.list.queryOptions(queryInput),
		enabled,
	});

	const events = (eventsQuery.data ?? []) as TimelineEvent[];
	const points: SessionResultPoint[] =
		sessionType === "tournament"
			? deriveTournamentTimeline(events)
			: deriveCashGameTimeline(events);

	return {
		error: eventsQuery.error,
		isEmpty: !eventsQuery.isLoading && points.length < 2,
		isLoading: eventsQuery.isLoading,
		points,
		sessionType,
	};
}
