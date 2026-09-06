import { IconUser, IconUserPlus, IconUserStar } from "@tabler/icons-react";
import type { SeatEntry } from "@/features/live-sessions/hooks/use-session-seats";
import type { SeatPoint } from "@/features/live-sessions/utils/table-geometry";

interface SeatMarkerProps {
	point: SeatPoint;
	seat: SeatEntry;
}

function playerTint(color: string | undefined): React.CSSProperties {
	if (!color) {
		return {};
	}
	return {
		borderColor: color,
		backgroundColor: `color-mix(in oklab, ${color} 14%, var(--background))`,
	};
}

export function SeatMarker({ point, seat }: SeatMarkerProps) {
	const label = `Seat ${seat.seatPosition + 1}`;
	const style: React.CSSProperties = {
		left: `${point.x}%`,
		top: `${point.y}%`,
	};

	if (seat.occupancy === "hero") {
		return (
			<div
				aria-label={`${label}: Hero`}
				className="absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary bg-[color-mix(in_oklab,var(--primary)_15%,var(--background))] text-primary"
				role="img"
				style={style}
			>
				<IconUserStar size={18} />
			</div>
		);
	}

	if (seat.player) {
		return (
			<div
				aria-label={`${label}: ${seat.player.name}`}
				className="absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground"
				role="img"
				style={{ ...style, ...playerTint(seat.player.tags[0]?.color) }}
			>
				<IconUser size={17} />
			</div>
		);
	}

	return (
		<div
			aria-label={`${label}: empty`}
			className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border border-dashed text-muted-foreground"
			role="img"
			style={style}
		>
			<IconUserPlus size={13} />
		</div>
	);
}
