import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

function useRoomRingGames(roomId: string | undefined) {
	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByRoom.queryOptions({ roomId: roomId ?? "" }),
		enabled: !!roomId,
	});
	return (ringGamesQuery.data ?? []).map((g) => ({
		id: g.id,
		name: g.name,
		variant: g.variant,
		blind1: g.blind1,
		blind2: g.blind2,
		blind3: g.blind3,
		ante: g.ante,
		anteType: g.anteType,
		minBuyIn: g.minBuyIn,
		maxBuyIn: g.maxBuyIn,
		tableSize: g.tableSize,
		currencyId: g.currencyId,
	}));
}

function useRoomTournaments(roomId: string | undefined) {
	const tournamentsQuery = useQuery({
		...trpc.tournament.listByRoom.queryOptions({
			roomId: roomId ?? "",
			includeArchived: false,
		}),
		enabled: !!roomId,
	});
	return (tournamentsQuery.data ?? []).map((t) => ({
		id: t.id,
		name: t.name,
		variant: t.variant,
		buyIn: t.buyIn,
		entryFee: t.entryFee,
		startingStack: t.startingStack,
		bountyAmount: t.bountyAmount,
		tableSize: t.tableSize,
		currencyId: t.currencyId,
		hasPreviousDay: t.hasPreviousDay,
	}));
}

function usePromotableSessions() {
	const promotableQuery = useQuery(
		trpc.liveTournamentSession.listPromotable.queryOptions()
	);
	return (promotableQuery.data ?? []).map((s) => ({
		id: s.id,
		ruleName: s.ruleName,
		bagStack: s.bagStack,
	}));
}

export function useCreateSession({ onClose }: { onClose: () => void }) {
	const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const roomsQuery = useQuery(trpc.room.list.queryOptions());
	const rooms = (roomsQuery.data ?? []).map((s) => ({
		id: s.id,
		name: s.name,
	}));

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = (currenciesQuery.data ?? []).map((c) => ({
		id: c.id,
		name: c.name,
	}));

	const ringGames = useRoomRingGames(selectedRoomId);
	const tournaments = useRoomTournaments(selectedRoomId);
	const promotableSessions = usePromotableSessions();

	const cashListKey = trpc.liveCashGameSession.list.queryOptions({}).queryKey;
	const tournamentListKey = trpc.liveTournamentSession.list.queryOptions(
		{}
	).queryKey;

	const sessionListKey = trpc.session.list.queryOptions({}).queryKey;

	const createCashMutation = useMutation({
		mutationFn: (values: {
			currencyId?: string;
			initialBuyIn: number;
			memo?: string;
			ringGameId?: string;
			roomId?: string;
		}) => trpcClient.liveCashGameSession.create.mutate(values),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [
				{ queryKey: cashListKey },
				{ queryKey: sessionListKey },
			]);
			onClose();
			await navigate({ to: "/active-session" });
		},
	});

	const createTournamentMutation = useMutation({
		mutationFn: async (values: {
			buyIn: number;
			currencyId?: string;
			entryFee?: number;
			memo?: string;
			previousSessionId?: string;
			startingStack: number;
			roomId?: string;
			timerStartedAt?: number;
			tournamentId?: string;
		}) => {
			const { startingStack, ...createValues } = values;
			const result =
				await trpcClient.liveTournamentSession.create.mutate(createValues);
			// When linking a previous day the server seeds the starting stack from
			// the carried-over bag, so only seed it here for a fresh entry.
			if (!values.previousSessionId) {
				await trpcClient.sessionEvent.create.mutate({
					liveTournamentSessionId: result.id,
					eventType: "update_stack",
					payload: {
						stackAmount: startingStack,
					},
				});
			}
			return result;
		},
		onSuccess: async () => {
			await invalidateTargets(queryClient, [
				{ queryKey: tournamentListKey },
				{ queryKey: sessionListKey },
			]);
			onClose();
			await navigate({ to: "/active-session" });
		},
	});

	const isLoading =
		createCashMutation.isPending || createTournamentMutation.isPending;

	return {
		rooms,
		currencies,
		ringGames,
		tournaments,
		promotableSessions,
		selectedRoomId,
		setSelectedRoomId,
		createCash: (values: {
			currencyId?: string;
			initialBuyIn: number;
			memo?: string;
			ringGameId?: string;
			roomId?: string;
		}) => createCashMutation.mutate(values),
		createTournament: (values: {
			buyIn: number;
			currencyId?: string;
			entryFee?: number;
			memo?: string;
			previousSessionId?: string;
			startingStack: number;
			roomId?: string;
			timerStartedAt?: number;
			tournamentId?: string;
		}) => createTournamentMutation.mutate(values),
		isLoading,
	};
}
