import { IconAlertTriangle } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { AddPlayerSheet } from "@/features/live-sessions/components/add-player-sheet";
import { PlayerDetailSheet } from "@/features/live-sessions/components/player-detail-sheet";
import {
	PokerTable,
	type TableGameInfo,
	type TablePlayer,
} from "@/features/live-sessions/components/poker-table";
import { SeatFromScreenshotSheet } from "@/features/live-sessions/components/seat-from-screenshot-sheet";
import type { PlayerFormValues } from "@/features/players/components/player-form";
import type {
	PlayerDetailData,
	PlayerTagWithColor,
} from "@/features/players/hooks/use-player-detail";
import { usePlayerDetail } from "@/features/players/hooks/use-player-detail";
import { usePokerTableInteraction } from "@/features/players/hooks/use-poker-table-interaction";
import { useTablePlayers } from "@/features/players/hooks/use-table-players";
import { PageHeader } from "@/shared/components/page-header";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { useActiveSessionScene } from "./use-active-session-scene";

type SessionParam =
	| { liveCashGameSessionId: string; liveTournamentSessionId?: never }
	| { liveCashGameSessionId?: never; liveTournamentSessionId: string };

interface ActiveSessionSceneProps {
	discardDescription?: ReactNode;
	gameInfo?: TableGameInfo;
	isDiscardPending: boolean;
	memo?: string | null;
	onDiscard: () => void;
	state: ActiveSessionSceneState;
	summary: ReactNode;
	tableSize?: number | null;
	title: string;
	topSlot?: ReactNode;
}

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
	onAddExisting: (playerId: string, playerName: string) => void;
	onAddNew: (values: {
		memo?: string | null;
		name: string;
		tagIds?: string[];
	}) => void;
	onAddTemporary: () => void;
	onEmptySeatTap: (seatPosition: number) => void;
	onHeroSeatTap: () => void;
	onPlayerRemove: () => void;
	onPlayerSave: (values: PlayerFormValues) => void;
	onPlayerSeatTap: (player: TablePlayer, seatPosition: number) => void;
	playerSheetOpen: boolean;
	players: TablePlayer[];
	selectedPlayer: (PlayerDetailData & { isTemporary: boolean }) | null;
	sessionParam: SessionParam;
	setAddPlayerSheetOpen: (open: boolean) => void;
	setPlayerSheetOpen: (open: boolean) => void;
	waitingForHero: boolean;
}

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
	const tableInteraction = usePokerTableInteraction(
		sessionType,
		sessionId,
		heroSeatPosition
	);
	const playerDetail = usePlayerDetail(
		tableInteraction.selectedPlayer?.playerId ?? null
	);

	return {
		addPlayerSheetOpen: tableInteraction.addPlayerSeat !== null,
		availableTags: playerDetail.availableTags,
		createTag: playerDetail.createTag,
		excludePlayerIds: tablePlayers.excludePlayerIds,
		heroSeatPosition: tableInteraction.heroSeatPosition,
		isSavingPlayer: playerDetail.isSaving,
		onAddExisting: (playerId, playerName) => {
			const seatPosition = tableInteraction.addPlayerSeat;
			if (seatPosition !== null) {
				tablePlayers.handleAddExisting(playerId, playerName, seatPosition);
			}
			tableInteraction.setAddPlayerSeat(null);
		},
		onAddNew: ({ name, memo, tagIds }) => {
			const seatPosition = tableInteraction.addPlayerSeat;
			if (seatPosition !== null) {
				tablePlayers.handleAddNew(
					name,
					seatPosition,
					memo ?? undefined,
					tagIds
				);
			}
			tableInteraction.setAddPlayerSeat(null);
		},
		onAddTemporary: () => {
			const seatPosition = tableInteraction.addPlayerSeat;
			if (seatPosition !== null) {
				tablePlayers.handleAddTemporary(seatPosition);
			}
			tableInteraction.setAddPlayerSeat(null);
		},
		onEmptySeatTap: tableInteraction.handleEmptySeatTap,
		onHeroSeatTap: tableInteraction.handleHeroSeatTap,
		onPlayerRemove: () => {
			if (tableInteraction.selectedPlayer) {
				tablePlayers.handleRemovePlayer(
					tableInteraction.selectedPlayer.playerId
				);
				tableInteraction.setSelectedPlayer(null);
			}
		},
		onPlayerSave: (values) => {
			if (tableInteraction.selectedPlayer) {
				playerDetail.updatePlayer({
					id: tableInteraction.selectedPlayer.playerId,
					memo: values.memo,
					name: values.name,
					tagIds: values.tagIds,
				});
			}
		},
		onPlayerSeatTap: tableInteraction.handlePlayerSeatTap,
		players: tablePlayers.players as TablePlayer[],
		playerSheetOpen: tableInteraction.selectedPlayer !== null,
		selectedPlayer: playerDetail.player
			? {
					id: playerDetail.player.id,
					isTemporary:
						tablePlayers.players.find(
							(p) => p.player.id === tableInteraction.selectedPlayer?.playerId
						)?.player.isTemporary ?? false,
					memo: playerDetail.player.memo,
					name: playerDetail.player.name,
					tags: playerDetail.player.tags ?? [],
				}
			: null,
		sessionParam,
		setAddPlayerSheetOpen: (open) => {
			if (!open) {
				tableInteraction.setAddPlayerSeat(null);
			}
		},
		setPlayerSheetOpen: (open) => {
			if (!open) {
				tableInteraction.setSelectedPlayer(null);
			}
		},
		waitingForHero: tableInteraction.waitingForHero,
	};
}

function DiscardDialog({
	description,
	isOpen,
	isPending,
	onClose,
	onConfirm,
}: {
	description: ReactNode;
	isOpen: boolean;
	isPending: boolean;
	onClose: () => void;
	onConfirm: () => void;
}) {
	return (
		<ResponsiveDialog
			description={description}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open={isOpen}
			title="Discard Session"
		>
			<div className="flex flex-col gap-4">
				<div className="flex items-start gap-3 text-destructive">
					<IconAlertTriangle className="mt-0.5 shrink-0" size={20} />
					<p className="text-sm">{description}</p>
				</div>
				<DialogActionRow>
					<Button onClick={onClose} type="button" variant="outline">
						Cancel
					</Button>
					<Button
						disabled={isPending}
						onClick={onConfirm}
						type="button"
						variant="destructive"
					>
						{isPending ? "Discarding..." : "Discard"}
					</Button>
				</DialogActionRow>
			</div>
		</ResponsiveDialog>
	);
}

export function ActiveSessionScene({
	discardDescription = "This will permanently delete this session and all its events.",
	gameInfo,
	isDiscardPending,
	memo,
	onDiscard,
	state,
	summary,
	tableSize,
	title,
	topSlot,
}: ActiveSessionSceneProps) {
	const {
		isDiscardOpen,
		setIsDiscardOpen,
		isScanSheetOpen,
		setIsScanSheetOpen,
		occupiedSeatPositions,
	} = useActiveSessionScene({ players: state.players });

	return (
		<>
			<PageHeader
				actions={
					<Button
						className="text-destructive hover:text-destructive"
						onClick={() => setIsDiscardOpen(true)}
						size="sm"
						type="button"
						variant="ghost"
					>
						Discard
					</Button>
				}
				heading={
					<span className="flex items-center gap-2">
						{title}
						<Badge
							className="border-green-200 bg-green-50 text-[10px] text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
							variant="outline"
						>
							Active
						</Badge>
					</span>
				}
				size="compact"
			/>

			{topSlot ? <div className="mb-2">{topSlot}</div> : null}

			<div>{summary}</div>

			{memo ? (
				<p className="mt-1 text-muted-foreground text-xs">{memo}</p>
			) : null}

			<div className="mt-3 min-h-0 flex-1">
				<PokerTable
					gameInfo={gameInfo}
					heroSeatPosition={state.heroSeatPosition}
					onEmptySeatTap={state.onEmptySeatTap}
					onHeroSeatTap={state.onHeroSeatTap}
					onPlayerSeatTap={state.onPlayerSeatTap}
					onScanPlayers={() => setIsScanSheetOpen(true)}
					players={state.players}
					tableSize={tableSize}
					waitingForHero={state.waitingForHero}
				/>
			</div>

			<AddPlayerSheet
				availableTags={state.availableTags}
				excludePlayerIds={state.excludePlayerIds}
				onAddExisting={state.onAddExisting}
				onAddNew={state.onAddNew}
				onAddTemporary={state.onAddTemporary}
				onCreateTag={state.createTag}
				onOpenChange={state.setAddPlayerSheetOpen}
				open={state.addPlayerSheetOpen}
			/>

			<PlayerDetailSheet
				availableTags={state.availableTags}
				isSaving={state.isSavingPlayer}
				isTemporary={state.selectedPlayer?.isTemporary ?? false}
				onCreateTag={state.createTag}
				onOpenChange={state.setPlayerSheetOpen}
				onRemove={state.onPlayerRemove}
				onSave={state.onPlayerSave}
				open={state.playerSheetOpen}
				player={state.selectedPlayer}
			/>

			<SeatFromScreenshotSheet
				heroSeatPosition={state.heroSeatPosition}
				occupiedSeatPositions={occupiedSeatPositions}
				onOpenChange={setIsScanSheetOpen}
				open={isScanSheetOpen}
				sessionParam={state.sessionParam}
			/>

			<DiscardDialog
				description={discardDescription}
				isOpen={isDiscardOpen}
				isPending={isDiscardPending}
				onClose={() => setIsDiscardOpen(false)}
				onConfirm={onDiscard}
			/>
		</>
	);
}
