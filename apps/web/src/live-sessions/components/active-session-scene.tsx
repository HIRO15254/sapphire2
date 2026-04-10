import { IconAlertTriangle } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { AddPlayerSheet } from "@/live-sessions/components/add-player-sheet";
import { PlayerDetailSheet } from "@/live-sessions/components/player-detail-sheet";
import {
	PokerTable,
	type TableGameInfo,
	type TablePlayer,
} from "@/live-sessions/components/poker-table";
import type { PlayerFormValues } from "@/players/components/player-form";
import type {
	PlayerDetailData,
	PlayerTagWithColor,
} from "@/players/hooks/use-player-detail";
import { usePlayerDetail } from "@/players/hooks/use-player-detail";
import { usePokerTableInteraction } from "@/players/hooks/use-poker-table-interaction";
import { useTablePlayers } from "@/players/hooks/use-table-players";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

interface ActiveSessionSceneProps {
	discardDescription?: ReactNode;
	gameInfo?: TableGameInfo;
	isDiscardPending: boolean;
	memo?: string | null;
	onDiscard: () => void;
	state: ActiveSessionSceneState;
	summary: ReactNode;
	title: string;
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
	onEmptySeatTap: (seatPosition: number) => void;
	onHeroSeatTap: () => void;
	onPlayerRemove: () => void;
	onPlayerSave: (values: PlayerFormValues) => void;
	onPlayerSeatTap: (player: TablePlayer, seatPosition: number) => void;
	playerSheetOpen: boolean;
	players: TablePlayer[];
	selectedPlayer: PlayerDetailData | null;
	setAddPlayerSheetOpen: (open: boolean) => void;
	setPlayerSheetOpen: (open: boolean) => void;
	waitingForHero: boolean;
}

export function useActiveSessionSceneState({
	heroSeatPosition,
	sessionId,
	sessionType,
}: UseActiveSessionSceneStateOptions): ActiveSessionSceneState {
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
					memo: playerDetail.player.memo,
					name: playerDetail.player.name,
					tags: playerDetail.player.tags ?? [],
				}
			: null,
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
	title,
}: ActiveSessionSceneProps) {
	const [isDiscardOpen, setIsDiscardOpen] = useState(false);

	return (
		<>
			<div className="mb-2 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<h1 className="font-bold text-lg">{title}</h1>
					<Badge
						className="border-green-200 bg-green-50 text-[10px] text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
						variant="outline"
					>
						Active
					</Badge>
				</div>
				<Button
					className="text-destructive hover:text-destructive"
					onClick={() => setIsDiscardOpen(true)}
					size="sm"
					type="button"
					variant="ghost"
				>
					Discard
				</Button>
			</div>

			<div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
				{summary}
			</div>

			{memo ? (
				<p className="mt-1 text-muted-foreground text-xs">{memo}</p>
			) : null}

			<div className="min-h-0 flex-1">
				<PokerTable
					gameInfo={gameInfo}
					heroSeatPosition={state.heroSeatPosition}
					onEmptySeatTap={state.onEmptySeatTap}
					onHeroSeatTap={state.onHeroSeatTap}
					onPlayerSeatTap={state.onPlayerSeatTap}
					players={state.players}
					waitingForHero={state.waitingForHero}
				/>
			</div>

			<AddPlayerSheet
				availableTags={state.availableTags}
				excludePlayerIds={state.excludePlayerIds}
				onAddExisting={state.onAddExisting}
				onAddNew={state.onAddNew}
				onCreateTag={state.createTag}
				onOpenChange={state.setAddPlayerSheetOpen}
				open={state.addPlayerSheetOpen}
			/>

			<PlayerDetailSheet
				availableTags={state.availableTags}
				isSaving={state.isSavingPlayer}
				onCreateTag={state.createTag}
				onOpenChange={state.setPlayerSheetOpen}
				onRemove={state.onPlayerRemove}
				onSave={state.onPlayerSave}
				open={state.playerSheetOpen}
				player={state.selectedPlayer}
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
