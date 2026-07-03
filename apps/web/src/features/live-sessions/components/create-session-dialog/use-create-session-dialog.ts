import { useCreateSession } from "@/features/live-sessions/hooks/use-create-session";
import type {
	RingGameOption,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";

interface UseCreateSessionDialogOptions {
	onOpenChange: (open: boolean) => void;
	open?: boolean;
}

export function useCreateSessionDialog({
	onOpenChange,
	open,
}: UseCreateSessionDialogOptions) {
	const {
		rooms,
		currencies,
		ringGames,
		tournaments,
		setSelectedRoomId,
		nearestRoomId,
		createCash,
		createTournament,
		locationPrompt,
		isLoading,
	} = useCreateSession({ onClose: () => onOpenChange(false), open });

	const handleReset = () => {
		setSelectedRoomId(undefined);
	};

	const handleSubmit = (values: SessionFormValues) => {
		if (values.type === "cash_game") {
			createCash({
				roomId: values.roomId,
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
			roomId: values.roomId,
			tournamentId: values.tournamentId,
			currencyId: values.currencyId,
			buyIn: values.tournamentBuyIn,
			entryFee: values.entryFee,
			// startingStack is required by the live mutation; the wizard
			// Rules step exposes it via the tournament snapshot scalar.
			startingStack: values.startingStack ?? 0,
			memo: values.memo,
			timerStartedAt: values.timerStartedAt,
		});
	};

	return {
		rooms: rooms as Array<{ id: string; name: string }>,
		currencies,
		ringGames: ringGames as RingGameOption[],
		tournaments: tournaments as TournamentOption[],
		setSelectedRoomId,
		defaultRoomId: nearestRoomId,
		handleSubmit,
		locationPrompt,
		isLoading,
		handleReset,
	};
}
