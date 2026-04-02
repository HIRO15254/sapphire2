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
 * Seat positions around a wide oval poker table (0-8).
 * [left%, top%] — landscape-oriented ellipse for compact vertical space.
 *
 *        8    top    1
 *    7                   2
 *    6                   3
 *        5   bottom  4
 *              0
 */
const SEAT_POSITIONS: [number, number][] = [
	[50, 97], // 0: bottom center (default hero)
	[80, 8], // 1: top right
	[98, 38], // 2: right upper
	[98, 70], // 3: right lower
	[80, 95], // 4: bottom right
	[20, 95], // 5: bottom left
	[2, 70], // 6: left lower
	[2, 38], // 7: left upper
	[20, 8], // 8: top left
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
	onHeroSeatTap: () => void;
	onPlayerSeatTap: (player: TablePlayer, seatPosition: number) => void;
	players: TablePlayer[];
	/** True when no hero is seated yet — empty seats show "Sit here" hint */
	waitingForHero: boolean;
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
	waitingForHero,
}: {
	isHero: boolean;
	onTap: () => void;
	player: TablePlayer | undefined;
	seatIndex: number;
	waitingForHero: boolean;
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
			{/* Empty seat */}
			{!(isOccupied || isHero) && (
				<div
					className={cn(
						"flex size-9 items-center justify-center rounded-full border-2 border-dashed transition-colors active:bg-white/10",
						waitingForHero
							? "border-amber-400/50 bg-amber-500/10 text-amber-300/60"
							: "border-white/20 bg-white/5 text-white/30"
					)}
				>
					{waitingForHero ? <IconUser size={13} /> : <IconPlus size={13} />}
				</div>
			)}

			{/* Hero seat (no player) */}
			{isHero && !isOccupied && (
				<div className="flex size-9 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-500/80 text-white shadow-md">
					<IconUser size={14} />
				</div>
			)}

			{/* Occupied seat */}
			{isOccupied && (
				<div
					className={cn(
						"flex size-9 items-center justify-center rounded-full border-2 font-bold text-[11px] text-white shadow-md",
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
					"max-w-[56px] truncate text-center text-[9px] leading-tight",
					isHero && "font-bold text-amber-300",
					isOccupied && !isHero && "font-medium text-white/90",
					!(isOccupied || isHero) && waitingForHero && "text-amber-300/50",
					!(isOccupied || isHero || waitingForHero) && "text-white/30"
				)}
			>
				{isHero && !isOccupied && "You"}
				{isOccupied && player.player.name}
				{!(isOccupied || isHero) && waitingForHero && "Sit"}
			</span>
		</button>
	);
}

export function PokerTable({
	gameInfo,
	heroSeatPosition,
	onEmptySeatTap,
	onHeroSeatTap,
	onPlayerSeatTap,
	players,
	waitingForHero,
}: PokerTableProps) {
	return (
		<div className="relative mx-auto aspect-[5/3] w-full max-w-sm">
			{/* Table rim */}
			<div className="absolute inset-x-[6%] inset-y-[8%] rounded-[50%] bg-emerald-900 shadow-lg dark:bg-emerald-950" />

			{/* Table felt */}
			<div className="absolute inset-x-[9%] inset-y-[12%] rounded-[50%] border-2 border-emerald-600/50 bg-emerald-700 shadow-inner dark:border-emerald-500/30 dark:bg-emerald-800" />

			{/* Center game info */}
			<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
				{gameInfo?.name && (
					<span className="font-bold text-[11px] text-white/60">
						{gameInfo.name}
					</span>
				)}
				{gameInfo?.blinds && (
					<span className="font-black text-base text-white/70">
						{gameInfo.blinds}
					</span>
				)}
				{gameInfo?.buyInRange && (
					<span className="text-[9px] text-white/40">
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
							if (isHero && !playerAtSeat) {
								onHeroSeatTap();
							} else if (playerAtSeat) {
								onPlayerSeatTap(playerAtSeat, i);
							} else {
								onEmptySeatTap(i);
							}
						}}
						player={playerAtSeat}
						seatIndex={i}
						waitingForHero={waitingForHero}
					/>
				);
			})}
		</div>
	);
}
