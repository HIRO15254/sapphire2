import { useActiveSessionSceneState } from "@/features/live-sessions/components/active-session-scene";
import type { TableGameInfo } from "@/features/live-sessions/components/poker-table";
import { useCashGameSession } from "@/features/live-sessions/hooks/use-cash-game-session";
import { formatCompactNumber } from "@/utils/format-number";

export interface CashGameCompactSummaryData {
	currentStack: number | null;
	evDiff: number;
	startedAt: Date | string | number;
	totalBuyIn: number;
}

/**
 * View model for the cash-game branch of the active-session page: joins the
 * live session with its ring game, normalizes the hero seat for the scene
 * state, and prepares the table game info + compact summary inputs.
 */
export function useCashGameSessionView(sessionId: string) {
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

	const ringGame = session?.ringGameId
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

	const summary: CashGameCompactSummaryData | null = session
		? {
				currentStack: session.summary.currentStack,
				evDiff:
					typeof session.summary.evDiff === "number"
						? session.summary.evDiff
						: 0,
				startedAt: session.startedAt ?? new Date(),
				totalBuyIn: session.summary.totalBuyIn,
			}
		: null;

	return {
		discard,
		gameInfo,
		isDiscardPending,
		sceneState,
		session: session ?? null,
		summary,
		tableSize: ringGame?.tableSize ?? null,
	};
}
