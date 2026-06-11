import { ActiveSessionScene } from "@/features/live-sessions/components/active-session-scene";
import { TournamentCompactSummary } from "../tournament-compact-summary";
import { TournamentTimer } from "./tournament-timer";
import { TournamentTimerDialog } from "./tournament-timer-dialog";
import { useTournamentSessionView } from "./use-tournament-session-view";

export function TournamentSession({ sessionId }: { sessionId: string }) {
	const {
		blindLevels,
		discard,
		handleClearTimer,
		handleOpenTimerDialog,
		handleSubmitTimer,
		hasStructure,
		isDiscardPending,
		isTimerDialogOpen,
		isUpdatingTimer,
		sceneState,
		session,
		setIsTimerDialogOpen,
		tableSize,
		timerStartedAt,
		tournamentSummary,
	} = useTournamentSessionView(sessionId);

	if (!(session && tournamentSummary)) {
		return null;
	}

	return (
		<>
			<ActiveSessionScene
				gameInfo={{
					name: session.tournamentId ? "Tournament" : null,
				}}
				isDiscardPending={isDiscardPending}
				memo={session.memo}
				onDiscard={discard}
				state={sceneState}
				summary={
					<TournamentCompactSummary
						summary={{
							...tournamentSummary,
							startedAt: session.startedAt ?? new Date(),
						}}
					/>
				}
				tableSize={tableSize}
				title="Tournament"
				topSlot={
					hasStructure ? (
						<TournamentTimer
							blindLevels={blindLevels}
							onEditTimer={handleOpenTimerDialog}
							timerStartedAt={timerStartedAt}
						/>
					) : undefined
				}
			/>
			{hasStructure ? (
				<TournamentTimerDialog
					isLoading={isUpdatingTimer}
					onClear={handleClearTimer}
					onOpenChange={setIsTimerDialogOpen}
					onSubmit={handleSubmitTimer}
					open={isTimerDialogOpen}
					timerStartedAt={timerStartedAt}
				/>
			) : null}
		</>
	);
}
