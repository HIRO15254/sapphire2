import {
	IconBolt,
	IconCamera,
	IconCards,
	IconCircleCheck,
	IconPlayerPause,
	IconTags,
	IconTrash,
	IconUser,
	IconUserPlus,
} from "@tabler/icons-react";
import { useState } from "react";
import type { ActionsDrawerItem } from "@/features/live-sessions/components/actions-drawer";
import { useEventMenu } from "@/features/live-sessions/hooks/use-event-menu";
import { useStackSheet } from "@/features/live-sessions/hooks/use-stack-sheet";
import type { ActiveSessionSceneState } from "./use-active-session-scene-state";

interface UseActiveSessionSceneOptions {
	/** Session-type-specific event actions appended after the common ones. */
	eventMenuExtraItems: ActionsDrawerItem[];
	onEndSession: () => void;
	onPause: () => void;
	state: ActiveSessionSceneState;
}

/**
 * UI layer for the active-session scene: builds the "+" event menu (priority
 * order from SA2-59: stack → player notes → seating → other events), the
 * header session menu, and the player picker, plus the open state of the
 * scene-owned dialogs.
 */
export function useActiveSessionScene({
	eventMenuExtraItems,
	onEndSession,
	onPause,
	state,
}: UseActiveSessionSceneOptions) {
	const eventMenu = useEventMenu();
	const stackSheet = useStackSheet();
	const [isDiscardOpen, setIsDiscardOpen] = useState(false);
	const [isScanSheetOpen, setIsScanSheetOpen] = useState(false);
	const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
	const [isPlayerPickerOpen, setIsPlayerPickerOpen] = useState(false);
	const [isGameSettingsOpen, setIsGameSettingsOpen] = useState(false);

	const sessionId =
		state.sessionParam.liveCashGameSessionId ??
		state.sessionParam.liveTournamentSessionId;
	const sessionType: "cash_game" | "tournament" = state.sessionParam
		.liveCashGameSessionId
		? "cash_game"
		: "tournament";

	const eventMenuItems: ActionsDrawerItem[] = [
		{
			icon: IconBolt,
			label: "Record stack",
			onSelect: () => {
				eventMenu.close();
				stackSheet.open();
			},
		},
		{
			icon: IconTags,
			label: "Player notes & tags",
			onSelect: () => {
				eventMenu.close();
				setIsPlayerPickerOpen(true);
			},
		},
		{
			icon: IconUserPlus,
			label: "Seat player",
			onSelect: () => {
				eventMenu.close();
				state.onOpenAddPlayer();
			},
		},
		{
			icon: IconCamera,
			label: "Seat from screenshot",
			onSelect: () => {
				eventMenu.close();
				setIsScanSheetOpen(true);
			},
		},
		...eventMenuExtraItems.map((item) => ({
			...item,
			onSelect: () => {
				eventMenu.close();
				item.onSelect();
			},
		})),
	];

	const sessionMenuItems: ActionsDrawerItem[] = [
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

	const playerPickerItems: ActionsDrawerItem[] = state.players.map(
		(player) => ({
			icon: IconUser,
			// Seated players collapse to one row per session_table_player; the
			// table-player id is the stable key (names repeat — temp players are
			// all "Anonymous" and seatless, so the label is not unique).
			key: player.id,
			label:
				player.seatPosition === null
					? player.name
					: `${player.name} · Seat ${player.seatPosition + 1}`,
			onSelect: () => {
				setIsPlayerPickerOpen(false);
				state.onPlayerTap(player.playerId);
			},
		})
	);

	return {
		eventMenuItems,
		isDiscardOpen,
		isEventMenuOpen: eventMenu.isOpen,
		isGameSettingsOpen,
		isPlayerPickerOpen,
		isScanSheetOpen,
		isSessionMenuOpen,
		onOpenSessionMenu: () => setIsSessionMenuOpen(true),
		playerPickerItems,
		sessionId,
		sessionMenuItems,
		sessionType,
		setEventMenuOpen: eventMenu.setIsOpen,
		setIsDiscardOpen,
		setIsGameSettingsOpen,
		setIsPlayerPickerOpen,
		setIsScanSheetOpen,
		setIsSessionMenuOpen,
	};
}
