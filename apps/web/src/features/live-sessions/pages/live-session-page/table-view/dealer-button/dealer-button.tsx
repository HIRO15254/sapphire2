import type { SeatPoint } from "@/features/live-sessions/utils/table-geometry";
import { CRYST_FOCUS_RING } from "../../cryst-controls";

interface DealerButtonProps {
	canEdit: boolean;
	onMoveForward: () => void;
	seatLabel: string;
	spot: SeatPoint;
}

export function DealerButton({
	canEdit,
	onMoveForward,
	seatLabel,
	spot,
}: DealerButtonProps) {
	return (
		<button
			aria-label={`Dealer button at ${seatLabel}. Move it to the next seat`}
			className={`absolute z-[2] flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-none bg-foreground p-0 font-bold font-mono text-[11px] text-background shadow-[var(--shadow-sm)] transition-[left,top] duration-[250ms] disabled:cursor-default ${CRYST_FOCUS_RING}`}
			disabled={!canEdit}
			onClick={onMoveForward}
			style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
			title="Tap to move the button to the next seat"
			type="button"
		>
			D
		</button>
	);
}
