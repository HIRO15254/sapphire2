import { SessionEventsScene } from "@/features/live-sessions/components/session-events-scene";

export function SessionEventsPage({
	sessionId,
	sessionType,
}: {
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}) {
	return <SessionEventsScene sessionId={sessionId} sessionType={sessionType} />;
}
