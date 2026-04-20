import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
	ActiveSessionScene,
	useActiveSessionSceneState,
} from "@/live-sessions/components/active-session-scene";
import type { TableGameInfo } from "@/live-sessions/components/poker-table";
import { useActiveSession } from "@/live-sessions/hooks/use-active-session";
import { useCashGameSession } from "@/live-sessions/hooks/use-cash-game-session";
import { useTournamentSession } from "@/live-sessions/hooks/use-tournament-session";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { formatCompactNumber } from "@/utils/format-number";

export const Route = createFileRoute("/active-session/")({
	component: ActiveSessionPage,
});

function plColorClass(value: number): string {
	if (value > 0) {
		return "text-green-600 dark:text-green-400";
	}
	if (value < 0) {
		return "text-red-600 dark:text-red-400";
	}
	return "";
}

function formatPl(value: number): string {
	const sign = value >= 0 ? "+" : "";
	return `${sign}${formatCompactNumber(value)}`;
}

function formatDuration(startedAt: Date | string | number): string {
	const start = new Date(startedAt);
	const elapsed = Math.floor((Date.now() - start.getTime()) / 60000);
	const hours = Math.floor(elapsed / 60);
	const minutes = elapsed % 60;
	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
}

function useSessionDuration(startedAt: Date | string | number): string {
	const [duration, setDuration] = useState(() => formatDuration(startedAt));

	useEffect(() => {
		const id = setInterval(() => {
			setDuration(formatDuration(startedAt));
		}, 60000);
		return () => clearInterval(id);
	}, [startedAt]);

	return duration;
}

function CashGameCompactSummary({
	summary,
}: {
	summary: {
		currentStack: number | null;
		evCashOut: number | null;
		startedAt: Date | string | number;
		totalBuyIn: number;
	};
}) {
	const duration = useSessionDuration(summary.startedAt);

	// Use currentStack-based running P&L during the active session.
	// profitLoss (from cashOut) is only available at session end.
	const displayPL =
		summary.currentStack !== null
			? summary.currentStack - summary.totalBuyIn
			: null;

	const evPL =
		summary.evCashOut !== null
			? summary.evCashOut - summary.totalBuyIn
			: null;
	const showEvPL = evPL !== null && evPL !== displayPL;

	return (
		<div className="grid grid-cols-3 gap-2">
			<div className="flex flex-col gap-0.5 rounded-md border px-3 py-2">
				<span className="text-muted-foreground text-xs">Time</span>
				<p className="font-semibold">{duration}</p>
			</div>
			<div className="flex flex-col gap-0.5 rounded-md border px-3 py-2">
				<span className="text-muted-foreground text-xs">Total Buy-in</span>
				<p className="font-semibold">
					{formatCompactNumber(summary.totalBuyIn)}
				</p>
			</div>
			<div className="flex flex-col gap-0.5 rounded-md border px-3 py-2">
				<span className="text-muted-foreground text-xs">P&L</span>
				<p
					className={cn(
						"font-semibold",
						displayPL === null ? undefined : plColorClass(displayPL)
					)}
				>
					{displayPL === null
						? "-"
						: showEvPL
							? `${formatPl(displayPL)} (EV: ${formatPl(evPL)})`
							: formatPl(displayPL)}
				</p>
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
	const duration = useSessionDuration(summary.startedAt);
	const fieldEntry =
		summary.remainingPlayers === null && summary.totalEntries === null
			? "-"
			: `${summary.remainingPlayers ?? "-"}/${summary.totalEntries ?? "-"}`;

	return (
		<div className="grid grid-cols-3 gap-2">
			<div className="flex flex-col gap-0.5 rounded-md border px-3 py-2">
				<span className="text-muted-foreground text-xs">Time</span>
				<p className="font-semibold">{duration}</p>
			</div>
			<div className="flex flex-col gap-0.5 rounded-md border px-3 py-2">
				<span className="text-muted-foreground text-xs">Field/Entry</span>
				<p className="font-semibold">{fieldEntry}</p>
			</div>
			<div>
				<span className="text-muted-foreground text-xs">Avg Stack</span>
				<p className="font-semibold">
					{summary.averageStack === null
						? "-"
						: formatCompactNumber(summary.averageStack)}
				</p>
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
						evCashOut: session.summary.evCashOut,
						startedAt: session.startedAt,
						totalBuyIn: session.summary.totalBuyIn,
					}}
				/>
			}
			title="Cash Game"
		/>
	);
}

function TournamentSession({ sessionId }: { sessionId: string }) {
	const { session, isDiscardPending, discard } =
		useTournamentSession(sessionId);

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

	return (
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
			title="Tournament"
		/>
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
