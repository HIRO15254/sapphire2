import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export function useStoreGames(storeId: string | undefined) {
	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByStore.queryOptions({ storeId: storeId ?? "" }),
		enabled: !!storeId,
	});
	const tournamentsQuery = useQuery({
		...trpc.tournament.listByStore.queryOptions({ storeId: storeId ?? "" }),
		enabled: !!storeId,
	});
	return {
		ringGames: (ringGamesQuery.data ?? []).map((g) => {
			const primarySet = g.blindSets[0];
			return {
				id: g.id,
				name: g.name,
				variantId: g.variantId,
				blind1: primarySet?.blind1 ?? null,
				blind2: primarySet?.blind2 ?? null,
				blind3: primarySet?.blind3 ?? null,
				ante: primarySet?.ante ?? null,
				anteType: primarySet?.anteType ?? null,
				tableSize: g.tableSize,
				currencyId: g.currencyId,
			};
		}),
		tournaments: (tournamentsQuery.data ?? []).map((t) => ({
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
