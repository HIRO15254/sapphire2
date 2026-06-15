import {
	IconCards,
	IconCircleCheck,
	IconPlayerPause,
	IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import type { ActionsDrawerItem } from "@/features/live-sessions/components/actions-drawer";
import type { ActiveSessionSceneState } from "./use-active-session-scene-state";

interface UseActiveSessionSceneOptions {
	/**
	 * Session-type-specific event actions (all-in / chips / memo …) shown at the
	 * top of the header "…" menu, above the lifecycle actions. Stack recording is
	 * reached from the bottom-nav center button; seating and player notes happen
	 * inline in the seat list, so they are not part of this menu.
	 */
	eventMenuExtraItems: ActionsDrawerItem[];
	onEndSession: () => void;
	onPause: () => void;
	state: ActiveSessionSceneState;
}

/**
 * UI layer for the active-session scene: builds the header "…" menu (the
 * type-specific event actions followed by pause / end / game settings /
 * discard) and owns the open state of the scene-level dialogs.
 */
export function useActiveSessionScene({
	eventMenuExtraItems,
	onEndSession,
	onPause,
	state,
}: UseActiveSessionSceneOptions) {
	const [isDiscardOpen, setIsDiscardOpen] = useState(false);
	const [isScanSheetOpen, setIsScanSheetOpen] = useState(false);
	const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
	const [isGameSettingsOpen, setIsGameSettingsOpen] = useState(false);

	const sessionId =
		state.sessionParam.liveCashGameSessionId ??
		state.sessionParam.liveTournamentSessionId;
	const sessionType: "cash_game" | "tournament" = state.sessionParam
		.liveCashGameSessionId
		? "cash_game"
		: "tournament";

	const lifecycleItems: ActionsDrawerItem[] = [
		{
			icon: IconPlayerPause,
			label: "Pause session",
			onSelect: () => {
				setIsSessionMenuOpen(false);
				onPause();
			},
		},
		{
			icon: IconCircleCheck,
			label: "End session",
			onSelect: () => {
				setIsSessionMenuOpen(false);
				onEndSession();
			},
		},
		{
			icon: IconCards,
			label: "Game settings",
			onSelect: () => {
				setIsSessionMenuOpen(false);
				setIsGameSettingsOpen(true);
			},
		},
		{
			icon: IconTrash,
			label: "Discard session",
			onSelect: () => {
				setIsSessionMenuOpen(false);
				setIsDiscardOpen(true);
			},
			tone: "destructive" as const,
		},
	];

	const sessionMenuItems: ActionsDrawerItem[] = [
		...eventMenuExtraItems.map((item) => ({
			...item,
			onSelect: () => {
				setIsSessionMenuOpen(false);
				item.onSelect();
			},
		})),
		...lifecycleItems,
	];

	return {
		isDiscardOpen,
		isGameSettingsOpen,
		isScanSheetOpen,
		isSessionMenuOpen,
		onOpenSessionMenu: () => setIsSessionMenuOpen(true),
		sessionId,
		sessionMenuItems,
		sessionType,
		setIsDiscardOpen,
		setIsGameSettingsOpen,
		setIsScanSheetOpen,
		setIsSessionMenuOpen,
	};
}
