import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export interface StatsCurrencyOption {
	id: string;
	name: string;
	unit: string | null;
}

export interface StatsRoomOption {
	id: string;
	name: string;
}

export interface UseStatsReferenceDataResult {
	currencies: StatsCurrencyOption[];
	isLoading: boolean;
	rooms: StatsRoomOption[];
}

export function useStatsReferenceData(): UseStatsReferenceDataResult {
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const roomsQuery = useQuery(trpc.room.list.queryOptions());

	const currencies: StatsCurrencyOption[] = (currenciesQuery.data ?? []).map(
		(c) => ({ id: c.id, name: c.name, unit: c.unit ?? null })
	);
	const rooms: StatsRoomOption[] = (roomsQuery.data ?? []).map((r) => ({
		id: r.id,
		name: r.name,
	}));

	return {
		currencies,
		rooms,
		isLoading: currenciesQuery.isLoading || roomsQuery.isLoading,
	};
}
