import {
	IconLoader2,
	IconPlus,
	IconUser,
	IconUserQuestion,
} from "@tabler/icons-react";
import type {
	SeatEntry,
	SeatPlayer,
} from "@/features/live-sessions/components/active-session-scene/use-active-session-scene-state";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";

const FALLBACK_SEAT_COUNT = 9;

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
		[50, 6], // 2: top-center
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
		[94, 35], // 2: right-upper
		[50, 6], // 3: top-center
		[6, 35], // 4: left-upper
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
		[50, 6], // 4: top-center
		[27, 6], // 5: top-left
		[4, 50], // 6: left-middle
		[27, 96], // 7: bottom-left
	],
	8: [
		[73, 96], // 1: bottom-right
		[94, 70], // 2: right-lower
		[94, 35], // 3: right-upper
		[73, 6], // 4: top-right
		[27, 6], // 5: top-left
		[6, 35], // 6: left-upper
		[6, 70], // 7: left-lower
		[27, 96], // 8: bottom-left
	],
	9: [
		[73, 96], // 1: bottom-right
		[94, 70], // 2: right-lower
		[94, 35], // 3: right-upper
		[73, 6], // 4: top-right
		[50, 6], // 5: top-center
		[27, 6], // 6: top-left
		[6, 35], // 7: left-upper
		[6, 70], // 8: left-lower
		[27, 96], // 9: bottom-left
	],
	10: [
		[73, 96], // 1: bottom-right
		[94, 82], // 2: right-lower
		[96, 50], // 3: right-middle
		[94, 18], // 4: right-upper
		[65, 6], // 5: top-right
		[35, 6], // 6: top-left
		[6, 18], // 7: left-upper
		[4, 50], // 8: left-middle
		[6, 82], // 9: left-lower
		[27, 96], // 10: bottom-left
	],
};

export interface TableGameInfo {
	blinds?: string | null;
	buyInRange?: string | null;
	name?: string | null;
}

interface PokerTableProps {
	gameInfo?: TableGameInfo;
	/** True while no hero seat is set — empty seats show the "Sit" hint. */
	heroAvailable: boolean;
	onEmptySeatTap: (seatPosition: number) => void;
	onHeroSeatTap: () => void;
	onPlayerSeatTap: (player: SeatPlayer, seatPosition: number) => void;
	/** Seats from the scene state; the seat count picks the table formation. */
	seats: SeatEntry[];
}

function seatAriaLabel(seat: SeatEntry): string {
	const seatNumber = seat.seatPosition + 1;
	if (seat.isHero) {
		return `Seat ${seatNumber}: Hero`;
	}
	if (seat.player) {
		return `Seat ${seatNumber}: ${seat.player.name}`;
	}
	return `Seat ${seatNumber}`;
}

function SeatSlot({
	heroAvailable,
	onTap,
	position,
	seat,
}: {
	heroAvailable: boolean;
	onTap: () => void;
	position: [number, number];
	seat: SeatEntry;
}) {
	const [left, top] = position;
	const player = seat.player;
	const isLoading = player?.isLoading ?? false;

	return (
		<button
			aria-label={seatAriaLabel(seat)}
			className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
			disabled={isLoading}
			onClick={onTap}
			style={{ left: `${left}%`, top: `${top}%` }}
			type="button"
		>
			{/* Empty seat */}
			{!(player || seat.isHero) && (
				<div
					className={cn(
						"flex size-9 items-center justify-center rounded-full border-2 border-dashed transition-colors active:bg-white/10",
						heroAvailable
							? "border-warning/50 bg-warning/10 text-warning/60"
							: "border-white/20 bg-white/5 text-white/30"
					)}
				>
					{heroAvailable ? <IconUser size={13} /> : <IconPlus size={13} />}
				</div>
			)}

			{/* Hero seat */}
			{seat.isHero && (
				<div className="flex size-10 items-center justify-center rounded-full border-2 border-warning bg-warning/80 text-warning-foreground shadow-md">
					<IconUser size={16} />
				</div>
			)}

			{/* Occupied seat */}
			{player && (
				<div className="relative">
					<Avatar
						className={cn(
							"border-2 border-white/30 after:hidden",
							isLoading && "opacity-40"
						)}
						size="lg"
					>
						<AvatarFallback>
							{player.isTemporary ? (
								<IconUserQuestion size={16} />
							) : (
								player.name.slice(0, 1).toUpperCase()
							)}
						</AvatarFallback>
					</Avatar>
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
					seat.isHero && "font-bold text-warning",
					player && "font-medium text-white/90",
					player?.isLoading && "opacity-50",
					!(player || seat.isHero) && heroAvailable && "text-warning/50",
					!(player || seat.isHero || heroAvailable) && "text-white/30"
				)}
			>
				{seat.isHero && "You"}
				{player?.name}
				{!(player || seat.isHero) && heroAvailable && "Sit"}
			</span>
		</button>
	);
}

/**
 * Stadium-shaped visual poker table (revival of the pre-SA2-59 view): every
 * seat from the game definition is placed around the racetrack, with the
 * linked game's stakes in the center. Purely presentational — taps are
 * delegated per seat kind (empty / hero / occupied).
 */
export function PokerTable({
	gameInfo,
	heroAvailable,
	onEmptySeatTap,
	onHeroSeatTap,
	onPlayerSeatTap,
	seats,
}: PokerTableProps) {
	const seatPositions =
		SEAT_POSITIONS_BY_SIZE[seats.length] ??
		SEAT_POSITIONS_BY_SIZE[FALLBACK_SEAT_COUNT] ??
		[];

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

				{/* Seats */}
				{seats.slice(0, seatPositions.length).map((seat, i) => {
					const position = seatPositions[i];
					if (!position) {
						return null;
					}
					return (
						<SeatSlot
							heroAvailable={heroAvailable}
							key={`seat-${seat.seatPosition}`}
							onTap={() => {
								if (seat.isHero) {
									onHeroSeatTap();
								} else if (seat.player) {
									onPlayerSeatTap(seat.player, seat.seatPosition);
								} else {
									onEmptySeatTap(seat.seatPosition);
								}
							}}
							position={position}
							seat={seat}
						/>
					);
				})}
			</div>
		</div>
	);
}
