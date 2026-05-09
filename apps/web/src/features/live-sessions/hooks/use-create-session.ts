import { useLiveSessionCreate } from "@/features/live-sessions/hooks/use-live-session-create";

export function useCreateSession({ onClose }: { onClose: () => void }) {
	const {
		stores,
		currencies,
		ringGames,
		tournaments,
		selectedStoreId,
		setSelectedStoreId,
		isLoading,
		createCash: createCashNew,
		createTournament: createTournamentNew,
	} = useLiveSessionCreate({ onClose });

	const today = new Date().toISOString().split("T")[0] ?? "";

	return {
		stores,
		currencies,
		ringGames,
		tournaments,
		selectedStoreId,
		setSelectedStoreId,
		createCash: (values: {
			currencyId?: string;
			initialBuyIn: number;
			memo?: string;
			ringGameId?: string;
			storeId?: string;
		}) =>
			createCashNew({
				buyInAmount: values.initialBuyIn,
				currencyId: values.currencyId,
				memo: values.memo,
				ringGameId: values.ringGameId,
				storeId: values.storeId,
				sessionDate: today,
			}),
		createTournament: (values: {
			buyIn?: number;
			currencyId?: string;
			entryFee?: number;
			memo?: string;
			startingStack?: number;
			storeId?: string;
			timerStartedAt?: number;
			tournamentId?: string;
		}) =>
			createTournamentNew({
				currencyId: values.currencyId,
				memo: values.memo,
				sessionDate: today,
				storeId: values.storeId,
				timerStartedAt: values.timerStartedAt
					? new Date(values.timerStartedAt * 1000)
					: undefined,
				tournamentId: values.tournamentId,
			}),
		isLoading,
	};
}
