import { EmptyState } from "@/shared/components/ui/empty-state";
import { CashGameSession } from "./cash-game-session";
import { TournamentSession } from "./tournament-session";
import { useActiveSessionPage } from "./use-active-session-page";

export function ActiveSessionPage() {
	const { activeSession, isLoading } = useActiveSessionPage();

	if (isLoading) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<EmptyState
					className="border-none bg-transparent py-0"
					description="Fetching the current active session."
					heading="Loading..."
				/>
			</div>
		);
	}

	if (!activeSession) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<EmptyState
					className="border-none bg-transparent py-0"
					description="Start a live session from the sessions screen."
					heading="No active session"
				/>
			</div>
		);
	}

	return (
		<div className="p-4 md:p-6">
			{activeSession.type === "cash_game" ? (
				<CashGameSession sessionId={activeSession.id} />
			) : (
				<TournamentSession sessionId={activeSession.id} />
			)}
		</div>
	);
}
