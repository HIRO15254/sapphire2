import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useState } from "react";
import { trpc } from "@/utils/trpc";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

interface UseAddPlayerSearchArgs {
	excludePlayerIds: string[];
	open: boolean;
}

export function useAddPlayerSearch({
	excludePlayerIds,
	open,
}: UseAddPlayerSearchArgs) {
	const [search, setSearch] = useState("");
	const [selectedTags, setSelectedTags] = useState<TagWithColor[]>([]);

	useEffect(() => {
		if (open) {
			setSearch("");
			setSelectedTags([]);
		}
	}, [open]);

	const deferredSearch = useDeferredValue(search);
	const selectedTagIds = selectedTags.map((t) => t.id);
	const queryInput = {
		...(deferredSearch ? { search: deferredSearch } : {}),
		...(selectedTagIds.length > 0 ? { tagIds: selectedTagIds } : {}),
	};

	const playersQuery = useQuery({
		...trpc.player.list.queryOptions(queryInput),
		enabled: open,
		placeholderData: keepPreviousData,
	});

	const allPlayers = playersQuery.data ?? [];
	const excludeSet = new Set(excludePlayerIds);
	const filteredPlayers = allPlayers.filter((p) => !excludeSet.has(p.id));

	const addSelectedTag = (tag: TagWithColor) =>
		setSelectedTags((prev) => [...prev, tag]);

	const removeSelectedTag = (tag: TagWithColor) =>
		setSelectedTags((prev) => prev.filter((t) => t.id !== tag.id));

	return {
		search,
		setSearch,
		selectedTags,
		selectedTagIds,
		addSelectedTag,
		removeSelectedTag,
		filteredPlayers,
	};
}
