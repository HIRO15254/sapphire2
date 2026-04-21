import { useQuery } from "@tanstack/react-query";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import { trpc } from "@/utils/trpc";

export interface ChipPurchaseRow {
	chips: number;
	cost: number;
	id: string;
	name: string;
}

export function useTournamentDetail(tournamentId: string) {
	const tournamentQuery = useQuery({
		...trpc.tournament.getById.queryOptions({ id: tournamentId }),
		enabled: !!tournamentId,
	});
	const chipPurchasesQuery = useQuery({
		...trpc.tournamentChipPurchase.listByTournament.queryOptions({
			tournamentId,
		}),
		enabled: !!tournamentId,
	});
	const levelsQuery = useQuery({
		...trpc.blindLevel.listByTournament.queryOptions({ tournamentId }),
		enabled: !!tournamentId,
	});
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());

	return {
		tournament: tournamentQuery.data,
		isTournamentLoading: tournamentQuery.isLoading,
		chipPurchases: (chipPurchasesQuery.data ?? []) as ChipPurchaseRow[],
		levels: (levelsQuery.data ?? []) as BlindLevelRow[],
		isLevelsLoading: levelsQuery.isLoading,
		currencies: currenciesQuery.data ?? [],
	};
}

export type TournamentDetail = NonNullable<
	ReturnType<typeof useTournamentDetail>["tournament"]
>;
