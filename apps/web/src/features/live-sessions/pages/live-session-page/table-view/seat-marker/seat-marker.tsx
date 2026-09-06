import { IconUser, IconUserPlus, IconUserStar } from "@tabler/icons-react";
import type { SeatEntry } from "@/features/live-sessions/hooks/use-session-seats";
import type { SeatPoint } from "@/features/live-sessions/utils/table-geometry";

interface SeatMarkerProps {
	point: SeatPoint;
	seat: SeatEntry;
}

const WRAPPER_CLASS =
	"-translate-x-1/2 -translate-y-1/2 absolute flex flex-col items-center gap-[3px]";

const DOT_FALLBACK = "var(--muted-foreground)";

export function SeatMarker({ point, seat }: SeatMarkerProps) {
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
			</div>
		);
	}

	if (seat.player) {
		const dot = seat.player.tags[0]?.color ?? DOT_FALLBACK;
		return (
			<div className={WRAPPER_CLASS} style={style}>
				<div
					aria-label={`${label}: ${seat.player.name}`}
					className="flex size-10 items-center justify-center rounded-full border text-foreground shadow-[var(--shadow-sm)]"
					role="img"
					style={{
						borderColor: dot,
						backgroundColor: `color-mix(in oklab, ${dot} 14%, var(--background))`,
					}}
				>
					<IconUser size={17} />
				</div>
			</div>
		);
	}

	return (
		<div className={WRAPPER_CLASS} style={style}>
			<div
				aria-label={`${label}: empty`}
				className="flex size-7 items-center justify-center rounded-full border border-border border-dashed bg-background text-muted-foreground"
				role="img"
			>
				<IconUserPlus size={13} />
			</div>
		</div>
	);
}
