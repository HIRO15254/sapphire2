import { useCreateSession } from "@/features/live-sessions/hooks/use-create-session";
import type {
	RingGameOption,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";

interface UseCreateSessionDialogOptions {
	onOpenChange: (open: boolean) => void;
}

export function useCreateSessionDialog({
	onOpenChange,
}: UseCreateSessionDialogOptions) {
	const {
		stores,
		currencies,
		ringGames,
		tournaments,
		setSelectedStoreId,
		createCash,
		createTournament,
		isLoading,
	} = useCreateSession({ onClose: () => onOpenChange(false) });

	const handleReset = () => {
		setSelectedStoreId(undefined);
	};

	const handleSubmit = (values: SessionFormValues) => {
		if (values.type === "cash_game") {
			createCash({
				storeId: values.storeId,
				ringGameId: values.ringGameId,
				currencyId: values.currencyId,
				// The Rules step's buyIn doubles as the live session's initial
				// buy-in. cashOut is irrelevant at session start.
				initialBuyIn: values.buyIn,
				memo: values.memo,
			});
			return;
		}
		createTournament({
			storeId: values.storeId,
			tournamentId: values.tournamentId,
			currencyId: values.currencyId,
			buyIn: values.tournamentBuyIn,
			entryFee: values.entryFee,
			// startingStack is required by the live mutation; the wizard
			// Rules step exposes it via the tournament snapshot scalar.
			startingStack: values.startingStack ?? 0,
			memo: values.memo,
		});
	};

	return {
		stores: stores as Array<{ id: string; name: string }>,
		currencies,
		ringGames: ringGames as RingGameOption[],
		tournaments: tournaments as TournamentOption[],
		setSelectedStoreId,
		handleSubmit,
		isLoading,
		handleReset,
	};
}
