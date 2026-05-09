import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export interface ChipPurchaseRow {
	chips: number;
	cost: number;
	id: string;
	name: string;
}

export interface BlindSetRow {
	ante: number | null;
	anteType: string | null;
	blind1: number;
	blind2: number;
	blind3: number | null;
	blind4: number | null;
	id: number;
	sortOrder: number;
}

export interface BlindLevelRow {
	blindSets: BlindSetRow[];
	id: number;
	isBreak: boolean;
	levelIndex: number;
	minutes: number | null;
	sortOrder: number;
	tournamentId: string;
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
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());

	const levels = (tournamentQuery.data?.blindLevels ?? []) as BlindLevelRow[];

	return {
		tournament: tournamentQuery.data,
		isTournamentLoading: tournamentQuery.isLoading,
		chipPurchases: (chipPurchasesQuery.data ?? []) as ChipPurchaseRow[],
		levels,
		isLevelsLoading: tournamentQuery.isLoading,
		currencies: currenciesQuery.data ?? [],
	};
}

export type TournamentDetail = NonNullable<
	ReturnType<typeof useTournamentDetail>["tournament"]
>;
