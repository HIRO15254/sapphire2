import { IconUser, IconUserPlus, IconUserStar } from "@tabler/icons-react";
import type { SeatEntry } from "@/features/live-sessions/hooks/use-session-seats";
import type { SeatPoint } from "@/features/live-sessions/utils/table-geometry";
import { cn } from "@/lib/utils";

interface SeatMarkerProps {
	isSelected: boolean;
	onSelect: (seatPosition: number) => void;
	point: SeatPoint;
	seat: SeatEntry;
}

const WRAPPER_CLASS =
	"-translate-x-1/2 -translate-y-1/2 absolute flex flex-col items-center gap-[3px]";

const DOT_FALLBACK = "var(--muted-foreground)";

const NAME_CLASS =
	"-bottom-1.5 -translate-x-1/2 pointer-events-none absolute left-1/2 max-w-[68px] truncate rounded-full border border-border bg-card px-1.5 py-px text-[10px] leading-[14px]";

export function SeatMarker({
	isSelected,
	onSelect,
	point,
	seat,
}: SeatMarkerProps) {
	const label = `Seat ${seat.seatPosition + 1}`;
	const style: React.CSSProperties = {
		left: `${point.x}%`,
		top: `${point.y}%`,
	};

	if (seat.occupancy === "hero") {
		return (
			<div className={WRAPPER_CLASS} style={style}>
				<div
					aria-label={`${label}: Hero`}
					className="flex size-10 items-center justify-center rounded-full border border-primary bg-[color-mix(in_oklab,var(--primary)_15%,transparent)] text-primary"
					role="img"
				>
					<IconUserStar size={18} />
				</div>
				<span className={cn(NAME_CLASS, "font-semibold text-primary")}>
					You
				</span>
			</div>
		);
	}

	if (seat.occupancy === "player" && seat.player) {
		const dot = seat.player.tags[0]?.color ?? DOT_FALLBACK;
		return (
			<div className={WRAPPER_CLASS} style={style}>
				<button
					aria-label={`${label}: ${seat.player.name}`}
					aria-pressed={isSelected}
					className={cn(
						"flex size-10 items-center justify-center rounded-full border text-foreground shadow-[var(--shadow-sm)]",
						isSelected &&
							"ring-2 ring-ring ring-offset-2 ring-offset-background"
					)}
					onClick={() => onSelect(seat.seatPosition)}
					style={{
						borderColor: dot,
						backgroundColor: `color-mix(in oklab, ${dot} 14%, var(--background))`,
					}}
					type="button"
				>
					<IconUser size={17} />
				</button>
				<span className={NAME_CLASS}>{seat.player.name}</span>
			</div>
		);
	}

	return (
		<div className={WRAPPER_CLASS} style={style}>
			<button
				aria-label={`${label}: empty`}
				className="flex size-7 items-center justify-center rounded-full border border-border border-dashed bg-background text-muted-foreground"
				onClick={() => onSelect(seat.seatPosition)}
				type="button"
			>
				<IconUserPlus size={13} />
			</button>
		</div>
	);
}
