import { useState } from "react";
import { useCreateSession } from "@/features/live-sessions/hooks/use-create-session";

type SessionType = "cash_game" | "tournament";

interface UseCreateSessionDialogOptions {
	onOpenChange: (open: boolean) => void;
}

export function useCreateSessionDialog({
	onOpenChange,
}: UseCreateSessionDialogOptions) {
	const [sessionType, setSessionType] = useState<SessionType>("cash_game");

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
		setSessionType("cash_game");
	};

	return {
		sessionType,
		setSessionType,
		stores,
		currencies,
		ringGames,
		tournaments,
		setSelectedStoreId,
		createCash,
		createTournament,
		isLoading,
		handleReset,
	};
}
