import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

function useStoreRingGames(storeId: string | undefined) {
	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByStore.queryOptions({ storeId: storeId ?? "" }),
		enabled: !!storeId,
	});
	return (ringGamesQuery.data ?? []).map((g) => ({
		id: g.id,
		name: g.name,
		minBuyIn: g.minBuyIn,
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

export function useLiveSessionCreate({ onClose }: { onClose: () => void }) {
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

	const sessionListKey = trpc.session.list.queryOptions({}).queryKey;

	const createCashMutation = useMutation({
		mutationFn: (values: {
			buyInAmount: number;
			currencyId?: string;
			memo?: string;
			ringGameId?: string;
			sessionDate: string;
			storeId?: string;
		}) =>
			trpcClient.liveSession.create.mutate({
				kind: "cash_game",
				...values,
			}),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionListKey }]);
			onClose();
			await navigate({ to: "/active-session" });
		},
	});

	const createTournamentMutation = useMutation({
		mutationFn: (values: {
			currencyId?: string;
			memo?: string;
			sessionDate: string;
			storeId?: string;
			timerStartedAt?: Date;
			tournamentId?: string;
		}) => trpcClient.liveSession.create.mutate({ kind: "tournament", ...values }),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionListKey }]);
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
			buyInAmount: number;
			currencyId?: string;
			memo?: string;
			ringGameId?: string;
			sessionDate: string;
			storeId?: string;
		}) => createCashMutation.mutate(values),
		createTournament: (values: {
			currencyId?: string;
			memo?: string;
			sessionDate: string;
			storeId?: string;
			timerStartedAt?: Date;
			tournamentId?: string;
		}) => createTournamentMutation.mutate(values),
		isLoading,
	};
}
