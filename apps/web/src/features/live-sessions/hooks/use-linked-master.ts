import { useQuery } from "@tanstack/react-query";
import {
	masterNounFor,
	summarizeLinkedMaster,
} from "@/features/live-sessions/utils/master-link";
import {
	describeCashMasterValues,
	describeTournamentMasterValues,
} from "@/features/live-sessions/utils/session-settings";
import { trpc } from "@/utils/trpc";

interface UseLinkedMasterOptions {
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}

export function useLinkedMaster({
	sessionId,
	sessionType,
}: UseLinkedMasterOptions) {
	const isCash = sessionType === "cash_game";

	const detailQuery = useQuery({
		...trpc.session.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
	});
	const detail = detailQuery.data ?? null;
	const roomId = detail?.roomId ?? "";
	const masterId = (isCash ? detail?.ringGameId : detail?.tournamentId) ?? null;

	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByRoom.queryOptions({ roomId }),
		enabled: isCash && roomId !== "" && masterId !== null,
	});
	const tournamentQuery = useQuery({
		...trpc.tournament.getById.queryOptions({ id: masterId ?? "" }),
		enabled: !isCash && masterId !== null,
	});

	const rows = {
		ringGame: isCash
			? (ringGamesQuery.data?.find((row) => row.id === masterId) ?? null)
			: null,
		tournament: isCash ? null : (tournamentQuery.data ?? null),
	};

	return {
		detail,
		masterId,
		summary:
			masterId === null
				? null
				: summarizeLinkedMaster(
						rows,
						detail?.roomName ?? null,
						masterNounFor(sessionType)
					),
		values: isCash
			? describeCashMasterValues(rows.ringGame)
			: describeTournamentMasterValues(rows.tournament),
	};
}
