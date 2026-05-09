import { useState } from "react";
import { useLiveSessionCreate } from "@/features/live-sessions/hooks/use-live-session-create";

type SessionKind = "cash_game" | "tournament";

interface UseCreateLiveSessionDialogArgs {
	onOpenChange: (open: boolean) => void;
}

export function useCreateLiveSessionDialog({
	onOpenChange,
}: UseCreateLiveSessionDialogArgs) {
	const [kind, setKind] = useState<SessionKind>("cash_game");

	const {
		stores,
		currencies,
		ringGames,
		tournaments,
		setSelectedStoreId,
		createCash,
		createTournament,
		isLoading,
	} = useLiveSessionCreate({ onClose: () => onOpenChange(false) });

	const handleReset = () => {
		setKind("cash_game");
		setSelectedStoreId(undefined);
	};

	const today = new Date().toISOString().split("T")[0] ?? "";

	return {
		kind,
		setKind,
		stores,
		currencies,
		ringGames,
		tournaments,
		setSelectedStoreId,
		isLoading,
		handleReset,
		onCreateCash: (values: {
			currencyId?: string;
			initialBuyIn: number;
			memo?: string;
			ringGameId?: string;
			storeId?: string;
		}) =>
			createCash({
				buyInAmount: values.initialBuyIn,
				currencyId: values.currencyId,
				memo: values.memo,
				ringGameId: values.ringGameId,
				storeId: values.storeId,
				sessionDate: today,
			}),
		onCreateTournament: (values: {
			currencyId?: string;
			memo?: string;
			storeId?: string;
			timerStartedAt?: number;
			tournamentId?: string;
		}) =>
			createTournament({
				currencyId: values.currencyId,
				memo: values.memo,
				sessionDate: today,
				storeId: values.storeId,
				timerStartedAt: values.timerStartedAt
					? new Date(values.timerStartedAt * 1000)
					: undefined,
				tournamentId: values.tournamentId,
			}),
	};
}
