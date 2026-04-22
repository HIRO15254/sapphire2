import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
	ActiveSessionScene,
	useActiveSessionSceneState,
} from "@/live-sessions/components/active-session-scene";
import type { TableGameInfo } from "@/live-sessions/components/poker-table";
import { TournamentTimer } from "@/live-sessions/components/tournament-timer";
import { TournamentTimerDialog } from "@/live-sessions/components/tournament-timer-dialog";
import { useActiveSession } from "@/live-sessions/hooks/use-active-session";
import { useTournamentSessionPage } from "@/live-sessions/hooks/use-active-session-page";
import { useCashGameCompactSummary } from "@/live-sessions/hooks/use-cash-game-compact-summary";
import { useCashGameSession } from "@/live-sessions/hooks/use-cash-game-session";
import { useTournamentCompactSummary } from "@/live-sessions/hooks/use-tournament-compact-summary";
import type { TournamentBlindLevel } from "@/live-sessions/utils/tournament-timer";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { formatCompactNumber } from "@/utils/format-number";

export const Route = createFileRoute("/active-session/")({
	component: ActiveSessionPage,
});

function CashGameCompactSummary({
	summary,
}: {
	summary: {
		currentStack: number | null;
		evDiff: number;
		startedAt: Date | string | number;
		totalBuyIn: number;
	};
}) {
	const vm = useCashGameCompactSummary(summary);

	return (
		<div className="flex rounded-md border">
			<div className="flex flex-1 flex-col gap-0.5 px-3 py-2">
				<span className="text-muted-foreground text-xs">Time</span>
				<p className="font-semibold">{vm.duration}</p>
			</div>
			<div className="flex flex-1 flex-col gap-0.5 border-l px-3 py-2">
				<span className="text-muted-foreground text-xs">Total Buy-in</span>
				<p className="font-semibold">{vm.totalBuyInFormatted}</p>
			</div>
			<div className="flex flex-1 flex-col gap-0.5 border-l px-3 py-2">
				<span className="text-muted-foreground text-xs">P&L</span>
				<p className={cn("font-semibold", vm.displayPLColorClass || undefined)}>
					{vm.displayPLFormatted}
				</p>
				{vm.showEvPL ? (
					<p className={cn("text-xs", vm.evPLColorClass)}>
						EV: {vm.evPLFormatted}
					</p>
				) : null}
			</div>
		</div>
	);
}

function TournamentCompactSummary({
	summary,
}: {
	summary: {
		averageStack: number | null;
		remainingPlayers: number | null;
		startedAt: Date | string | number;
		totalEntries: number | null;
	};
}) {
	const vm = useTournamentCompactSummary(summary);

	return (
		<div className="flex rounded-md border">
			<div className="flex flex-1 flex-col gap-0.5 px-3 py-2">
				<span className="text-muted-foreground text-xs">Time</span>
				<p className="font-semibold">{vm.duration}</p>
			</div>
			<div className="flex flex-1 flex-col gap-0.5 border-l px-3 py-2">
				<span className="text-muted-foreground text-xs">Field/Entry</span>
				<p className="font-semibold">{vm.fieldEntry}</p>
			</div>
			<div className="flex flex-1 flex-col gap-0.5 border-l px-3 py-2">
				<span className="text-muted-foreground text-xs">Avg Stack</span>
				<p className="font-semibold">{vm.averageStackFormatted}</p>
			</div>
		</div>
	);
}

function buildTournamentSummary(session: {
	summary: Record<string, unknown>;
}): {
	averageStack: number | null;
	remainingPlayers: number | null;
	totalEntries: number | null;
} {
	const summary = session.summary;
	return {
		averageStack:
			typeof summary.averageStack === "number" ? summary.averageStack : null,
		remainingPlayers:
			typeof summary.remainingPlayers === "number"
				? summary.remainingPlayers
				: null,
		totalEntries:
			typeof summary.totalEntries === "number" ? summary.totalEntries : null,
	};
}

function CashGameSession({ sessionId }: { sessionId: string }) {
	const { session, ringGames, isDiscardPending, discard } =
		useCashGameSession(sessionId);

	const rawHeroSeat = session?.heroSeatPosition;
	const heroSeatPosition =
		typeof rawHeroSeat === "number" && rawHeroSeat >= 0 ? rawHeroSeat : null;
	const sceneState = useActiveSessionSceneState({
		heroSeatPosition,
		sessionId,
		sessionType: "cash_game",
	});

	if (!session) {
		return null;
	}

	const ringGame = session.ringGameId
		? ringGames.find((candidate) => candidate.id === session.ringGameId)
		: undefined;
	const gameInfo: TableGameInfo = ringGame
		? {
				blinds:
					ringGame.blind1 && ringGame.blind2
						? `${formatCompactNumber(ringGame.blind1)}-${formatCompactNumber(ringGame.blind2)}`
						: null,
				buyInRange:
					ringGame.minBuyIn && ringGame.maxBuyIn
						? `MIN ${formatCompactNumber(ringGame.minBuyIn)} - MAX ${formatCompactNumber(ringGame.maxBuyIn)}`
						: null,
				name: ringGame.name,
			}
		: {};

	return (
		<ActiveSessionScene
			gameInfo={gameInfo}
			isDiscardPending={isDiscardPending}
			memo={session.memo}
			onDiscard={discard}
			state={sceneState}
			summary={
				<CashGameCompactSummary
					summary={{
						currentStack: session.summary.currentStack,
						evDiff:
							typeof session.summary.evDiff === "number"
								? session.summary.evDiff
								: 0,
						startedAt: session.startedAt,
						totalBuyIn: session.summary.totalBuyIn,
					}}
				/>
			}
			tableSize={ringGame?.tableSize ?? null}
			title="Cash Game"
		/>
	);
}

function TournamentSession({ sessionId }: { sessionId: string }) {
	const {
		session,
		isDiscardPending,
		discard,
		isUpdatingTimer,
		isTimerDialogOpen,
		setIsTimerDialogOpen,
		handleOpenTimerDialog,
		handleClearTimer,
		handleSubmitTimer,
	} = useTournamentSessionPage(sessionId);

	const rawHeroSeat = session?.heroSeatPosition;
	const heroSeatPosition =
		typeof rawHeroSeat === "number" && rawHeroSeat >= 0 ? rawHeroSeat : null;
	const sceneState = useActiveSessionSceneState({
		heroSeatPosition,
		sessionId,
		sessionType: "tournament",
	});

	if (!session) {
		return null;
	}

	const tournamentSummary = buildTournamentSummary(
		session as { summary: Record<string, unknown> }
	);

	const blindLevels = ((session as { blindLevels?: TournamentBlindLevel[] })
		.blindLevels ?? []) as TournamentBlindLevel[];
	const timerStartedAt =
		(session as { timerStartedAt?: Date | string | number | null })
			.timerStartedAt ?? null;
	const hasStructure = blindLevels.length > 0;

	const tableSize =
		(session as { tableSize?: number | null }).tableSize ?? null;

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
						summary={{ ...tournamentSummary, startedAt: session.startedAt }}
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

function ActiveSessionPage() {
	const { activeSession, isLoading: isSessionLoading } = useActiveSession();

	if (isSessionLoading) {
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
		<div className="flex h-[calc(100dvh-4rem)] flex-col px-4 pt-2 pb-0 md:px-6 md:pt-4">
			{activeSession.type === "cash_game" ? (
				<CashGameSession sessionId={activeSession.id} />
			) : (
				<TournamentSession sessionId={activeSession.id} />
			)}
		</div>
	);
}
