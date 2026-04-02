import { IconPlus, IconUser } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const MAX_SEATS = 9;

/** Avatar background colors for non-hero players, cycled by seat index. */
const AVATAR_COLORS = [
	"bg-blue-500",
	"bg-rose-500",
	"bg-amber-500",
	"bg-teal-500",
	"bg-purple-500",
	"bg-orange-500",
	"bg-cyan-500",
	"bg-pink-500",
	"bg-lime-500",
] as const;

/**
 * Seat positions around an oval poker table (0-8).
 * [left%, top%] relative to the container.
 *
 *        8    top    1
 *    7                   2
 *    6                   3
 *        5   bottom  4
 *              0
 */
const SEAT_POSITIONS: [number, number][] = [
	[50, 95], // 0: bottom center (default hero)
	[82, 12], // 1: top right
	[97, 40], // 2: right upper
	[97, 68], // 3: right lower
	[82, 92], // 4: bottom right
	[18, 92], // 5: bottom left
	[3, 68], // 6: left lower
	[3, 40], // 7: left upper
	[18, 12], // 8: top left
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

export interface TableGameInfo {
	blinds?: string | null;
	buyInRange?: string | null;
	name?: string | null;
}

interface PokerTableProps {
	gameInfo?: TableGameInfo;
	heroSeatPosition: number | null;
	onEmptySeatTap: (seatPosition: number) => void;
	onPlayerSeatTap: (player: TablePlayer, seatPosition: number) => void;
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
	onTap,
	player,
	seatIndex,
}: {
	isHero: boolean;
	onTap: () => void;
	player: TablePlayer | undefined;
	seatIndex: number;
}) {
	const [left, top] = SEAT_POSITIONS[seatIndex];
	const isOccupied = !!player;
	const colorClass = AVATAR_COLORS[seatIndex % AVATAR_COLORS.length];

	return (
		<button
			className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
			onClick={onTap}
			style={{ left: `${left}%`, top: `${top}%` }}
			type="button"
		>
			{/* Avatar circle */}
			{!(isOccupied || isHero) && (
				<div className="flex size-10 items-center justify-center rounded-full border-2 border-white/20 border-dashed bg-white/5 text-white/30 transition-colors active:bg-white/10">
					<IconPlus size={14} />
				</div>
			)}

			{isHero && !isOccupied && (
				<div className="flex size-10 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-500/80 text-white shadow-md">
					<IconUser size={16} />
				</div>
			)}

			{isOccupied && (
				<div
					className={cn(
						"flex size-10 items-center justify-center rounded-full border-2 font-bold text-white text-xs shadow-md",
						isHero
							? "border-amber-400 bg-amber-500/80"
							: `border-white/30 ${colorClass}`
					)}
				>
					{player.player.name.slice(0, 2).toUpperCase()}
				</div>
			)}

			{/* Name label */}
			<span
				className={cn(
					"max-w-[60px] truncate text-center text-[10px] leading-tight",
					isHero && "font-bold text-amber-300",
					isOccupied && !isHero && "font-medium text-white/90",
					!(isOccupied || isHero) && "text-white/30"
				)}
			>
				{isHero && !isOccupied && "You"}
				{isOccupied && player.player.name}
			</span>
		</button>
	);
}

export function PokerTable({
	gameInfo,
	heroSeatPosition,
	onEmptySeatTap,
	onPlayerSeatTap,
	players,
}: PokerTableProps) {
	return (
		<div className="relative mx-auto aspect-[4/3] w-full max-w-sm">
			{/* Table rim */}
			<div className="absolute inset-[8%] rounded-[50%] bg-emerald-900 shadow-lg dark:bg-emerald-950" />

			{/* Table felt */}
			<div className="absolute inset-[11%] rounded-[50%] border-2 border-emerald-600/50 bg-emerald-700 shadow-inner dark:border-emerald-500/30 dark:bg-emerald-800" />

			{/* Center game info */}
			<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
				{gameInfo?.name && (
					<span className="font-bold text-white/60 text-xs">
						{gameInfo.name}
					</span>
				)}
				{gameInfo?.blinds && (
					<span className="font-black text-lg text-white/70">
						{gameInfo.blinds}
					</span>
				)}
				{gameInfo?.buyInRange && (
					<span className="text-[10px] text-white/40">
						{gameInfo.buyInRange}
					</span>
				)}
				{!(gameInfo?.name || gameInfo?.blinds) && (
					<span className="select-none text-white/20 text-xs">TABLE</span>
				)}
			</div>

			{/* Seats */}
			{Array.from({ length: MAX_SEATS }, (_, i) => {
				const playerAtSeat = getPlayerAtSeat(players, i);
				const isHero = heroSeatPosition === i;

				return (
					<SeatSlot
						isHero={isHero}
						key={`seat-${String(i)}`}
						onTap={() => {
							if (playerAtSeat) {
								onPlayerSeatTap(playerAtSeat, i);
							} else {
								onEmptySeatTap(i);
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
