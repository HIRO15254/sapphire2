import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trpc, trpcClient } from "@/utils/trpc";

function useStoreRingGames(storeId: string | undefined) {
	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByStore.queryOptions({ storeId: storeId ?? "" }),
		enabled: !!storeId,
	});
	return (ringGamesQuery.data ?? []).map((g) => ({
		id: g.id,
		name: g.name,
		maxBuyIn: g.maxBuyIn,
		currencyId: g.currencyId,
	}));
}

function useStoreTournaments(storeId: string | undefined) {
	const tournamentsQuery = useQuery({
		...trpc.tournament.listByStore.queryOptions({
			storeId: storeId ?? "",
			includeArchived: false,
		}),
		enabled: !!storeId,
	});
	return (tournamentsQuery.data ?? []).map((t) => ({
		id: t.id,
		name: t.name,
		buyIn: t.buyIn,
		entryFee: t.entryFee,
		startingStack: t.startingStack,
		currencyId: t.currencyId,
	}));
}

export function useCreateSession({ onClose }: { onClose: () => void }) {
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const storesQuery = useQuery(trpc.store.list.queryOptions());
	const stores = (storesQuery.data ?? []).map((s) => ({
		id: s.id,
		name: s.name,
	}));

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = (currenciesQuery.data ?? []).map((c) => ({
		id: c.id,
		name: c.name,
	}));

	const ringGames = useStoreRingGames(selectedStoreId);
	const tournaments = useStoreTournaments(selectedStoreId);

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
			storeId?: string;
		}) => trpcClient.liveCashGameSession.create.mutate(values),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: cashListKey }),
				queryClient.invalidateQueries({ queryKey: sessionListKey }),
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
			startingStack: number;
			storeId?: string;
			tournamentId?: string;
		}) => {
			const { startingStack, ...createValues } = values;
			const result =
				await trpcClient.liveTournamentSession.create.mutate(createValues);
			// Create initial tournament_stack_record with starting stack
			await trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: result.id,
				eventType: "tournament_stack_record",
				payload: {
					stackAmount: startingStack,
					remainingPlayers: null,
					totalEntries: null,
					chipPurchases: [],
					chipPurchaseCounts: [],
				},
			});
			return result;
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: tournamentListKey }),
				queryClient.invalidateQueries({ queryKey: sessionListKey }),
			]);
			onClose();
			await navigate({ to: "/active-session" });
		},
	});

	const isLoading =
		createCashMutation.isPending || createTournamentMutation.isPending;

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
		}) => createCashMutation.mutate(values),
		createTournament: (values: {
			buyIn: number;
			currencyId?: string;
			entryFee?: number;
			memo?: string;
			startingStack: number;
			storeId?: string;
			tournamentId?: string;
		}) => createTournamentMutation.mutate(values),
		isLoading,
	};
}
