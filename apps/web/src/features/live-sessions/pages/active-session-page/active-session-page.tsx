import { cn } from "@/lib/utils";
import { QueryError } from "@/shared/components/query-error";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { CRYST_SCOPE } from "@/shared/lib/theme";
import { CashGameSession } from "./cash-game-session";
import { TournamentSession } from "./tournament-session";
import { useActiveSessionPage } from "./use-active-session-page";

const FRAME_CLASS = "flex h-[calc(100dvh-4rem)] flex-col overflow-hidden";

export function ActiveSessionPage() {
	const { activeSession, isError, isLoading, onRetry } = useActiveSessionPage();

	if (isLoading) {
		return (
			<div
				className={cn(
					CRYST_SCOPE,
					FRAME_CLASS,
					"items-center justify-center bg-background text-foreground"
				)}
			>
				<EmptyState
					className="border-none bg-transparent py-0"
					description="Fetching the current active session."
					heading="Loading..."
				/>
			</div>
		);
	}

	if (isError) {
		return (
			<div
				className={cn(
					CRYST_SCOPE,
					FRAME_CLASS,
					"items-center justify-center bg-background p-4 text-foreground"
				)}
			>
				<QueryError
					message="Unable to load the active session"
					onRetry={onRetry}
				/>
			</div>
		);
	}

	if (!activeSession) {
		return (
			<div
				className={cn(
					CRYST_SCOPE,
					FRAME_CLASS,
					"items-center justify-center bg-background text-foreground"
				)}
			>
				<EmptyState
					className="border-none bg-transparent py-0"
					description="Start a live session from the sessions screen."
					heading="No active session"
				/>
			</div>
		);
	}

	return (
		<div
			className={cn(
				CRYST_SCOPE,
				FRAME_CLASS,
				"relative bg-background text-foreground"
			)}
		>
			{activeSession.type === "cash_game" ? (
				<CashGameSession sessionId={activeSession.id} />
			) : (
				<TournamentSession sessionId={activeSession.id} />
			)}
		</div>
	);
}
