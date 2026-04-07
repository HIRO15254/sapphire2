import { createFileRoute } from "@tanstack/react-router";
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

function CashGameCompactSummary({
	summary,
}: {
	summary: {
		addonCount: number;
		cashOut: number | null;
		currentStack: number | null;
		evCashOut: number | null;
		profitLoss: number | null;
		totalBuyIn: number;
	};
}) {
	return (
		<div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
			<div>
				<span className="text-muted-foreground text-xs">Buy-in</span>
				<p className="font-semibold">
					{formatCompactNumber(summary.totalBuyIn)}
				</p>
			</div>
			<div>
				<span className="text-muted-foreground text-xs">Stack</span>
				<p className="font-semibold">
					{summary.currentStack === null
						? "-"
						: formatCompactNumber(summary.currentStack)}
				</p>
			</div>
			<div>
				<span className="text-muted-foreground text-xs">P&L</span>
				<p
					className={cn(
						"font-semibold",
						summary.profitLoss === null
							? undefined
							: plColorClass(summary.profitLoss)
					)}
				>
					{summary.profitLoss === null ? "-" : formatPl(summary.profitLoss)}
				</p>
			</div>
			{summary.evCashOut === null ? null : (
				<div>
					<span className="text-muted-foreground text-xs">EV P&L</span>
					<p className="font-semibold">
						{formatPl(summary.evCashOut - summary.totalBuyIn)}
					</p>
				</div>
			)}
			{summary.addonCount > 0 ? (
				<div>
					<span className="text-muted-foreground text-xs">Addons</span>
					<p className="font-semibold">{summary.addonCount}</p>
				</div>
			) : null}
		</div>
	);
}

function TournamentCompactSummary({
	summary,
}: {
	summary: {
		buyIn: number | null;
		currentStack: number | null;
		entryFee: number | null;
		profitLoss: number | null;
		remainingPlayers: number | null;
		totalChipPurchases: number;
		totalEntries: number | null;
	};
}) {
	const totalCost = (summary.buyIn ?? 0) + (summary.entryFee ?? 0);

	return (
		<div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
			{totalCost > 0 ? (
				<div>
					<span className="text-muted-foreground text-xs">Buy-in</span>
					<p className="font-semibold">{formatCompactNumber(totalCost)}</p>
				</div>
			) : null}
			<div>
				<span className="text-muted-foreground text-xs">Stack</span>
				<p className="font-semibold">
					{summary.currentStack === null
						? "-"
						: formatCompactNumber(summary.currentStack)}
				</p>
			</div>
			<div>
				<span className="text-muted-foreground text-xs">Remaining</span>
				<p className="font-semibold">
					{summary.remainingPlayers === null ? "-" : summary.remainingPlayers}
				</p>
			</div>
			{summary.totalEntries === null ? null : (
				<div>
					<span className="text-muted-foreground text-xs">Entries</span>
					<p className="font-semibold">{summary.totalEntries}</p>
				</div>
			)}
			{summary.totalChipPurchases > 0 ? (
				<div>
					<span className="text-muted-foreground text-xs">Chip Purchases</span>
					<p className="font-semibold">{summary.totalChipPurchases}</p>
				</div>
			) : null}
			{summary.profitLoss === null ? null : (
				<div>
					<span className="text-muted-foreground text-xs">P&L</span>
					<p className={cn("font-semibold", plColorClass(summary.profitLoss))}>
						{formatPl(summary.profitLoss)}
					</p>
				</div>
			)}
		</div>
	);
}

function buildTournamentSummary(session: {
	summary: Record<string, unknown>;
}): {
	buyIn: number | null;
	currentStack: number | null;
	entryFee: number | null;
	profitLoss: number | null;
	remainingPlayers: number | null;
	totalChipPurchases: number;
	totalEntries: number | null;
} {
	const summary = session.summary;
	return {
		buyIn: typeof summary.buyIn === "number" ? summary.buyIn : null,
		currentStack:
			typeof summary.currentStack === "number" ? summary.currentStack : null,
		entryFee: typeof summary.entryFee === "number" ? summary.entryFee : null,
		profitLoss:
			typeof summary.profitLoss === "number" ? summary.profitLoss : null,
		remainingPlayers:
			typeof summary.remainingPlayers === "number"
				? summary.remainingPlayers
				: null,
		totalChipPurchases:
			typeof summary.totalChipPurchases === "number"
				? summary.totalChipPurchases
				: 0,
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
			summary={<CashGameCompactSummary summary={session.summary} />}
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
			summary={<TournamentCompactSummary summary={tournamentSummary} />}
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
