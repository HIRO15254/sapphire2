import { createFileRoute } from "@tanstack/react-router";
import {
	ActiveSessionScene,
	useActiveSessionSceneState,
} from "@/features/live-sessions/components/active-session-scene";
import type { TableGameInfo } from "@/features/live-sessions/components/poker-table";
import { TournamentTimer } from "@/features/live-sessions/components/tournament-timer";
import { TournamentTimerDialog } from "@/features/live-sessions/components/tournament-timer-dialog";
import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";
import { useCashGameCompactSummary } from "@/features/live-sessions/hooks/use-cash-game-compact-summary";
import { useLiveSession } from "@/features/live-sessions/hooks/use-live-session";
import { useTournamentCompactSummary } from "@/features/live-sessions/hooks/use-tournament-compact-summary";
import type { TournamentBlindLevel } from "@/features/live-sessions/utils/tournament-timer";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { formatCompactNumber } from "@/utils/format-number";
import { useTournamentSessionPage } from "./-use-active-session-page";

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

function buildTournamentSummary(detail: Record<string, unknown>): {
	averageStack: number | null;
	remainingPlayers: number | null;
	totalEntries: number | null;
} {
	return {
		averageStack: null,
		remainingPlayers: null,
		totalEntries:
			typeof detail.totalEntries === "number" ? detail.totalEntries : null,
	};
}

function CashGameSession({ sessionId }: { sessionId: string }) {
	const { session, isDiscardPending, discard } = useLiveSession(sessionId);

	const heroSeatPosition =
		session?.currentPlayers.find((p) => p.isHero)?.seatPosition ?? null;
	const heroSeat =
		typeof heroSeatPosition === "number" && heroSeatPosition >= 0
			? heroSeatPosition
			: null;
	const sceneState = useActiveSessionSceneState({
		heroSeatPosition: heroSeat,
		sessionId,
		sessionType: "cash_game",
	});

	if (!session) {
		return null;
	}

	const detail = session.cashDetail;
	const cashBlindSet = session.cashBlindSets[0];
	const gameInfo: TableGameInfo = detail
		? {
				blinds:
					cashBlindSet?.blind1 && cashBlindSet?.blind2
						? `${formatCompactNumber(cashBlindSet.blind1)}-${formatCompactNumber(cashBlindSet.blind2)}`
						: null,
				buyInRange:
					detail.minBuyIn && detail.maxBuyIn
						? `MIN ${formatCompactNumber(detail.minBuyIn)} - MAX ${formatCompactNumber(detail.maxBuyIn)}`
						: null,
				name: detail.ruleName,
			}
		: {};

	const cashOut = detail?.cashOut ?? null;
	const evCashOut = detail?.evCashOut ?? null;
	const evDiff =
		cashOut !== null && evCashOut !== null ? evCashOut - cashOut : 0;

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
						currentStack: cashOut,
						evDiff,
						startedAt: session.startedAt ?? new Date(),
						totalBuyIn: detail?.buyIn ?? 0,
					}}
				/>
			}
			tableSize={detail?.tableSize ?? null}
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

	const heroSeatPosition =
		session?.currentPlayers.find((p) => p.isHero)?.seatPosition ?? null;
	const heroSeat =
		typeof heroSeatPosition === "number" && heroSeatPosition >= 0
			? heroSeatPosition
			: null;
	const sceneState = useActiveSessionSceneState({
		heroSeatPosition: heroSeat,
		sessionId,
		sessionType: "tournament",
	});

	if (!session) {
		return null;
	}

	const detail = session.tournamentDetail;
	const tournamentSummary = buildTournamentSummary(detail ?? {});

	const blindLevels = session.blindLevels
		.filter((level) => !level.isBreak && level.blindSets.length > 0)
		.map((level): TournamentBlindLevel => {
			const bs = level.blindSets[0];
			return {
				ante: bs?.ante ?? null,
				blind1: bs?.blind1 ?? null,
				blind2: bs?.blind2 ?? null,
				blind3: bs?.blind3 ?? null,
				id: String(level.id),
				isBreak: false,
				level: level.levelIndex,
				minutes: level.minutes ?? null,
			};
		});
	const timerStartedAt = detail?.timerStartedAt ?? null;
	const hasStructure = blindLevels.length > 0;
	const tableSize = detail?.tableSize ?? null;

	return (
		<>
			<ActiveSessionScene
				gameInfo={{
					name: detail?.ruleName ?? null,
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
		<div className="flex h-[calc(100dvh-4rem)] flex-col p-4 md:p-6">
			{activeSession.kind === "cash_game" ? (
				<CashGameSession sessionId={activeSession.id} />
			) : (
				<TournamentSession sessionId={activeSession.id} />
			)}
		</div>
	);
}
