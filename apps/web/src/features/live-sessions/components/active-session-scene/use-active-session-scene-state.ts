import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { PlayerFormValues } from "@/features/players/components/player-form";
import type {
	PlayerDetailData,
	PlayerTagWithColor,
} from "@/features/players/hooks/use-player-detail";
import { usePlayerDetail } from "@/features/players/hooks/use-player-detail";
import { useTablePlayers } from "@/features/players/hooks/use-table-players";
import { trpc } from "@/utils/trpc";
import type { PlayerListItem } from "./player-list";

export type SessionParam =
	| { liveCashGameSessionId: string; liveTournamentSessionId?: never }
	| { liveCashGameSessionId?: never; liveTournamentSessionId: string };

interface UseActiveSessionSceneStateOptions {
	heroSeatPosition: number | null;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}

export interface ActiveSessionSceneState {
	addPlayerSheetOpen: boolean;
	availableTags: PlayerTagWithColor[];
	createTag: (name: string) => Promise<PlayerTagWithColor>;
	excludePlayerIds: string[];
	heroSeatPosition: number | null;
	isSavingPlayer: boolean;
	occupiedSeatPositions: Set<number>;
	onAddExisting: (playerId: string, playerName: string) => void;
	onAddNew: (values: {
		memo?: string | null;
		name: string;
		tagIds?: string[];
	}) => void;
	onAddTemporary: () => void;
	onOpenAddPlayer: () => void;
	onPlayerRemove: () => void;
	onPlayerSave: (values: PlayerFormValues) => void;
	onPlayerTap: (playerId: string) => void;
	playerSheetOpen: boolean;
	players: PlayerListItem[];
	selectedPlayer: (PlayerDetailData & { isTemporary: boolean }) | null;
	sessionParam: SessionParam;
	setAddPlayerSheetOpen: (open: boolean) => void;
	setPlayerSheetOpen: (open: boolean) => void;
}

function comparePlayers(a: PlayerListItem, b: PlayerListItem): number {
	if (a.seatPosition !== null && b.seatPosition !== null) {
		return a.seatPosition - b.seatPosition;
	}
	if (a.seatPosition !== null) {
		return -1;
	}
	if (b.seatPosition !== null) {
		return 1;
	}
	return a.name.localeCompare(b.name);
}

/**
 * Data/state layer for the active-session scene: seated-player list (with tag
 * badges joined from the player list), add-player sheet, and player detail
 * (memo / tags / leave) selection. Seats are optional — players join without
 * one unless screenshot seating assigned it.
 */
export function useActiveSessionSceneState({
	heroSeatPosition,
	sessionId,
	sessionType,
}: UseActiveSessionSceneStateOptions): ActiveSessionSceneState {
	const sessionParam: SessionParam =
		sessionType === "cash_game"
			? { liveCashGameSessionId: sessionId }
			: { liveTournamentSessionId: sessionId };
	const tablePlayers = useTablePlayers(
		sessionType === "cash_game"
			? { liveCashGameSessionId: sessionId }
			: { liveTournamentSessionId: sessionId }
	);
	const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
	const [addPlayerSheetOpen, setAddPlayerSheetOpen] = useState(false);
	const playerDetail = usePlayerDetail(selectedPlayerId);

	const playerListQuery = useQuery(trpc.player.list.queryOptions());
	const tagsByPlayerId = useMemo(() => {
		const map = new Map<string, PlayerListItem["tags"]>();
		for (const p of playerListQuery.data ?? []) {
			map.set(p.id, p.tags);
		}
		return map;
	}, [playerListQuery.data]);

	const activeTablePlayers = tablePlayers.players.filter((p) => p.isActive);

	const players: PlayerListItem[] = activeTablePlayers
		.map((p) => ({
			id: p.id,
			isLoading: p.isLoading,
			isTemporary: p.player.isTemporary,
			name: p.player.name,
			playerId: p.player.id,
			seatPosition: p.seatPosition,
			tags: tagsByPlayerId.get(p.player.id) ?? [],
		}))
		.sort(comparePlayers);

	const occupiedSeatPositions = new Set<number>();
	for (const p of activeTablePlayers) {
		if (typeof p.seatPosition === "number") {
			occupiedSeatPositions.add(p.seatPosition);
		}
	}

	return {
		addPlayerSheetOpen,
		availableTags: playerDetail.availableTags,
		createTag: playerDetail.createTag,
		excludePlayerIds: tablePlayers.excludePlayerIds,
		heroSeatPosition,
		isSavingPlayer: playerDetail.isSaving,
		occupiedSeatPositions,
		onAddExisting: (playerId, playerName) => {
			tablePlayers.handleAddExisting(playerId, playerName, undefined);
			setAddPlayerSheetOpen(false);
		},
		onAddNew: ({ name, memo, tagIds }) => {
			tablePlayers.handleAddNew(name, undefined, memo ?? undefined, tagIds);
			setAddPlayerSheetOpen(false);
		},
		onAddTemporary: () => {
			tablePlayers.handleAddTemporary();
			setAddPlayerSheetOpen(false);
		},
		onOpenAddPlayer: () => setAddPlayerSheetOpen(true),
		onPlayerRemove: () => {
			if (selectedPlayerId) {
				tablePlayers.handleRemovePlayer(selectedPlayerId);
				setSelectedPlayerId(null);
			}
		},
		onPlayerSave: (values) => {
			if (selectedPlayerId) {
				playerDetail.updatePlayer({
					id: selectedPlayerId,
					memo: values.memo,
					name: values.name,
					tagIds: values.tagIds,
				});
			}
		},
		onPlayerTap: (playerId) => setSelectedPlayerId(playerId),
		players,
		playerSheetOpen: selectedPlayerId !== null,
		selectedPlayer: playerDetail.player
			? {
					id: playerDetail.player.id,
					isTemporary:
						activeTablePlayers.find((p) => p.player.id === selectedPlayerId)
							?.player.isTemporary ?? false,
					memo: playerDetail.player.memo,
					name: playerDetail.player.name,
					tags: playerDetail.player.tags ?? [],
				}
			: null,
		sessionParam,
		setAddPlayerSheetOpen: (open) => {
			setAddPlayerSheetOpen(open);
		},
		setPlayerSheetOpen: (open) => {
			if (!open) {
				setSelectedPlayerId(null);
			}
		},
	};
}
