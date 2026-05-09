import { createFileRoute } from "@tanstack/react-router";
import { SessionEventsScene } from "@/features/live-sessions/components/session-events-scene";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { useSessionDetailPage } from "./-use-session-detail-page";

export const Route = createFileRoute("/sessions/$id")({
	component: SessionDetailPage,
});

function SessionDetailPage() {
	const { id } = Route.useParams();
	const { session, isLoading, sessionType, isLive } = useSessionDetailPage(id);

	if (isLoading) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<EmptyState
					className="border-none bg-transparent py-0"
					description="Fetching session details."
					heading="Loading..."
				/>
			</div>
		);
	}

	if (!session) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<EmptyState
					className="border-none bg-transparent py-0"
					description="The session could not be found."
					heading="Session not found"
				/>
			</div>
		);
	}

	if (isLive) {
		return <SessionEventsScene sessionId={id} sessionType={sessionType} />;
	}

	return (
		<div className="flex h-[100dvh] items-center justify-center pb-16">
			<EmptyState
				className="border-none bg-transparent py-0"
				description="Manual session editing is available from the Sessions list."
				heading="Manual session"
			/>
		</div>
	);
}
