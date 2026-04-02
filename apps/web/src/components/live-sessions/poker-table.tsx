import { IconPlus, IconStar, IconStarFilled, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const MAX_SEATS = 9;

/**
 * Seat positions around an oval poker table (0-8).
 * Positions are arranged clockwise starting from bottom-center.
 * Each entry: [left%, top%] relative to the table container.
 *
 * Layout (portrait-oriented oval):
 *   Seat 7  Seat 8  Seat 1  Seat 2
 *   Seat 6                  Seat 3
 *   Seat 5    Seat 0    Seat 4
 *
 * Seat 0 = bottom center (default hero position)
 */
const SEAT_POSITIONS: [number, number][] = [
	[50, 92], // 0: bottom center
	[84, 18], // 1: top right
	[96, 42], // 2: right upper
	[96, 68], // 3: right lower
	[84, 88], // 4: bottom right
	[16, 88], // 5: bottom left
	[4, 68], // 6: left lower
	[4, 42], // 7: left upper
	[16, 18], // 8: top left
];

export interface TablePlayer {
	id: string;
	isActive: boolean;
	player: {
		id: string;
		name: string;
	};
	seatPosition: number | null;
}

interface PokerTableProps {
	heroSeatPosition: number;
	onAddPlayer: (seatPosition: number) => void;
	onHeroSeatChange: (seatPosition: number) => void;
	onRemovePlayer: (playerId: string) => void;
	players: TablePlayer[];
}

function getPlayerAtSeat(
	players: TablePlayer[],
	seatPosition: number
): TablePlayer | undefined {
	return players.find((p) => p.isActive && p.seatPosition === seatPosition);
}

function SeatSlot({
	isHero,
	onAdd,
	onHeroMark,
	onRemove,
	player,
	seatIndex,
}: {
	isHero: boolean;
	onAdd: () => void;
	onHeroMark: () => void;
	onRemove: () => void;
	player: TablePlayer | undefined;
	seatIndex: number;
}) {
	const [left, top] = SEAT_POSITIONS[seatIndex];
	const isEmpty = !(player || isHero);
	const isOccupied = !!player;
	const isHeroEmpty = isHero && !player;

	return (
		<div
			className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
			style={{ left: `${left}%`, top: `${top}%` }}
		>
			{/* Seat circle */}
			{isEmpty && (
				<button
					className="flex size-10 items-center justify-center rounded-full border-2 border-muted-foreground/30 border-dashed bg-background text-muted-foreground/50 transition-colors hover:border-primary/50 hover:text-primary/70"
					onClick={onAdd}
					title="Add player"
					type="button"
				>
					<IconPlus size={16} />
				</button>
			)}

			{isHeroEmpty && (
				<div className="flex size-10 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/50">
					<IconStarFilled className="text-amber-500" size={16} />
				</div>
			)}

			{isOccupied && (
				<div className="group relative">
					<div
						className={cn(
							"flex size-10 items-center justify-center rounded-full border-2 font-bold text-xs",
							isHero
								? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
								: "border-primary/40 bg-primary/10 text-primary"
						)}
					>
						{player.player.name.slice(0, 2).toUpperCase()}
					</div>
					{/* Remove button */}
					<button
						className="absolute -top-1 -right-1 hidden size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
						onClick={onRemove}
						title="Remove player"
						type="button"
					>
						<IconX size={10} />
					</button>
				</div>
			)}

			{/* Player name label */}
			<span
				className={cn(
					"mt-0.5 max-w-[56px] truncate text-center text-[10px] leading-tight",
					isHero &&
						!isOccupied &&
						"font-semibold text-amber-600 dark:text-amber-400",
					isOccupied && !isHero && "text-foreground/80",
					isOccupied &&
						isHero &&
						"font-semibold text-amber-600 dark:text-amber-400",
					!(isOccupied || isHero) && "text-muted-foreground/40"
				)}
			>
				{isHeroEmpty && "Hero"}
				{isOccupied && player.player.name}
			</span>

			{/* Hero mark button (long press / right-click area) */}
			{!isHero && (
				<button
					className="absolute -bottom-3 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100"
					onClick={(e) => {
						e.stopPropagation();
						onHeroMark();
					}}
					title="Set as my seat"
					type="button"
				>
					<IconStar
						className="text-muted-foreground/40 hover:text-amber-500"
						size={12}
					/>
				</button>
			)}
		</div>
	);
}

export function PokerTable({
	heroSeatPosition,
	onAddPlayer,
	onHeroSeatChange,
	onRemovePlayer,
	players,
}: PokerTableProps) {
	return (
		<div className="relative mx-auto aspect-[4/3] w-full max-w-xs">
			{/* Table surface - oval shape */}
			<div className="absolute inset-[12%] rounded-[50%] border-4 border-emerald-700/60 bg-emerald-800/20 shadow-inner dark:border-emerald-600/40 dark:bg-emerald-900/30" />

			{/* Table felt center text */}
			<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
				<span className="select-none text-emerald-700/20 text-xs dark:text-emerald-500/20">
					TABLE
				</span>
			</div>

			{/* Seats */}
			{Array.from({ length: MAX_SEATS }, (_, i) => {
				const playerAtSeat = getPlayerAtSeat(players, i);
				const isHero = heroSeatPosition === i;

				return (
					<SeatSlot
						isHero={isHero}
						key={`seat-${String(i)}`}
						onAdd={() => onAddPlayer(i)}
						onHeroMark={() => onHeroSeatChange(i)}
						onRemove={() => {
							if (playerAtSeat) {
								onRemovePlayer(playerAtSeat.player.id);
							}
						}}
						player={playerAtSeat}
						seatIndex={i}
					/>
				);
			})}
		</div>
	);
}
