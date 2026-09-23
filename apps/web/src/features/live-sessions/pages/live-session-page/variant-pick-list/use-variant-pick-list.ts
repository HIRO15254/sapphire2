import { useState } from "react";
import {
	filterVariantOptions,
	type VariantOption,
} from "@/features/live-sessions/utils/mix-composition";
import { useGameGroups } from "@/shared/hooks/use-game-groups";

export function useVariantPickList() {
	const { groups, isLoading, variants } = useGameGroups();
	const [query, setQuery] = useState("");

	const groupLabelById = new Map(
		groups.map((group) => [group.id, group.label])
	);
	const options: VariantOption[] = variants.map((variant) => ({
		groupLabel: groupLabelById.get(variant.groupId) ?? "",
		label: variant.label,
		shortLabel: variant.shortLabel,
	}));

	return {
		isLoading,
		onQueryChange: setQuery,
		options: filterVariantOptions(options, query),
		query,
	};
}
