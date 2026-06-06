import { SessionEventsScene } from "@/features/live-sessions/components/session-events-scene";
import { SessionResultChart } from "@/features/live-sessions/components/session-result-chart";

interface LiveSessionPanelProps {
	liveSessionId: string;
	sessionType: "cash_game" | "tournament";
}

/**
 * The live-recording-only section of the detail page: the stack/result chart
 * plus the full event timeline. Reuses the existing live-session components so
 * a recorded session shows the same chart and timeline it had during play.
 * Manual sessions never render this panel.
 */
export function LiveSessionPanel({
	liveSessionId,
	sessionType,
}: LiveSessionPanelProps) {
	return (
		<>
			<section className="mb-4 rounded-lg border border-border bg-card p-4 text-card-foreground">
				<h2 className="t-h4 mb-3">Result</h2>
				<SessionResultChart
					enabled
					liveSessionId={liveSessionId}
					sessionType={sessionType}
				/>
			</section>
			<section className="mb-4 rounded-lg border border-border bg-card text-card-foreground">
				<h2 className="t-h4 border-border border-b px-4 py-3">Timeline</h2>
				<div className="px-4 py-3">
					<SessionEventsScene
						embedded
						sessionId={liveSessionId}
						sessionType={sessionType}
					/>
				</div>
			</section>
		</>
	);
}
