import { IconCamera, IconLogout, IconPencil } from "@tabler/icons-react";
import type {
	SeatEntry,
	SeatPlayer,
} from "@/features/live-sessions/components/active-session-scene/use-active-session-scene-state";
import { memoExcerpt } from "@/features/live-sessions/utils/memo-excerpt";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { EmptySeatEditor } from "./empty-seat-editor";
import { OccupiedSeatEditor } from "./occupied-seat-editor";
import { PlayerTagBadges } from "./player-tag-badges";
import { PokerTable, type TableGameInfo } from "./poker-table";
import { useSeatTable } from "./use-seat-table";

interface SeatTableProps {
	excludePlayerIds: string[];
	gameInfo?: TableGameInfo;
	/** True when a seat may still be claimed as the hero seat. */
	heroAvailable: boolean;
	onRemovePlayer: (playerId: string) => void;
	onScanPlayers: () => void;
	onSeatExisting: (
		seatPosition: number,
		playerId: string,
		playerName: string
	) => void;
	onSeatHero: (seatPosition: number) => void;
	onSeatNew: (
		seatPosition: number,
		values: { memo?: string | null; name: string; tagIds?: string[] }
	) => void;
	onSeatTemporary: (seatPosition: number) => void;
	onUnseatHero: () => void;
	seats: SeatEntry[];
	unseatedPlayers: SeatPlayer[];
}

function DrawerHandle() {
	return (
		<div
			aria-hidden
			className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
		/>
	);
}

function UnseatedRow({
	onEdit,
	onUnseat,
	player,
}: {
	onEdit: () => void;
	onUnseat: () => void;
	player: SeatPlayer;
}) {
	const excerpt = memoExcerpt(player.memo);

	return (
		<li className="flex items-center gap-1 border-border border-b px-4 py-2 last:border-b-0">
			<button
				aria-label={`Edit ${player.name}`}
				className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40"
				onClick={onEdit}
				type="button"
			>
				<Avatar size="sm">
					<AvatarFallback>
						{player.name.slice(0, 1).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<span className="min-w-0 flex-1">
					<span className="flex items-center gap-1.5">
						<span className="min-w-0 shrink truncate font-medium text-sm">
							{player.name}
						</span>
						{player.isTemporary ? (
							<Badge
								className="shrink-0 border-warning/40 bg-warning/10 text-[10px] text-warning"
								variant="outline"
							>
								Temp
							</Badge>
						) : null}
						<PlayerTagBadges tags={player.tags} />
					</span>
					{excerpt ? (
						<span className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
							{excerpt}
						</span>
					) : null}
				</span>
				<IconPencil className="shrink-0 text-muted-foreground" size={14} />
			</button>
			<Button
				aria-label={`Unseat ${player.name}`}
				className="shrink-0 text-muted-foreground hover:text-destructive"
				onClick={onUnseat}
				size="icon-sm"
				type="button"
				variant="ghost"
			>
				<IconLogout size={16} />
			</Button>
		</li>
	);
}

/**
 * Visual seat view for the active session (revival of the pre-SA2-59 poker
 * table): the stadium table renders every seat; an empty-seat tap opens the
 * seating drawer (search / create / hero / temporary via the same
 * EmptySeatEditor as before), an occupied-seat tap opens the auto-saving edit
 * drawer (OccupiedSeatEditor) with a one-tap unseat, and the hero seat
 * unseats on tap. Players without a valid seat stay reachable in the
 * "Unseated" list below the table.
 */
export function SeatTable({
	excludePlayerIds,
	gameInfo,
	heroAvailable,
	onRemovePlayer,
	onScanPlayers,
	onSeatExisting,
	onSeatHero,
	onSeatNew,
	onSeatTemporary,
	onUnseatHero,
	seats,
	unseatedPlayers,
}: SeatTableProps) {
	const table = useSeatTable({
		onRemovePlayer,
		onSeatExisting,
		onSeatHero,
		onSeatNew,
		onSeatTemporary,
		onUnseatHero,
	});

	return (
		<section className="rounded-lg border border-border bg-card text-card-foreground">
			<div className="flex items-center justify-between border-border border-b px-4 py-2">
				<h2 className="t-h4">Players</h2>
				<Button
					aria-label="Seat from screenshot"
					onClick={onScanPlayers}
					size="icon-sm"
					type="button"
					variant="ghost"
				>
					<IconCamera size={18} />
				</Button>
			</div>

			<div className="px-2">
				<PokerTable
					gameInfo={gameInfo}
					heroAvailable={heroAvailable}
					onEmptySeatTap={table.onEmptySeatTap}
					onHeroSeatTap={table.onHeroSeatTap}
					onPlayerSeatTap={(player) => table.onPlayerTap(player)}
					seats={seats}
				/>
			</div>

			{unseatedPlayers.length > 0 ? (
				<div className="border-border border-t">
					<p className="px-4 pt-2 text-muted-foreground text-xs">Unseated</p>
					<ul className="flex flex-col">
						{unseatedPlayers.map((player) => (
							<UnseatedRow
								key={player.id}
								onEdit={() => table.onPlayerTap(player)}
								onUnseat={() => onRemovePlayer(player.playerId)}
								player={player}
							/>
						))}
					</ul>
				</div>
			) : null}

			<Drawer
				onOpenChange={(open) => {
					if (!open) {
						table.onCloseEmptySeat();
					}
				}}
				open={table.activeEmptySeat !== null}
			>
				<DrawerContent className="rounded-t-xl">
					<DrawerHandle />
					{table.activeEmptySeat === null ? null : (
						<>
							<DrawerTitle className="t-h4 px-4 py-1">
								{`Seat ${table.activeEmptySeat + 1}`}
							</DrawerTitle>
							<DrawerDescription className="sr-only">
								Seat a player here — search an existing player, create a new
								one, or claim the seat.
							</DrawerDescription>
							<div className="px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
								<EmptySeatEditor
									excludePlayerIds={excludePlayerIds}
									heroAvailable={heroAvailable}
									onAddExisting={table.onSeatExisting}
									onAddNew={table.onSeatNew}
									onAddTemporary={table.onSeatTemporary}
									onSeatHero={table.onSeatHero}
								/>
							</div>
						</>
					)}
				</DrawerContent>
			</Drawer>

			<Drawer
				onOpenChange={(open) => {
					if (!open) {
						table.onClosePlayer();
					}
				}}
				open={table.activePlayer !== null}
			>
				<DrawerContent className="rounded-t-xl">
					<DrawerHandle />
					{table.activePlayer ? (
						<>
							<DrawerTitle className="t-h4 px-4 py-1">
								{table.activePlayer.name}
							</DrawerTitle>
							<DrawerDescription className="sr-only">
								Edit this player's name, tags and memo, or unseat them.
							</DrawerDescription>
							<div className="flex flex-col gap-3 overflow-y-auto px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
								<OccupiedSeatEditor playerId={table.activePlayer.playerId} />
								<Button
									aria-label={`Unseat ${table.activePlayer.name}`}
									className="text-destructive hover:text-destructive"
									onClick={table.onUnseatActivePlayer}
									type="button"
									variant="outline"
								>
									<IconLogout size={16} />
									Unseat
								</Button>
							</div>
						</>
					) : null}
				</DrawerContent>
			</Drawer>
		</section>
	);
}
