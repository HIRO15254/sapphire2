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
	eventMenuExtraItems: ActionsDrawerItem[];
	onEndSession: () => void;
	onPause: () => void;
	state: ActiveSessionSceneState;
}

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
