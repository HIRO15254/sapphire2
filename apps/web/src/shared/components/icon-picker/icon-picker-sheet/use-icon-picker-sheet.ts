import {
	type ChangeEvent,
	type MouseEvent,
	type UIEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { loadIconSearchIndex } from "@/shared/lib/tabler-icons/icon-data";
import {
	type IconSearchIndex,
	searchIcons,
} from "@/shared/lib/tabler-icons/icon-search";
import type { SuggestedIconGroup } from "@/shared/lib/tabler-icons/suggested-icons";

const PAGE_SIZE = 210;
const LOAD_MORE_THRESHOLD = 240;

export interface IconPickerSheetGroup {
	label: string;
	names: string[];
}

interface UseIconPickerSheetOptions {
	all: boolean;
	allLabel: string;
	emptyLabel: string;
	icons: SuggestedIconGroup[];
	onPick: (name: string) => void;
	required: boolean;
	selectedLabel: string;
	value: string;
}

function baseGroups(
	index: IconSearchIndex,
	icons: SuggestedIconGroup[],
	all: boolean,
	allLabel: string
): IconPickerSheetGroup[] {
	const known = new Set(index.entries.map((entry) => entry.name));
	const groups = icons
		.map((group) => ({
			label: group.label,
			names: group.icons
				.map(([name]) => name)
				.filter((name) => known.has(name)),
		}))
		.filter((group) => group.names.length > 0);
	if (all) {
		groups.push({
			label: allLabel,
			names: index.entries.map((entry) => entry.name),
		});
	}
	return groups;
}

function limitGroups(
	groups: IconPickerSheetGroup[],
	limit: number
): { hasMore: boolean; shown: IconPickerSheetGroup[] } {
	let room = limit;
	const shown: IconPickerSheetGroup[] = [];
	for (const group of groups) {
		if (room <= 0) {
			return { hasMore: true, shown };
		}
		shown.push({ label: group.label, names: group.names.slice(0, room) });
		room -= group.names.length;
	}
	return { hasMore: room < 0, shown };
}

export function useIconPickerSheet({
	all,
	allLabel,
	emptyLabel,
	icons,
	onPick,
	required,
	selectedLabel,
	value,
}: UseIconPickerSheetOptions) {
	const [index, setIndex] = useState<IconSearchIndex | null>(null);
	const [isError, setIsError] = useState(false);
	const [query, setQuery] = useState("");
	const [limit, setLimit] = useState(PAGE_SIZE);
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let active = true;
		loadIconSearchIndex().then(
			(loaded) => {
				if (active) {
					setIndex(loaded);
				}
			},
			() => {
				if (active) {
					setIsError(true);
				}
			}
		);
		return () => {
			active = false;
		};
	}, []);

	const groups = useMemo(
		() => (index ? baseGroups(index, icons, all, allLabel) : []),
		[index, icons, all, allLabel]
	);

	const isSearching = query.trim() !== "";

	const matched = useMemo((): IconPickerSheetGroup[] => {
		if (!index) {
			return [];
		}
		if (isSearching) {
			const allowed = all
				? null
				: new Set(groups.flatMap((group) => group.names));
			const names = searchIcons(index, query).filter(
				(name) => !allowed || allowed.has(name)
			);
			return names.length > 0 ? [{ label: "", names }] : [];
		}
		const suggested = new Set(
			groups
				.filter((group) => !all || group.label !== allLabel)
				.flatMap((group) => group.names)
		);
		if (value && !suggested.has(value)) {
			return [{ label: selectedLabel, names: [value] }, ...groups];
		}
		return groups;
	}, [index, isSearching, query, all, groups, allLabel, selectedLabel, value]);

	const { hasMore, shown } = useMemo(
		() => limitGroups(matched, limit),
		[matched, limit]
	);

	useEffect(() => {
		const list = listRef.current;
		if (!(index && list)) {
			return;
		}
		const current = list.querySelector<HTMLElement>('[aria-pressed="true"]');
		if (current) {
			list.scrollTop = Math.max(
				0,
				current.offsetTop - (list.clientHeight - current.offsetHeight) / 2
			);
		}
	}, [index]);

	const onQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setQuery(event.target.value);
		setLimit(PAGE_SIZE);
		if (listRef.current) {
			listRef.current.scrollTop = 0;
		}
	}, []);

	const onListScroll = useCallback(
		(event: UIEvent<HTMLDivElement>) => {
			const list = event.currentTarget;
			if (
				hasMore &&
				list.scrollTop + list.clientHeight >
					list.scrollHeight - LOAD_MORE_THRESHOLD
			) {
				setLimit((current) => current + PAGE_SIZE);
			}
		},
		[hasMore]
	);

	const onTileClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			onPick(event.currentTarget.dataset.icon ?? "");
		},
		[onPick]
	);

	const isLoading = !(index || isError);

	return {
		emptyMessage: isError ? "Icons could not be loaded" : emptyLabel,
		isLoading,
		listRef,
		onListScroll,
		onQueryChange,
		onTileClick,
		query,
		showEmpty: !isLoading && shown.length === 0,
		showNone: !(isLoading || required || isSearching),
		shown,
	};
}
