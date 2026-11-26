import {
	useGameGroups,
	useGameMixes,
	useGameVariants,
} from "@/features/games/hooks/use-game-masters";
import {
	groupRows,
	type MasterData,
	mixRows,
	variantSections,
} from "@/features/games/utils/game-lists";
import { isActive } from "@/features/games/utils/game-masters";

function retryOf(query: { refetch: () => unknown }) {
	return () => {
		query.refetch();
	};
}

export function useGamesLists() {
	const groupsQuery = useGameGroups();
	const variantsQuery = useGameVariants();
	const mixesQuery = useGameMixes();
	const data: MasterData = {
		groups: groupsQuery.data,
		mixes: mixesQuery.data,
		variants: variantsQuery.data,
	};

	return {
		counts: {
			games: data.variants?.filter(isActive).length,
			mixes: data.mixes?.filter(isActive).length,
			structures: data.groups?.filter(isActive).length,
		},
		data,
		games: {
			groupsFailed: groupsQuery.isError,
			isGroupsRetrying: groupsQuery.isFetching,
			isLoading: variantsQuery.isPending,
			isRetrying: variantsQuery.isFetching,
			isVariantsFailed: variantsQuery.isError,
			sections: variantSections(data.groups, data.variants ?? []),
		},
		mixesTab: {
			...mixRows(data),
			isFailed: mixesQuery.isError,
			isLoading: mixesQuery.isPending,
			isRetrying: mixesQuery.isFetching,
		},
		onRetryGroups: retryOf(groupsQuery),
		onRetryMixes: retryOf(mixesQuery),
		onRetryVariants: retryOf(variantsQuery),
		structures: {
			...groupRows(data),
			isFailed: groupsQuery.isError,
			isLoading: groupsQuery.isPending,
			isRetrying: groupsQuery.isFetching,
		},
	};
}
