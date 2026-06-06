import { SessionResultChart } from "@/features/live-sessions/components/session-result-chart";

interface LiveResultChartProps {
	liveSessionId: string;
	sessionType: "cash_game" | "tournament";
}

/**
 * Recorded-session result/stack chart, rendered inside the P&L card on the
 * detail page so the headline number and its curve read as one composite unit.
 * Thin wrapper over the live-session chart so a recorded session shows the same
 * curve it had during play. Manual sessions never render it.
 */
export function LiveResultChart({
	liveSessionId,
	sessionType,
}: LiveResultChartProps) {
	return (
		<>
			<h3 className="t-meta mb-2 text-left text-muted-foreground">Result</h3>
			<SessionResultChart
				enabled
				liveSessionId={liveSessionId}
				sessionType={sessionType}
			/>
		</>
	);
}
