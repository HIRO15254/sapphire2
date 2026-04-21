import {
	IconLoader2,
	IconPlus,
	IconSparkles,
	IconUser,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/players/components/player-avatar";
import { Button } from "@/shared/components/ui/button";

const DEFAULT_TABLE_SIZE = 9;
const MIN_TABLE_SIZE = 2;
const MAX_TABLE_SIZE = 10;

/**
 * Seat positions around a stadium-shaped (racetrack) poker table.
 * [left%, top%] relative to the container.
 *
 * Stadium shape = rectangle with semicircle caps on left/right.
 * The bottom-center (50%, 98%) is always left empty. Seats are numbered
 * clockwise starting from the first position to the right of bottom-center
 * — displayed as seat 1..N (internal array indices 0..N-1).
 */
const SEAT_POSITIONS_BY_SIZE: Record<number, [number, number][]> = {
	2: [
		[96, 50], // 1: right-middle
		[4, 50], // 2: left-middle
	],
	3: [
		[73, 96], // 1: bottom-right
		[50, 2], // 2: top-center
		[27, 96], // 3: bottom-left
	],
	4: [
		[73, 96], // 1: bottom-right
		[73, 6], // 2: top-right
		[27, 6], // 3: top-left
		[27, 96], // 4: bottom-left
	],
	5: [
		[73, 96], // 1: bottom-right
		[92, 35], // 2: right-upper
		[50, 2], // 3: top-center
		[8, 35], // 4: left-upper
		[27, 96], // 5: bottom-left
	],
	6: [
		[73, 96], // 1: bottom-right
		[96, 50], // 2: right-middle
		[73, 6], // 3: top-right
		[27, 6], // 4: top-left
		[4, 50], // 5: left-middle
		[27, 96], // 6: bottom-left
	],
	7: [
		[73, 96], // 1: bottom-right
		[96, 50], // 2: right-middle
		[73, 6], // 3: top-right
		[50, 2], // 4: top-center
		[27, 6], // 5: top-left
		[4, 50], // 6: left-middle
		[27, 96], // 7: bottom-left
	],
	8: [
		[73, 96], // 1: bottom-right
		[92, 70], // 2: right-lower
		[92, 35], // 3: right-upper
		[73, 6], // 4: top-right
		[27, 6], // 5: top-left
		[8, 35], // 6: left-upper
		[8, 70], // 7: left-lower
		[27, 96], // 8: bottom-left
	],
	9: [
		[73, 96], // 1: bottom-right
		[92, 70], // 2: right-lower
		[92, 35], // 3: right-upper
		[73, 6], // 4: top-right
		[50, 2], // 5: top-center
		[27, 6], // 6: top-left
		[8, 35], // 7: left-upper
		[8, 70], // 8: left-lower
		[27, 96], // 9: bottom-left
	],
	10: [
		[73, 96], // 1: bottom-right
		[92, 82], // 2: right-lower
		[96, 50], // 3: right-middle
		[92, 18], // 4: right-upper
		[65, 6], // 5: top-right
		[35, 6], // 6: top-left
		[8, 18], // 7: left-upper
		[4, 50], // 8: left-middle
		[8, 82], // 9: left-lower
		[27, 96], // 10: bottom-left
	],
};

function resolveSeatPositions(
	tableSize: number | null | undefined
): [number, number][] {
	const size =
		typeof tableSize === "number" &&
		tableSize >= MIN_TABLE_SIZE &&
		tableSize <= MAX_TABLE_SIZE
			? tableSize
			: DEFAULT_TABLE_SIZE;
	return SEAT_POSITIONS_BY_SIZE[size];
}

export interface TablePlayer {
	id: string;
	isActive: boolean;
	isLoading?: boolean;
	player: {
		id: string;
		isTemporary: boolean;
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
	onScanPlayers?: () => void;
	players: TablePlayer[];
	/** Number of seats around the table (2..10). Defaults to 9 when nullish. */
	tableSize?: number | null;
	/** True when no hero is seated yet — empty seats show "Sit" hint */
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
	isLoading,
	onTap,
	player,
	position,
	waitingForHero,
}: {
	isHero: boolean;
	isLoading: boolean;
	onTap: () => void;
	player: TablePlayer | undefined;
	position: [number, number];
	waitingForHero: boolean;
}) {
	const [left, top] = position;
	const isOccupied = !!player;

	return (
		<button
			className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
			onClick={isLoading ? undefined : onTap}
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
				<div className="flex size-10 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-500/80 text-white shadow-md">
					<IconUser size={16} />
				</div>
			)}

			{/* Occupied seat */}
			{isOccupied && (
				<div className="relative">
					<PlayerAvatar
						className={cn(isLoading && "opacity-40")}
						isHero={isHero}
						isTemporary={player.player.isTemporary}
					/>
					{isLoading && (
						<IconLoader2
							className="absolute inset-0 m-auto animate-spin text-white"
							size={16}
						/>
					)}
				</div>
			)}

			{/* Name label */}
			<span
				className={cn(
					"max-w-[56px] truncate text-center text-[9px] leading-tight",
					isHero && "font-bold text-amber-300",
					isOccupied && !isHero && "font-medium text-white/90",
					isOccupied && isLoading && "opacity-50",
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
	onScanPlayers,
	players,
	tableSize,
	waitingForHero,
}: PokerTableProps) {
	const seatPositions = resolveSeatPositions(tableSize);
	return (
		<div className="relative mx-auto w-full max-w-sm pt-5 pb-6">
			<div className="relative aspect-[2/1]">
				{/* Table rim — stadium shape (rounded-full = semicircle caps) */}
				<div className="absolute inset-x-[4%] inset-y-[10%] rounded-full bg-emerald-900 shadow-lg dark:bg-emerald-950" />

				{/* Table felt */}
				<div className="absolute inset-x-[7%] inset-y-[15%] rounded-full border-2 border-emerald-600/50 bg-emerald-700 shadow-inner dark:border-emerald-500/30 dark:bg-emerald-800" />

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

				{/* Scan players button (bottom-center overlay, in reserved slot) */}
				{onScanPlayers && (
					<Button
						aria-label="Seat from screenshot"
						className="absolute bottom-0 left-1/2 z-10 h-7 -translate-x-1/2 gap-1 px-2 text-[10px]"
						onClick={onScanPlayers}
						size="xs"
						type="button"
						variant="outline"
					>
						<IconSparkles size={12} />
						AI Seat
					</Button>
				)}

				{/* Seats */}
				{seatPositions.map((position, i) => {
					const playerAtSeat = getPlayerAtSeat(players, i);
					const isHero = heroSeatPosition === i;

					return (
						<SeatSlot
							isHero={isHero}
							isLoading={playerAtSeat?.isLoading ?? false}
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
							position={position}
							waitingForHero={waitingForHero}
						/>
					);
				})}
			</div>
		</div>
	);
}
