import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export function useStoreGames(
	storeId: string | undefined,
	options?: { includeAll?: boolean }
) {
	const includeAll = options?.includeAll ?? false;

	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByStore.queryOptions({ storeId: storeId ?? "" }),
		enabled: !!storeId,
	});
	const archivedRingGamesQuery = useQuery({
		...trpc.ringGame.listByStore.queryOptions({
			storeId: storeId ?? "",
			includeArchived: true,
		}),
		enabled: !!storeId && includeAll,
	});
	const tournamentsQuery = useQuery({
		...trpc.tournament.listByStore.queryOptions({ storeId: storeId ?? "" }),
		enabled: !!storeId,
	});
	const archivedTournamentsQuery = useQuery({
		...trpc.tournament.listByStore.queryOptions({
			storeId: storeId ?? "",
			includeArchived: true,
		}),
		enabled: !!storeId && includeAll,
	});

	const allRingGames = [
		...(ringGamesQuery.data ?? []),
		...(includeAll ? (archivedRingGamesQuery.data ?? []) : []),
	];
	const allTournaments = [
		...(tournamentsQuery.data ?? []),
		...(includeAll ? (archivedTournamentsQuery.data ?? []) : []),
	];

	return {
		ringGames: allRingGames.map((g) => ({
			id: g.id,
			name: g.name,
			variant: g.variant,
			blind1: g.blind1,
			blind2: g.blind2,
			blind3: g.blind3,
			ante: g.ante,
			anteType: g.anteType,
			tableSize: g.tableSize,
			currencyId: g.currencyId,
		})),
		tournaments: allTournaments.map((t) => ({
			id: t.id,
			name: t.name,
			buyIn: t.buyIn,
			entryFee: t.entryFee,
		})),
	};
}

export function useEntityLists() {
	const storesQuery = useQuery(trpc.store.list.queryOptions());
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	return {
		stores: (storesQuery.data ?? []).map((s) => ({ id: s.id, name: s.name })),
		currencies: (currenciesQuery.data ?? []).map((c) => ({
			id: c.id,
			name: c.name,
		})),
	};
}
