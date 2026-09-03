import { SessionResultChart } from "@/features/live-sessions/components/session-result-chart";

interface LiveResultChartProps {
	liveSessionId: string;
	sessionType: "cash_game" | "tournament";
}

export function LiveResultChart({
	liveSessionId,
	sessionType,
}: LiveResultChartProps) {
	return (
		<SessionResultChart
			enabled
			liveSessionId={liveSessionId}
			sessionType={sessionType}
		/>
	);
}
