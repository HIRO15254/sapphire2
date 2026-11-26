import { useState } from "react";
import { isActive, type MasterKind } from "@/features/games/utils/game-masters";
import { useGamesLists } from "./use-games-lists";
import { useMasterActions } from "./use-master-actions";
import { useMasterForm } from "./use-master-form";

export type GamesTab = "games" | "mixes" | "structures";

const TAB_KIND = {
	games: "variant",
	mixes: "mix",
	structures: "group",
} as const satisfies Record<GamesTab, MasterKind>;

const NEW_LABELS = {
	games: "New game",
	mixes: "New mix",
	structures: "New structure",
} as const satisfies Record<GamesTab, string>;

function isTab(value: string): value is GamesTab {
	return value in TAB_KIND;
}

export function useGamesPage() {
	const [tab, setTab] = useState<GamesTab>("games");
	const lists = useGamesLists();
	const forms = useMasterForm(lists.data);
	const actions = useMasterActions(lists.data, forms.onEdit);

	return {
		...lists,
		...actions,
		...forms,
		activeGroups: lists.data.groups?.filter(isActive) ?? [],
		addLabel: NEW_LABELS[tab],
		onAdd: () => forms.onNew(TAB_KIND[tab]),
		onTabChange: (value: string) => {
			if (isTab(value)) {
				setTab(value);
			}
		},
		tab,
	};
}
