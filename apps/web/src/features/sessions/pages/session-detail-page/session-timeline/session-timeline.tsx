import { SessionEventsScene } from "@/features/live-sessions/components/session-events-scene";

interface SessionTimelineProps {
	liveSessionId: string;
	sessionType: "cash_game" | "tournament";
}

/**
 * Recorded-session event timeline, shown below the game / session info on the
 * detail page. Reuses the live-session events scene so a recorded session shows
 * the same timeline it had during play. Manual sessions never render it.
 */
export function SessionTimeline({
	liveSessionId,
	sessionType,
}: SessionTimelineProps) {
	return (
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
	);
}
