import { ActiveSessionScene } from "@/features/live-sessions/components/active-session-scene";
import { CashGameCompactSummary } from "../cash-game-compact-summary";
import { useCashGameSessionView } from "./use-cash-game-session-view";

export function CashGameSession({ sessionId }: { sessionId: string }) {
	const {
		discard,
		gameInfo,
		isDiscardPending,
		sceneState,
		session,
		summary,
		tableSize,
	} = useCashGameSessionView(sessionId);

	if (!(session && summary)) {
		return null;
	}

	return (
		<ActiveSessionScene
			gameInfo={gameInfo}
			isDiscardPending={isDiscardPending}
			memo={session.memo}
			onDiscard={discard}
			state={sceneState}
			summary={<CashGameCompactSummary summary={summary} />}
			tableSize={tableSize}
			title="Cash Game"
		/>
	);
}
