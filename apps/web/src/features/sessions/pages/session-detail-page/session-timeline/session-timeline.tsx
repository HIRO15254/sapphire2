import { SessionEventsScene } from "@/features/live-sessions/components/session-events-scene";

interface SessionTimelineProps {
	liveSessionId: string;
	sessionType: "cash_game" | "tournament";
}

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
					readOnly
					sessionId={liveSessionId}
					sessionType={sessionType}
				/>
			</div>
		</section>
	);
}
